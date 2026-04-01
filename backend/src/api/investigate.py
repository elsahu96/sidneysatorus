import logging
import multiprocessing
import uuid
import asyncio
import logging
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from src.models.report import Report
from src.deps import get_data_factory, DataFactory
from src.service.db import get_or_create_team_for_user, create_case_file
from src.service.auth import verify_token

app = APIRouter()
logger = logging.getLogger(__name__)

# thread_id → asyncio subprocess handle
_active: dict[str, asyncio.subprocess.Process] = {}

# Path to the runner script (same Python interpreter, same working directory)
_RUNNER = str(Path(__file__).resolve().parents[2] / "src" / "service" / "investigate_runner.py")


class InvestigateRequest(BaseModel):
    query: str
    thread_id: str | None = None


@app.post("/investigate")
async def investigate(
    request: InvestigateRequest,
    user=Depends(verify_token),
    factory: DataFactory = Depends(get_data_factory),
):
    query = request.query
    thread_id = request.thread_id or str(uuid.uuid4())
    logger.info("POST /investigate thread_id=%s uid=%s", thread_id, user["uid"])

    if not query or not query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    proc = await asyncio.create_subprocess_exec(
        sys.executable, _RUNNER,
        "--query", query,
        "--thread-id", thread_id,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _active[thread_id] = proc

    try:
        stdout, stderr = await proc.communicate()
    except asyncio.CancelledError:
        proc.kill()
        await proc.wait()
        logger.info("Investigation killed thread_id=%s", thread_id)
        raise HTTPException(status_code=499, detail="Investigation cancelled by client")
    finally:
        _active.pop(thread_id, None)

    if proc.returncode != 0:
        err = stderr.decode(errors="replace").strip()
        logger.error("Investigation subprocess failed thread_id=%s: %s", thread_id, err[-500:])
        raise HTTPException(status_code=500, detail="Writer agent did not produce output files")

    # The runner prints diagnostics then the json_path as the final line
    raw_stdout = stdout.decode().strip()
    result = raw_stdout.split("\n")[-1].strip()
    if not result:
        raise HTTPException(status_code=500, detail="Writer agent did not produce output files")

    report_id = result.split("/")[-1].split(".")[0]
    logger.info("POST /investigate done report_id=%s thread_id=%s", report_id, thread_id)

    # Upload report JSON to GCS if configured — stored under the user's UID folder
    if os.getenv("STORAGE_BACKEND") == "gcs":
        try:
            from src.storage_factory import GCSDocumentStorage
            gcs_bucket = os.getenv("GCS_BUCKET", "")
            report_path = Path(result)
            if gcs_bucket and report_path.exists():
                storage = GCSDocumentStorage(bucket_name=gcs_bucket)
                gcs_path = f"{user['uid']}/{report_id}.json"
                storage.upload(
                    gcs_path,
                    report_path.read_bytes(),
                    {"content_type": "application/json"},
                )
                logger.info("Uploaded report to GCS: %s", gcs_path)
        except Exception:
            logger.exception("Failed to upload report to GCS for report_id=%s", report_id)

    try:
        db = await factory.relational.get_client()
        team_id = await get_or_create_team_for_user(
            db,
            firebase_uid=user["uid"],
            email=user["email"],
        )
        await create_case_file(
            db,
            team_id=team_id,
            subject=query,
            messages=[{"role": "USER", "content": query}],
            case_number=report_id,
            category="investigation",
        )
    except Exception:
        logger.exception("Failed to persist case file for report_id=%s", report_id)

    return Report(
        id=report_id,
        name=report_id,
        storage_path=result,
        mime_type="text/markdown",
        created_at=datetime.now(),
    )


@app.delete("/investigate/{thread_id}", status_code=204)
async def cancel_investigation(thread_id: str, user=Depends(verify_token)):
    proc = _active.get(thread_id)
    if not proc:
        raise HTTPException(status_code=404, detail="No active investigation with that ID")
    proc.kill()
    logger.info("Sent SIGKILL to investigation thread_id=%s uid=%s", thread_id, user["uid"])
