import asyncio
import json
import logging
import os
import pathlib
from dotenv import load_dotenv

load_dotenv()

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from src.models.report import Report
from datetime import datetime

app = APIRouter()

logger = logging.getLogger(__name__)


class InvestigateRequest(BaseModel):
    query: str


def _run_with_hitl(task: str, thread_id: str, auto_approve: bool):
    """Import lazily so API startup doesn't fail on optional runtime deps."""
    try:
        from src.graph.flow import run_with_hitl
    except ModuleNotFoundError as exc:
        if exc.name == "deepagents":
            logger.exception("Missing dependency 'deepagents' for investigation flow")
            raise HTTPException(
                status_code=503,
                detail=(
                    "Investigation service dependency is missing. "
                    "Install backend dependencies and run with `uv run`."
                ),
            ) from exc
        raise

    return run_with_hitl(task=task, thread_id=thread_id, auto_approve=auto_approve)


@app.post("/investigate")
async def investigate(request: InvestigateRequest):
    # return Report(
    #     id="operation_epic_fury_report_20260313_023911",
    #     name="Operation Epic Fury Report",
    #     storage_path="/Users/elsahu/projects/sidneybysatorus-endeavour-main/reports/operation_epic_fury_report_20260313_023911.json",
    #     mime_type="application/json",
    #     created_at=datetime.now(),
    # )

    query = request.query
    logger.info("POST /investigate query_len=%d", len(query or ""))

    if not query or not query.strip():
        logger.warning("POST /investigate: empty query rejected")
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: _run_with_hitl(
            task=query,
            thread_id="investigation-workflow-1",
            auto_approve=True,
        ),
    )

    if not result:
        logger.error("POST /investigate: writer agent produced no output files")
        raise HTTPException(
            status_code=500,
            detail="Writer agent did not produce output files",
        )

    report_id = result.split("/")[-1].split(".")[0]
    logger.info("POST /investigate: done report_id=%s path=%s", report_id, result)
    return Report(
        id=report_id,
        name=report_id,
        storage_path=result,
        mime_type="text/markdown",
        created_at=datetime.now(),
    )


if __name__ == "__main__":
    result = _run_with_hitl(
        task="What intelligence justified the pre-emptive strikes on Iran?",
        thread_id="investigation-workflow-1",
        auto_approve=False,
    )
    print(result)
