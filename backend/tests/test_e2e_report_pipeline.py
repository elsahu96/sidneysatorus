"""
End-to-end test for the report generation → GCS upload → report retrieval pipeline.

Simulates exactly what happens in production:
  1. Writer tool writes report JSON to local filesystem (as investigate_runner.py does)
  2. investigate.py reads stdout path and uploads to GCS
  3. GET /reports/{id} reads back from GCS and returns parsed content

Requires: GCS_BUCKET + GOOGLE_APPLICATION_CREDENTIALS in .env (or environment).
Skipped automatically if credentials are absent.
"""

import json
import os
import pathlib

import pytest
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.storage_factory import GCSDocumentStorage

load_dotenv()

_HAS_GCS_CREDS = bool(
    os.getenv("GCS_BUCKET")
    and (
        os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        or os.getenv("GOOGLE_CLOUD_PROJECT")
    )
)
pytestmark = pytest.mark.skipif(
    not _HAS_GCS_CREDS,
    reason="GCS_BUCKET and GCP credentials not configured",
)

# ── Fixture: realistic writer-tool output ────────────────────────────────────

WRITER_OUTPUT = {
    "metadata": {
        "title": "E2E Pipeline Test Report",
        "written_at": "2024-03-28T10:00:00",
        "investigation_type": "PERSON_INVESTIGATION",
        "query_understanding": "E2E test of the report pipeline",
        "stats": {
            "reference_count": 1,
            "geolocation_count": 1,
            "primary_entity_count": 1,
            "risk_factor_count": 1,
        },
    },
    "entities": {
        "primary": [{"name": "Test Entity", "role": "Subject"}],
        "secondary": [],
    },
    "geolocations": [
        {
            "entity": "Test Entity",
            "coordinates": [40.7128, -74.0060],
            "type": "hq",
            "context": "Primary location",
        }
    ],
    "report": {
        "summary": "E2E pipeline test summary.",
        "methodology": "Automated test methodology.",
        "detailed_analysis": "Full analysis content for E2E test [1].",
        "risk_factors": ["Test risk factor"],
        "sources": [
            {
                "index": 1,
                "title": "E2E Test Source",
                "url": "https://example.com/e2e",
                "date": "2024-03-28",
                "key_insight": "E2E test insight",
            }
        ],
    },
}


@pytest.fixture
def local_report_file(tmp_path: pathlib.Path):
    """
    Simulate what writer.py does: write the report JSON to a local file
    and return its path (as investigate_runner.py would print to stdout).
    """
    report_id = "e2e_test_report_20240328_100000"
    json_path = tmp_path / f"{report_id}.json"
    json_path.write_text(json.dumps(WRITER_OUTPUT), encoding="utf-8")
    return json_path


@pytest.fixture
def gcs_storage():
    return GCSDocumentStorage(bucket_name=os.environ["GCS_BUCKET"])


FAKE_UID = "e2e-test-uid-firebase123"
MOCK_USER = {"uid": FAKE_UID, "email": "e2e@test.com"}


@pytest.fixture
def report_client():
    """FastAPI test client for the /reports router pointed at real GCS."""
    from src.api.report import app as report_router
    from src.service.auth import verify_token
    app = FastAPI()
    app.include_router(report_router)
    app.dependency_overrides[verify_token] = lambda: MOCK_USER
    return TestClient(app)


# ── Step 1: writer tool → local file ─────────────────────────────────────────

def test_step1_local_report_file_is_valid_json(local_report_file):
    """The writer-tool output is well-formed JSON with all expected sections."""
    data = json.loads(local_report_file.read_text(encoding="utf-8"))

    assert data["metadata"]["title"] == WRITER_OUTPUT["metadata"]["title"]
    assert "summary" in data["report"]
    assert "detailed_analysis" in data["report"]
    assert len(data["report"]["sources"]) == 1
    assert len(data["geolocations"]) == 1


# ── Step 2: investigate.py GCS upload logic ───────────────────────────────────

