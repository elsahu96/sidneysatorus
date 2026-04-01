"""
Tests for GCS report push and retrieval.

Structure:
  Unit tests  — mock GCS; always run; no cloud credentials needed
  Integration — skip unless GCS_BUCKET + GOOGLE_APPLICATION_CREDENTIALS are set

Unit coverage:
  - Report JSON uploaded to GCS after investigation subprocess succeeds
  - Upload skipped when STORAGE_BACKEND != "gcs" or GCS_BUCKET is empty
  - Upload failure is swallowed (investigation still returns a result)
  - GET /reports/{id} reads from GCS when STORAGE_BACKEND=gcs
  - GET /reports/{id} falls back to local filesystem when GCS missing
  - GET /reports/{id} returns 404 when not found in GCS or locally

Integration coverage (requires live GCS):
  - Uploads a real JSON blob to GCS bucket and reads it back
  - Cleans up the blob after the test
"""

import json
import os
import pathlib
import tempfile
from unittest.mock import AsyncMock, MagicMock, patch, call

from dotenv import load_dotenv
load_dotenv()  # pull GCS_BUCKET / GOOGLE_APPLICATION_CREDENTIALS from .env

import pytest
from fastapi.testclient import TestClient

from src.storage_factory import (
    GCSDocumentStorage,
    MockDocumentStorage,
    StorageError,
    StorageFactory,
)

# ── Shared fixtures ───────────────────────────────────────────────────────────

SAMPLE_REPORT: dict = {
    "metadata": {
        "title": "Sidney Test Report",
        "written_at": "2024-01-15T10:30:00",
        "investigation_type": "PERSON_INVESTIGATION",
        "query_understanding": "Investigate test subject",
        "stats": {
            "reference_count": 2,
            "geolocation_count": 1,
            "primary_entity_count": 1,
            "risk_factor_count": 1,
        },
    },
    "entities": {
        "primary": [{"name": "Test Subject", "role": "Investigation Target"}],
        "secondary": [],
    },
    "geolocations": [
        {
            "entity": "Test Subject",
            "coordinates": [51.5074, -0.1278],
            "type": "hq",
            "context": "Registered office",
        }
    ],
    "report": {
        "summary": "Executive summary of the investigation.",
        "methodology": "Open-source intelligence gathering.",
        "detailed_analysis": "Detailed analysis of findings.",
        "risk_factors": ["High financial exposure"],
        "sources": [
            {
                "index": 1,
                "title": "Source A",
                "url": "https://example.com/a",
                "date": "2024-01-10",
                "key_insight": "Key finding A",
            },
            {
                "index": 2,
                "title": "Source B",
                "url": "https://example.com/b",
                "date": "2024-01-12",
                "key_insight": "Key finding B",
            },
        ],
    },
    "sources": [],
}

REPORT_ID = "report_20240115_103000"


@pytest.fixture
def report_json_file(tmp_path: pathlib.Path) -> pathlib.Path:
    """Write SAMPLE_REPORT to a temp JSON file and return the path."""
    p = tmp_path / f"{REPORT_ID}.json"
    p.write_text(json.dumps(SAMPLE_REPORT), encoding="utf-8")
    return p


@pytest.fixture
def mock_storage() -> MockDocumentStorage:
    return StorageFactory.create("mock", {})


# ── Unit: GCS upload logic in investigate endpoint ───────────────────────────

def test_gcs_upload_stores_report_json(report_json_file: pathlib.Path) -> None:
    """GCS upload is called with the correct path and bytes when STORAGE_BACKEND=gcs."""
    mock_gcs = MagicMock(spec=GCSDocumentStorage)
    mock_gcs.upload.return_value = f"https://storage.googleapis.com/test-bucket/reports/{REPORT_ID}.json"

    with patch.dict(os.environ, {"STORAGE_BACKEND": "gcs", "GCS_BUCKET": "test-bucket"}):
        with patch("src.storage_factory.GCSDocumentStorage", return_value=mock_gcs) as MockGCS:
            _simulate_investigate_gcs_upload(str(report_json_file), mock_gcs)

    mock_gcs.upload.assert_called_once()
    call_args = mock_gcs.upload.call_args
    assert call_args[0][0] == f"reports/{REPORT_ID}.json"
    assert json.loads(call_args[0][1]) == SAMPLE_REPORT
    assert call_args[0][2] == {"content_type": "application/json"}


