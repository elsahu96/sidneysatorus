import json
import logging
import os
import sys
import uuid
import asyncio
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from src.deps import get_data_factory, DataFactory
from src.service.db import get_or_create_team_for_user, create_case_file
from src.service.auth import verify_token

app = APIRouter()
logger = logging.getLogger(__name__)

_RUNNER = str(
    Path(__file__).resolve().parents[2] / "src" / "service" / "investigate_runner.py"
)

# thread_id → subprocess
_active: dict[str, asyncio.subprocess.Process] = {}
# thread_id → asyncio.Queue of SSE event dicts
_event_queues: dict[str, asyncio.Queue] = {}
# thread_id → asyncio.Queue for receiving user HITL decisions (bool)
_hitl_decision_queues: dict[str, asyncio.Queue] = {}

_SSE_HEARTBEAT_INTERVAL = 15  # seconds
_HITL_TIMEOUT = 300  # 5 min to respond to HITL prompt


class InvestigateRequest(BaseModel):
    query: str
    thread_id: str | None = None


class HitlDecisionRequest(BaseModel):
    approved: bool
    edited_content: str | None = None
    additional_urls: list[str] | None = None


async def _drain_stderr(proc: asyncio.subprocess.Process, thread_id: str) -> None:
    """Read and log stderr so the subprocess doesn't block on a full pipe."""
    assert proc.stderr is not None
    while True:
        line = await proc.stderr.readline()
        if not line:
            break
        logger.warning(
            "investigate stderr [%s]: %s",
            thread_id,
            line.decode(errors="replace").rstrip(),
        )


async def _run_investigation(
    thread_id: str,
    query: str,
    uid: str,
    email: str,
    factory: DataFactory,
) -> None:
    """Background task: read subprocess stdout line by line, route events to SSE queue."""
    proc = _active.get(thread_id)
    event_queue = _event_queues.get(thread_id)
    hitl_queue = _hitl_decision_queues.get(thread_id)

    if proc is None or event_queue is None:
        if event_queue:
            await event_queue.put({"type": "error", "detail": "Process not found"})
        return

    assert proc.stdout is not None
    assert proc.stdin is not None

    # Drain stderr concurrently so it never blocks the subprocess
    asyncio.create_task(_drain_stderr(proc, thread_id))

    json_path = ""
    cancelled = False

    try:
        while True:
            line_bytes = await proc.stdout.readline()
            if not line_bytes:
                break
            line = line_bytes.decode(errors="replace").strip()
            if not line:
                continue

            if line.startswith("PROGRESS:"):
                agent = line[9:]
                logger.info(
                    "Investigation progress thread_id=%s agent=%s", thread_id, agent
                )
                await event_queue.put({"type": "progress", "agent": agent})

            elif line.startswith("HITL:"):
                try:
                    data = json.loads(line[5:])
                except json.JSONDecodeError:
                    data = {"agent": "unknown", "description": ""}
                logger.info(
                    "Investigation HITL thread_id=%s agent=%s",
                    thread_id,
                    data.get("agent"),
                )
                await event_queue.put({"type": "hitl", **data})

                # Wait for user decision
                try:
                    if hitl_queue:
                        decision_data = await asyncio.wait_for(
                            hitl_queue.get(), timeout=_HITL_TIMEOUT
                        )
                    else:
                        decision_data = {
                            "approved": True
                        }  # fallback auto-approve if no queue
                except asyncio.TimeoutError:
                    logger.warning(
                        "HITL timed out for thread_id=%s — auto-approving", thread_id
                    )
                    decision_data = {"approved": True}

                if not isinstance(decision_data, dict):
                    decision_data = {"approved": bool(decision_data)}

                decision = json.dumps(decision_data) + "\n"
                proc.stdin.write(decision.encode())
                await proc.stdin.drain()

                if not decision_data.get("approved"):
                    cancelled = True
                    # Let subprocess finish naturally after rejection
                    break

            elif line.startswith("RESULT:"):
                json_path = line[7:]
                logger.info(
                    "Investigation result thread_id=%s json_path=%s",
                    thread_id,
                    json_path,
                )

            elif line.startswith("ERROR:"):
                error_detail = line[6:]
                logger.error(
                    "Investigation subprocess error thread_id=%s: %s",
                    thread_id,
                    error_detail,
                )
                await event_queue.put({"type": "error", "detail": error_detail})
                return

            elif line == "CANCELLED":
                cancelled = True

    except asyncio.CancelledError:
        proc.kill()
        await proc.wait()
        await event_queue.put({"type": "error", "detail": "Investigation cancelled"})
        return
    except Exception as exc:
        logger.exception("Unexpected error in investigation thread_id=%s", thread_id)
        await event_queue.put({"type": "error", "detail": str(exc)})
        return
    finally:
        _active.pop(thread_id, None)

    await proc.wait()

    if cancelled:
        await event_queue.put({"type": "stopped"})
        return

    if proc.returncode != 0:
        await event_queue.put(
            {"type": "error", "detail": "Writer agent did not produce output files"}
        )
        return

    if not json_path:
        await event_queue.put(
            {"type": "error", "detail": "Writer agent did not produce output files"}
        )
        return

    report_id = json_path.split("/")[-1].split(".")[0]

    # Upload to GCS if configured
    if os.getenv("STORAGE_BACKEND") == "gcs":
        try:
            from src.storage_factory import GCSDocumentStorage

            gcs_bucket = os.getenv("GCS_BUCKET", "")
            report_path = Path(json_path)
            if gcs_bucket and report_path.exists():
                storage = GCSDocumentStorage(bucket_name=gcs_bucket)
                gcs_path = f"{uid}/{report_id}.json"
                storage.upload(
                    gcs_path,
                    report_path.read_bytes(),
                    {"content_type": "application/json"},
                )
                logger.info("Uploaded report to GCS: %s", gcs_path)
        except Exception:
            logger.exception(
                "Failed to upload report to GCS for report_id=%s", report_id
            )

    # Persist case file
    try:
        db = await factory.relational.get_client()
        team_id = await get_or_create_team_for_user(db, firebase_uid=uid, email=email)
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

    await event_queue.put(
        {"type": "completed", "report_id": report_id, "storage_path": json_path}
    )