def test_step2_investigate_uploads_report_to_gcs(local_report_file, gcs_storage):
    """
    Replicate the GCS upload block from investigate.py (now using uid/report_id.json)
    and confirm the blob lands in the bucket under the user's folder.
    """
    report_id = local_report_file.stem
    gcs_path = f"{FAKE_UID}/{report_id}.json"

    try:
        # ── exact logic from investigate.py ──────────────────────────────────
        gcs_bucket = os.getenv("GCS_BUCKET", "")
        report_path = local_report_file
        if gcs_bucket and report_path.exists():
            gcs_storage.upload(
                gcs_path,
                report_path.read_bytes(),
                {"content_type": "application/json"},
            )
        # ─────────────────────────────────────────────────────────────────────

        assert gcs_storage.exists(gcs_path), f"Blob must exist at {gcs_path}"

        downloaded = gcs_storage.download(gcs_path)
        assert json.loads(downloaded) == WRITER_OUTPUT, (
            "Downloaded blob must match what the writer tool wrote"
        )

        meta = gcs_storage.get_metadata(gcs_path)
        assert meta["size"] == local_report_file.stat().st_size, (
            "GCS object size must match local file size"
        )

        # Confirm the report is listed under the user's folder
        paths = gcs_storage.list(f"{FAKE_UID}/")
        assert gcs_path in paths, "Report must be listed under uid folder"

    finally:
        if gcs_storage.exists(gcs_path):
            gcs_storage.delete(gcs_path)


# ── Step 3: GET /reports/{id} reads from GCS ─────────────────────────────────

def test_step3_report_endpoint_reads_from_gcs(local_report_file, gcs_storage, report_client):
    """
    Full roundtrip: upload to GCS under uid folder, call GET /reports/{id},
    verify the response contains correctly parsed report content.
    """
    from unittest.mock import patch as _patch
    report_id = local_report_file.stem
    gcs_path = f"{FAKE_UID}/{report_id}.json"

    try:
        gcs_storage.upload(gcs_path, local_report_file.read_bytes(), {"content_type": "application/json"})

        with _patch.dict(os.environ, {"STORAGE_BACKEND": "gcs", "GCS_BUCKET": os.environ["GCS_BUCKET"]}):
            resp = report_client.get(f"/reports/{report_id}")

        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        body = resp.json()
        assert body["id"] == report_id
        assert body["name"] == WRITER_OUTPUT["metadata"]["title"]
        assert "Summary" in body["content"]
        assert "Detailed Analysis" in body["content"]
        assert len(body["geolocations"]) == 1
        assert body["geolocations"][0]["entity"] == "Test Entity"
        assert len(body["sources"]) == 1
        assert body["sources"][0]["title"] == "E2E Test Source"

    finally:
        if gcs_storage.exists(gcs_path):
            gcs_storage.delete(gcs_path)


# ── Full pipeline in one test ─────────────────────────────────────────────────

def test_full_pipeline_writer_to_gcs_to_api(local_report_file, gcs_storage, report_client):
    """
    Single test covering the complete pipeline:
      writer writes JSON → investigate uploads to {uid}/{report_id}.json → report API reads it.
    """
    from unittest.mock import patch as _patch
    report_id = local_report_file.stem
    full_id = f"{report_id}_full"
    gcs_path = f"{FAKE_UID}/{full_id}.json"

    try:
        # Step 1: local file intact (writer did its job)
        assert local_report_file.exists()
        assert json.loads(local_report_file.read_text())["metadata"]["title"] == WRITER_OUTPUT["metadata"]["title"]

        # Step 2: upload under uid folder (investigate.py logic)
        gcs_storage.upload(gcs_path, local_report_file.read_bytes(), {"content_type": "application/json"})
        assert gcs_storage.exists(gcs_path)

        # Confirm it's under the right user folder
        paths = gcs_storage.list(f"{FAKE_UID}/")
        assert gcs_path in paths

        # Step 3: retrieve via report API
        with _patch.dict(os.environ, {"STORAGE_BACKEND": "gcs", "GCS_BUCKET": os.environ["GCS_BUCKET"]}):
            resp = report_client.get(f"/reports/{full_id}")

        assert resp.status_code == 200
        body = resp.json()
        assert body["name"] == WRITER_OUTPUT["metadata"]["title"]
        assert body["content"] != ""
        assert isinstance(body["geolocations"], list)
        assert isinstance(body["sources"], list)

    finally:
        if gcs_storage.exists(gcs_path):
            gcs_storage.delete(gcs_path)
