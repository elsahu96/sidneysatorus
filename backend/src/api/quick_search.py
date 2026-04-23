"""
Quick Search endpoint — single-model AI response, no multi-agent pipeline.

POST /quick_search
  Body: {"query": "<question>"}
  Returns: SSE stream of text chunks, then a final {"type": "done"} event.

Suitable for fast lookups; skips planning/research/writer agents entirely.
"""

import json
import logging
import os
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from src.graph.prompts.prompts import QUICK_SEARCH_RESEARCH_AGENT_PROMPT
from src.service.auth import verify_token

app = APIRouter()
logger = logging.getLogger(__name__)
_GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
_MODEL_NAME = os.getenv("ANTHROPIC_MODEL_NAME", "claude-opus-4-7")


def _model_name_for_genai(name: str) -> str:
    """Strip 'google_genai:' prefix used by LangChain if present."""
    return name.removeprefix("google_genai:")


class QuickSearchRequest(BaseModel):
    query: str


@app.post("/quick_search")
async def quick_search(
    body: QuickSearchRequest,
    user: dict = Depends(verify_token),
):
    """Stream a quick AI answer for the given query."""
    query = body.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    logger.info("POST /quick_search uid=%s query_len=%d", user["uid"], len(query))

    async def generate():
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=_GEMINI_API_KEY)
            model = _model_name_for_genai(_MODEL_NAME)

            system_prompt = QUICK_SEARCH_RESEARCH_AGENT_PROMPT.format(
                current_date=date.today().isoformat()
            )

            response = await client.aio.models.generate_content_stream(
                model=model,
                contents=query,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.4,
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(
                        disable=True,
                    ),
                ),
            )

            async for chunk in response:
                text = chunk.text
                if text:
                    payload = json.dumps({"type": "chunk", "text": text})
                    yield f"data: {payload}\n\n"

            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as exc:
            logger.exception("quick_search failed uid=%s", user["uid"])
            yield f"data: {json.dumps({'type': 'error', 'detail': str(exc)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