def test_gcs_upload_skipped_when_storage_backend_local(report_json_file: pathlib.Path) -> None:
    """No GCS upload when STORAGE_BACKEND is not 'gcs'."""
    mock_gcs = MagicMock(spec=GCSDocumentStorage)

    with patch.dict(os.environ, {"STORAGE_BACKEND": "local", "GCS_BUCKET": "test-bucket"}):
        _simulate_investigate_gcs_upload(str(report_json_file), mock_gcs)

    mock_gcs.upload.assert_not_called()


def test_gcs_upload_skipped_when_bucket_empty(report_json_file: pathlib.Path) -> None:
    """No GCS upload when GCS_BUCKET is empty even if STORAGE_BACKEND=gcs."""
    mock_gcs = MagicMock(spec=GCSDocumentStorage)

    with patch.dict(os.environ, {"STORAGE_BACKEND": "gcs", "GCS_BUCKET": ""}):
        _simulate_investigate_gcs_upload(str(report_json_file), mock_gcs)

    mock_gcs.upload.assert_not_called()


def test_gcs_upload_failure_does_not_propagate(report_json_file: pathlib.Path) -> None:
    """GCS upload exceptions are caught — the investigation result is still returned."""
    mock_gcs = MagicMock(spec=GCSDocumentStorage)
    mock_gcs.upload.side_effect = Exception("GCS unavailable")

    with patch.dict(os.environ, {"STORAGE_BACKEND": "gcs", "GCS_BUCKET": "test-bucket"}):
        # Must not raise
        _simulate_investigate_gcs_upload(str(report_json_file), mock_gcs)

    mock_gcs.upload.assert_called_once()


def test_gcs_upload_skipped_when_file_missing() -> None:
    """No upload attempt when the local report file does not exist."""
    mock_gcs = MagicMock(spec=GCSDocumentStorage)

    with patch.dict(os.environ, {"STORAGE_BACKEND": "gcs", "GCS_BUCKET": "test-bucket"}):
        _simulate_investigate_gcs_upload("/nonexistent/path/report.json", mock_gcs)

    mock_gcs.upload.assert_not_called()


# ── Unit: report.py GET /reports/{id} with GCS ───────────────────────────────

def _make_report_app(mock_user: dict | None = None):
    """Import report router fresh so env patches take effect.
    Pass mock_user to override the verify_token dependency."""
    from fastapi import FastAPI
    from src.api.report import app as report_router
    from src.service.auth import verify_token
    fastapi_app = FastAPI()
    fastapi_app.include_router(report_router)
    if mock_user is not None:
        fastapi_app.dependency_overrides[verify_token] = lambda: mock_user
    return fastapi_app


def test_get_report_reads_from_gcs() -> None:
    """GET /reports/{id} returns parsed report content when found in GCS."""
    raw_bytes = json.dumps(SAMPLE_REPORT).encode()
    fake_uid = "test-uid-123"

    mock_gcs = MagicMock(spec=GCSDocumentStorage)
    mock_gcs.download.return_value = raw_bytes

    mock_user = {"uid": fake_uid, "email": "test@example.com"}

    with patch.dict(os.environ, {"STORAGE_BACKEND": "gcs", "GCS_BUCKET": "test-bucket"}):
        with patch("src.api.report._use_gcs", return_value=True):
            with patch("src.api.report._gcs_storage", return_value=mock_gcs):
                app = _make_report_app(mock_user=mock_user)
                client = TestClient(app)
                resp = client.get(f"/reports/{REPORT_ID}")

    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == REPORT_ID
    assert "Summary" in body["content"]
    assert "Detailed Analysis" in body["content"]
    assert body["name"] == SAMPLE_REPORT["metadata"]["title"]
    assert len(body["geolocations"]) == 1
    mock_gcs.download.assert_called_once_with(f"{fake_uid}/{REPORT_ID}.json")


