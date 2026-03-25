import asyncio
import logging
from fastapi import HTTPException
from datetime import datetime
from src.models.report import Report

logger = logging.getLogger(__name__)


async def investigate(query: str):
    logger.info("Investigate service: query_len=%d", len(query or ""))

    if not query or not query.strip():
        logger.warning("Investigate service: empty query rejected")
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
        logger.error("Investigate service: writer agent produced no output files")
        raise HTTPException(
            status_code=500,
            detail="Writer agent did not produce output files",
        )

    report_id = result.split("/")[-1].split(".")[0]
    logger.info("Investigate service: done report_id=%s path=%s", report_id, result)
    return Report(
        id=report_id,
        name=report_id,
        storage_path=result,
        mime_type="text/markdown",
        created_at=datetime.now(),
    )


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


if __name__ == "__main__":
    result = _run_with_hitl(
        task="What intelligence justified the pre-emptive strikes on Iran?",
        thread_id="investigation-workflow-1",
        auto_approve=False,
    )
    print(result)