@app.post("/investigate")
async def start_investigate(
    request: InvestigateRequest,
    user=Depends(verify_token),
    factory: DataFactory = Depends(get_data_factory),
):
    query = request.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    thread_id = request.thread_id or str(uuid.uuid4())
    logger.info("POST /investigate thread_id=%s uid=%s", thread_id, user["uid"])

    proc = await asyncio.create_subprocess_exec(
        sys.executable,
        _RUNNER,
        "--query",
        query,
        "--thread-id",
        thread_id,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        limit=10 * 1024 * 1024,  # 10 MB — default 64 KB is too small for large HITL payloads
    )
    _active[thread_id] = proc
    _event_queues[thread_id] = asyncio.Queue()
    _hitl_decision_queues[thread_id] = asyncio.Queue()

    asyncio.create_task(
        _run_investigation(thread_id, query, user["uid"], user["email"], factory)
    )

    return {"thread_id": thread_id, "status": "started"}


@app.post("/investigate/{thread_id}/decision")
async def hitl_decision(
    thread_id: str,
    body: HitlDecisionRequest,
    user=Depends(verify_token),
):
    """Receive user's HITL approve/reject decision."""
    queue = _hitl_decision_queues.get(thread_id)
    if queue is None:
        raise HTTPException(
            status_code=404, detail="No active investigation with that ID"
        )
    await queue.put(body.model_dump(exclude_none=True))
    return {"status": "ok"}


@app.get("/investigate/{thread_id}/stream")
async def stream_investigation(thread_id: str, user=Depends(verify_token)):
    """SSE stream: heartbeats + progress/hitl/completed/error events."""

    async def event_generator():
        event_queue = _event_queues.get(thread_id)
        if event_queue is None:
            yield f"data: {json.dumps({'type': 'error', 'detail': 'Investigation not found'})}\n\n"
            return

        try:
            while True:
                try:
                    event = await asyncio.wait_for(
                        event_queue.get(), timeout=_SSE_HEARTBEAT_INTERVAL
                    )
                    yield f"data: {json.dumps(event)}\n\n"
                    if event.get("type") in ("completed", "error", "stopped"):
                        _event_queues.pop(thread_id, None)
                        _hitl_decision_queues.pop(thread_id, None)
                        return
                except asyncio.TimeoutError:
                    yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
        except asyncio.CancelledError:
            pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.delete("/investigate/{thread_id}", status_code=204)
async def cancel_investigation(thread_id: str, user=Depends(verify_token)):
    proc = _active.get(thread_id)
    if not proc:
        raise HTTPException(
            status_code=404, detail="No active investigation with that ID"
        )
    proc.kill()
    logger.info(
        "Sent SIGKILL to investigation thread_id=%s uid=%s", thread_id, user["uid"]
    )