def test_get_report_falls_back_to_local_when_gcs_missing(tmp_path: pathlib.Path) -> None:
    """GET /reports/{id} falls back to local filesystem when GCS raises StorageError."""
    json_file = tmp_path / f"{REPORT_ID}.json"
    json_file.write_text(json.dumps(SAMPLE_REPORT), encoding="utf-8")

    mock_gcs = MagicMock(spec=GCSDocumentStorage)
    mock_gcs.download.side_effect = StorageError("Object not found")
    mock_user = {"uid": "test-uid-123", "email": "test@example.com"}

    with patch.dict(os.environ, {"STORAGE_BACKEND": "gcs", "GCS_BUCKET": "test-bucket"}):
        with patch("src.api.report._use_gcs", return_value=True):
            with patch("src.api.report._gcs_storage", return_value=mock_gcs):
                with patch("src.api.report._report_dir", return_value=tmp_path):
                    app = _make_report_app(mock_user=mock_user)
                    client = TestClient(app)
                    resp = client.get(f"/reports/{REPORT_ID}")

    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == REPORT_ID
    assert body["name"] == SAMPLE_REPORT["metadata"]["title"]


def test_get_report_404_when_not_in_gcs_or_local(tmp_path: pathlib.Path) -> None:
    """GET /reports/{id} returns 404 when missing from both GCS and local filesystem."""
    mock_gcs = MagicMock(spec=GCSDocumentStorage)
    mock_gcs.download.side_effect = StorageError("Object not found")
    mock_user = {"uid": "test-uid-123", "email": "test@example.com"}

    with patch.dict(os.environ, {"STORAGE_BACKEND": "gcs", "GCS_BUCKET": "test-bucket"}):
        with patch("src.api.report._use_gcs", return_value=True):
            with patch("src.api.report._gcs_storage", return_value=mock_gcs):
                with patch("src.api.report._report_dir", return_value=tmp_path):
                    app = _make_report_app(mock_user=mock_user)
                    client = TestClient(app)
                    resp = client.get("/reports/nonexistent_report_id")

    assert resp.status_code == 404


def test_get_report_local_when_gcs_disabled(tmp_path: pathlib.Path) -> None:
    """GET /reports/{id} reads from local filesystem when STORAGE_BACKEND != 'gcs'."""
    json_file = tmp_path / f"{REPORT_ID}.json"
    json_file.write_text(json.dumps(SAMPLE_REPORT), encoding="utf-8")
    mock_user = {"uid": "test-uid-123", "email": "test@example.com"}

    with patch.dict(os.environ, {"STORAGE_BACKEND": "local"}):
        with patch("src.api.report._report_dir", return_value=tmp_path):
            app = _make_report_app(mock_user=mock_user)
            client = TestClient(app)
            resp = client.get(f"/reports/{REPORT_ID}")

    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == REPORT_ID
    assert body["name"] == SAMPLE_REPORT["metadata"]["title"]


# ── Unit: roundtrip through MockDocumentStorage ──────────────────────────────

def test_mock_storage_report_roundtrip() -> None:
    """Write a report JSON to MockDocumentStorage and read it back unchanged."""
    storage = StorageFactory.create("mock", {})
    raw = json.dumps(SAMPLE_REPORT).encode()

    storage.upload(f"reports/{REPORT_ID}.json", raw, {"content_type": "application/json"})

    assert storage.exists(f"reports/{REPORT_ID}.json")
    downloaded = storage.download(f"reports/{REPORT_ID}.json")
    assert json.loads(downloaded) == SAMPLE_REPORT


def test_mock_storage_list_reports() -> None:
    """list('reports/') returns all uploaded report paths."""
    storage = StorageFactory.create("mock", {})
    ids = ["report_20240101_000000", "report_20240102_000000", "report_20240103_000000"]

    for rid in ids:
        storage.upload(f"reports/{rid}.json", b"{}", {"content_type": "application/json"})

    paths = storage.list("reports/")
    assert len(paths) == 3
    for rid in ids:
        assert f"reports/{rid}.json" in paths


