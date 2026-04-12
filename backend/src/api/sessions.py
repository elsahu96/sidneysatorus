"""
Chat Session endpoints.

POST   /sessions                     — create a session
GET    /sessions                     — list sessions for the authenticated user
GET    /sessions/{id}                — get session metadata
GET    /sessions/{id}/context        — get the contextWindow (last N messages, fast read)
POST   /sessions/{id}/messages       — append a message
PATCH  /sessions/{id}/summary        — update the LLM-generated summary
POST   /sessions/{id}/archive        — manually trigger blob archival
"""

import logging
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator

from prisma import Prisma
from src.config import get_storage_service
from src.deps import get_db, get_db_optional
from src.service.auth import verify_token
from src.service.chat_session_service import ChatSessionService

app = APIRouter(prefix="/sessions", tags=["sessions"])
logger = logging.getLogger(__name__)


# ── Request / Response models ─────────────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    title: str = ""


class AppendMessageRequest(BaseModel):
    role: str
    content: str
    message_type: Literal["TEXT", "REPORT"] = "TEXT"
    report_ref: str | None = None  # Report ID or GCS blob path (REPORT messages only)
    metadata: dict[str, Any] | None = None

    @field_validator("role")
    @classmethod
    def role_must_be_valid(cls, v: str) -> str:
        if v not in ("USER", "ASSISTANT"):
            raise ValueError("role must be USER or ASSISTANT")
        return v

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("content must not be empty")
        return v


class UpdateSummaryRequest(BaseModel):
    summary: str


# ── Dependency: ChatSessionService ────────────────────────────────────────────

def get_chat_service(db: Prisma = Depends(get_db)) -> ChatSessionService:
    """Build a ChatSessionService injected with the active DB + storage backend."""
    return ChatSessionService(db=db, blob=get_storage_service())


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/", status_code=201)
async def create_session(
    body: CreateSessionRequest,
    user: dict = Depends(verify_token),
    service: ChatSessionService = Depends(get_chat_service),
):
    """Create a new chat session linked to the authenticated user."""
    # Resolve internal user ID from Firebase UID
    db_user = await _resolve_user(service._db, user["uid"], user["email"])
    return await service.create_session(user_id=db_user["id"], title=body.title)


@app.get("/")
async def list_sessions(
    user: dict = Depends(verify_token),
    db: Prisma | None = Depends(get_db_optional),
):
    """Returns the user's sessions. Degrades to an empty list when the DB is unavailable."""
    if db is None:
        return {"sessions": []}
    service = ChatSessionService(db=db, blob=get_storage_service())
    db_user = await _resolve_user(db, user["uid"], user["email"])
    sessions = await service.list_sessions(user_id=db_user["id"])
    return {"sessions": sessions}


@app.get("/{session_id}")
async def get_session(
    session_id: str,
    user: dict = Depends(verify_token),
    service: ChatSessionService = Depends(get_chat_service),
):
    session = await service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await _assert_ownership(service._db, session, user)
    return session


@app.get("/{session_id}/context")
async def get_context_window(
    session_id: str,
    user: dict = Depends(verify_token),
    service: ChatSessionService = Depends(get_chat_service),
):
    """Fast read of the last N messages via the contextWindow JSONB cache."""
    session = await service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await _assert_ownership(service._db, session, user)
    messages = await service.get_context_window(session_id)
    return {"session_id": session_id, "messages": messages}


@app.post("/{session_id}/messages", status_code=201)
async def append_message(
    session_id: str,
    body: AppendMessageRequest,
    user: dict = Depends(verify_token),
    service: ChatSessionService = Depends(get_chat_service),
):
    session = await service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await _assert_ownership(service._db, session, user)
    message = await service.append_message(
        session_id=session_id,
        role=body.role,
        content=body.content,
        message_type=body.message_type,
        report_ref=body.report_ref,
        metadata=body.metadata,
    )
    return message


@app.patch("/{session_id}/summary")
async def update_summary(
    session_id: str,
    body: UpdateSummaryRequest,
    user: dict = Depends(verify_token),
    service: ChatSessionService = Depends(get_chat_service),
):
    session = await service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await _assert_ownership(service._db, session, user)
    return await service.update_summary(session_id, body.summary)


@app.delete("/{session_id}", status_code=204)
async def delete_session(
    session_id: str,
    user: dict = Depends(verify_token),
    service: ChatSessionService = Depends(get_chat_service),
):
    """Permanently delete a session and all its messages."""
    session = await service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await _assert_ownership(service._db, session, user)
    await service.delete_session(session_id)


@app.post("/{session_id}/archive")
async def trigger_archive(
    session_id: str,
    user: dict = Depends(verify_token),
    service: ChatSessionService = Depends(get_chat_service),
):
    """Manually trigger blob archival for a session."""
    session = await service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await _assert_ownership(service._db, session, user)
    blob_path = await service.archive_to_blob(session_id)
    return {"blob_pointer": blob_path}


# ── Private helpers ───────────────────────────────────────────────────────────

async def _resolve_user(db: Prisma, firebase_uid: str, email: str) -> dict[str, Any]:
    from src.service.db import create_or_get_user
    return await create_or_get_user(db, firebase_uid=firebase_uid, email=email)


async def _assert_ownership(db: Prisma, session: dict[str, Any], user: dict) -> None:
    """Raise 403 if the session's user_id doesn't match the authenticated user."""
    session_user_id = session.get("userId")
    if session_user_id is None:
        return  # Legacy session with no user — allow access
    db_user = await _resolve_user(db, user["uid"], user["email"])
    if db_user["id"] != session_user_id:
        raise HTTPException(status_code=403, detail="Access denied")
