import json
import logging
import os
import pathlib
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()
from fastapi import APIRouter, HTTPException
from src.models.report import Report

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


@app.get("/")
async def list_reports():
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
async def get_report(report_id: str):
    report_dir = _report_dir()
    json_path = report_dir / f"{report_id}.json"

    if not json_path.exists():
        raise HTTPException(status_code=404, detail=f"Report not found: {report_id}")

    with json_path.open(encoding="utf-8") as f:
        data = json.load(f)

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

    # Sources may be at the top level (current writer) or nested under report (older format)
    raw_sources = data.get("sources") or report_section.get("sources", [])
    sources = [
        {
            "title": s.get("title", ""),
            "url": s.get("url", ""),
            "date": s.get("date", ""),
            "key_insight": s.get("key_insight", ""),
        }
        for s in raw_sources
    ]

    return {
        "id": report_id,
        "name": metadata.get("title", report_id),
        "content": "\n\n".join(content_parts),
        "geolocations": data.get("geolocations", []),
        "sources": sources,
        "mime_type": "application/json",
        "created_at": metadata.get("written_at"),
    }