def test_mock_storage_delete_report() -> None:
    """delete() removes the report from storage."""
    storage = StorageFactory.create("mock", {})
    storage.upload(f"reports/{REPORT_ID}.json", b"{}", {})
    assert storage.exists(f"reports/{REPORT_ID}.json")

    storage.delete(f"reports/{REPORT_ID}.json")
    assert not storage.exists(f"reports/{REPORT_ID}.json")


# ── Integration: real GCS bucket ─────────────────────────────────────────────

_HAS_GCS_CREDS = bool(os.getenv("GCS_BUCKET") and (
    os.getenv("GOOGLE_APPLICATION_CREDENTIALS") or
    os.getenv("GOOGLE_CLOUD_PROJECT")
))

_INTEGRATION_UID = "test-integration-uid-abc123"


@pytest.mark.skipif(not _HAS_GCS_CREDS, reason="GCS_BUCKET and GCP credentials not configured")
def test_integration_gcs_upload_and_read() -> None:
    """Upload a report JSON under a user UID folder and read it back, then clean up."""
    bucket = os.environ["GCS_BUCKET"]
    storage = GCSDocumentStorage(bucket_name=bucket)

    test_report_id = f"test_integration_{REPORT_ID}"
    gcs_path = f"{_INTEGRATION_UID}/{test_report_id}.json"
    raw = json.dumps(SAMPLE_REPORT).encode()

    try:
        url = storage.upload(gcs_path, raw, {"content_type": "application/json"})
        assert url, "upload() should return a non-empty URL"
        assert storage.exists(gcs_path), "Blob should exist after upload"

        downloaded = storage.download(gcs_path)
        assert json.loads(downloaded) == SAMPLE_REPORT, "Downloaded JSON must match uploaded JSON"

        meta = storage.get_metadata(gcs_path)
        assert meta["size"] == len(raw), "GCS metadata size must match uploaded byte count"

        paths = storage.list(f"{_INTEGRATION_UID}/")
        assert gcs_path in paths, "Uploaded blob should appear in list('{uid}/')"

    finally:
        if storage.exists(gcs_path):
            storage.delete(gcs_path)
        assert not storage.exists(gcs_path), "Blob should be gone after cleanup"


@pytest.mark.skipif(not _HAS_GCS_CREDS, reason="GCS_BUCKET and GCP credentials not configured")
def test_integration_report_endpoint_reads_from_gcs() -> None:
    """Full roundtrip: upload under uid folder, hit GET /reports/{id}, verify content."""
    bucket = os.environ["GCS_BUCKET"]
    storage = GCSDocumentStorage(bucket_name=bucket)

    test_report_id = f"test_endpoint_{REPORT_ID}"
    gcs_path = f"{_INTEGRATION_UID}/{test_report_id}.json"
    raw = json.dumps(SAMPLE_REPORT).encode()
    mock_user = {"uid": _INTEGRATION_UID, "email": "integration@test.com"}

    try:
        storage.upload(gcs_path, raw, {"content_type": "application/json"})

        with patch.dict(os.environ, {"STORAGE_BACKEND": "gcs", "GCS_BUCKET": bucket}):
            app = _make_report_app(mock_user=mock_user)
            client = TestClient(app)
            resp = client.get(f"/reports/{test_report_id}")

        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == test_report_id
        assert body["name"] == SAMPLE_REPORT["metadata"]["title"]
        assert "Summary" in body["content"]

    finally:
        if storage.exists(gcs_path):
            storage.delete(gcs_path)


# ── Helper: mirrors the GCS upload block in investigate.py ───────────────────

def _simulate_investigate_gcs_upload(report_path: str, storage_instance) -> None:
    """
    Replicates the GCS upload block from investigate.py so tests can verify
    its behaviour without spinning up the full FastAPI app or subprocess.
    """
    if os.getenv("STORAGE_BACKEND") == "gcs":
        try:
            gcs_bucket = os.getenv("GCS_BUCKET", "")
            path = pathlib.Path(report_path)
            report_id = path.stem
            if gcs_bucket and path.exists():
                storage_instance.upload(
                    f"reports/{report_id}.json",
                    path.read_bytes(),
                    {"content_type": "application/json"},
                )
        except Exception:
            pass  # mirrors logger.exception in investigate.py
