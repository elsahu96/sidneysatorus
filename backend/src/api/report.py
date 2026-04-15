import json
import logging
import os
import pathlib
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()
from fastapi import APIRouter, Depends, HTTPException
from src.models.report import Report
from src.service.auth import verify_token

app = APIRouter(prefix="/reports", tags=["reports"])

logger = logging.getLogger(__name__)

_PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[3]
_DEFAULT_REPORT_DIR = _PROJECT_ROOT / "reports"


def _report_dir() -> pathlib.Path:
    env = os.environ.get("REPORT_OUTPUT_DIR")
    if not env:
        return _DEFAULT_REPORT_DIR

    candidate = pathlib.Path(env).expanduser()
    if not candidate.is_absolute():
        candidate = (_PROJECT_ROOT / candidate).resolve()
    else:
        candidate = candidate.resolve()

    if candidate != _PROJECT_ROOT and _PROJECT_ROOT not in candidate.parents:
        logger.warning("Ignoring REPORT_OUTPUT_DIR outside project root: %s", candidate)
        return _DEFAULT_REPORT_DIR

    return candidate


def _use_gcs() -> bool:
    return os.getenv("STORAGE_BACKEND") == "gcs"


def _gcs_storage():
    from src.storage_factory import GCSDocumentStorage

    bucket = os.getenv("GCS_BUCKET", "")
    if not bucket:
        raise ValueError("GCS_BUCKET env var is required when STORAGE_BACKEND=gcs")
    return GCSDocumentStorage(bucket_name=bucket)


def _parse_report_json(data: dict) -> dict:
    metadata = data.get("metadata", {})
    report_section = data.get("report", {})

    content_parts = []
    if summary := report_section.get("summary"):
        content_parts.append(f"## Summary\n\n{summary}")
    if methodology := report_section.get("methodology"):
        content_parts.append(f"## Methodology\n\n{methodology}")
    if analysis := report_section.get("detailed_analysis"):
        content_parts.append(f"## Detailed Analysis\n\n{analysis}")
    if risk_factors := report_section.get("risk_factors"):
        risks = "\n".join(f"- {r}" for r in risk_factors)
        content_parts.append(f"## Risk Factors\n\n{risks}")

    raw_sources = data.get("sources") or report_section.get("sources", [])
    sources = []
    for s in raw_sources:
        source: dict = {
            "title": s.get("title", ""),
            "url": s.get("url", ""),
            "date": s.get("date", ""),
            "key_insight": s.get("key_insight", ""),
        }
        if "grade" in s:
            source["grade"] = s["grade"]
        if "composite_score" in s:
            source["composite_score"] = s["composite_score"]
        if "factor_scores" in s:
            source["factor_scores"] = s["factor_scores"]
        if "analyst_signals" in s:
            source["analyst_signals"] = s["analyst_signals"]
        if s.get("source_name"):
            source["source_name"] = s["source_name"]
        sources.append(source)

    return {
        "name": metadata.get("title", ""),
        "content": "\n\n".join(content_parts),
        "geolocations": data.get("geolocations", []),
        "sources": sources,
        "created_at": metadata.get("written_at"),
    }


@app.get("/")
async def list_reports(user=Depends(verify_token)):
    uid = user["uid"]

    if _use_gcs():
        try:
            storage = _gcs_storage()
            paths = storage.list(f"{uid}/")
            reports = []
            for path in sorted(paths, reverse=True):
                report_id = pathlib.Path(path).stem
                try:
                    raw = json.loads(storage.download(path))
                    title = raw.get("metadata", {}).get("title", report_id)
                    written_at = raw.get("metadata", {}).get("written_at")
                    created = (
                        datetime.fromisoformat(written_at)
                        if written_at
                        else datetime.now()
                    )
                except Exception:
                    title = report_id
                    created = datetime.now()
                reports.append(
                    Report(
                        id=report_id,
                        name=title,
                        storage_path=path,
                        mime_type="application/json",
                        created_at=created,
                    )
                )
            return {"reports": reports}
        except Exception:
            logger.exception("Failed to list reports from GCS for uid=%s", uid)
            return {"reports": []}

    report_dir = _report_dir()
    reports = []
    if report_dir.exists():
        for json_file in sorted(report_dir.glob("*.json"), reverse=True):
            report_id = json_file.stem
            try:
                with json_file.open(encoding="utf-8") as f:
                    data = json.load(f)
                title = data.get("metadata", {}).get("title", report_id)
                written_at = data.get("metadata", {}).get("written_at")
                created = (
                    datetime.fromisoformat(written_at) if written_at else datetime.now()
                )
            except Exception:
                title = report_id
                created = datetime.now()
            reports.append(
                Report(
                    id=report_id,
                    name=title,
                    storage_path=str(json_file),
                    mime_type="application/json",
                    created_at=created,
                )
            )
    return {"reports": reports}


@app.get("/{report_id}")
async def get_report(report_id: str, user=Depends(verify_token)):
    uid = user["uid"]

    if _use_gcs():
        try:
            storage = _gcs_storage()
            raw_bytes = storage.download(f"{uid}/{report_id}.json")
            data = json.loads(raw_bytes)
            parsed = _parse_report_json(data)
            return {"id": report_id, "mime_type": "application/json", **parsed}
        except Exception:
            logger.warning(
                "Report %s not found in GCS for uid=%s, falling back to local",
                report_id,
                uid,
            )

    report_dir = _report_dir()
    json_path = report_dir / f"{report_id}.json"

    if not json_path.exists():
        raise HTTPException(status_code=404, detail=f"Report not found: {report_id}")

    with json_path.open(encoding="utf-8") as f:
        data = json.load(f)

    parsed = _parse_report_json(data)
    return {"id": report_id, "mime_type": "application/json", **parsed}
