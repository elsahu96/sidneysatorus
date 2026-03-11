import asyncio
import logging
from dotenv import load_dotenv

load_dotenv()

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.graph.flow import run_with_hitl

app = APIRouter()

logger = logging.getLogger(__name__)


class InvestigateRequest(BaseModel):
    query: str


@app.post("/investigate")
async def investigate(request: InvestigateRequest):
    query = request.query
    logger.info("POST /investigate query_len=%d", len(query or ""))

    if not query or not query.strip():
        logger.warning("POST /investigate: empty query rejected")
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: run_with_hitl(
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

    logger.info(
        "POST /investigate: done md=%s json=%s",
        result["md_path"],
        result["json_path"],
    )
    return {"md_path": result["md_path"], "json_path": result["json_path"]}


if __name__ == "__main__":
    result = run_with_hitl(
        task="What intelligence justified the pre-emptive strikes on Iran?",
        thread_id="investigation-workflow-1",
        auto_approve=False,
    )
    print(result)
