"""
Chat Session Service — hot/cold hybrid storage for LLM conversations.

Architecture:
- PostgreSQL (hot): last WINDOW_SIZE messages + contextWindow JSONB cache
- Blob storage (cold): full JSON archive written when ARCHIVE_THRESHOLD is reached
- Atomic session creation via Prisma transactions
- SHA-256 checksum embedded in every archive for integrity verification

Usage:
    from src.service.chat_session_service import ChatSessionService
    service = ChatSessionService(db=prisma_client, blob=storage_service)
    session = await service.create_session(user_id="u1", title="Iran OSINT")
    msg = await service.append_message(session["id"], role="USER", content="What happened?")
    window = await service.get_context_window(session["id"])
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any

from prisma import Json, Prisma

from src.service.storage import StorageService

logger = logging.getLogger(__name__)

WINDOW_SIZE: int = int(os.getenv("CHAT_WINDOW_SIZE", "20"))
ARCHIVE_THRESHOLD: int = int(os.getenv("CHAT_ARCHIVE_THRESHOLD", "50"))

_VALID_ROLES = frozenset({"USER", "ASSISTANT"})


def _serialise_message(m: Any) -> dict[str, Any]:
    """
    Convert a Prisma Message model to a plain dict safe for JSON storage.
    Converts datetime fields to ISO-8601 strings so they survive JSONB round-trips.
    """
    d = m.model_dump()
    for k, v in d.items():
        if hasattr(v, "isoformat"):       # datetime / date
            d[k] = v.isoformat()
    return d


# ── Interface (Adapter / Dependency-Inversion boundary) ───────────────────────

class ChatStorageInterface(ABC):
    """
    Swap the concrete provider (PostgresBlobProvider) for any future backend
    (e.g., DynamoDB + S3) without touching API controllers.
    """

    @abstractmethod
    async def create_session(self, user_id: str | None = None, title: str = "") -> dict[str, Any]:
        """Create a new chat session. Returns the session record."""

    @abstractmethod
    async def get_session(self, session_id: str) -> dict[str, Any] | None:
        """Fetch a session by ID, or None if not found."""

    @abstractmethod
    async def list_sessions(self, user_id: str) -> list[dict[str, Any]]:
        """List all sessions belonging to a user, newest first."""

    @abstractmethod
    async def append_message(
        self,
        session_id: str,
        role: str,
        content: str,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Append a message to the session. Refreshes the contextWindow JSONB cache.
        Triggers blob archival + PG trim when total messages exceed ARCHIVE_THRESHOLD.
        """

    @abstractmethod
    async def get_context_window(self, session_id: str) -> list[dict[str, Any]]:
        """
        Fast read of the last WINDOW_SIZE messages via the contextWindow JSONB
        column — no table JOIN required.
        """

    @abstractmethod
    async def archive_to_blob(self, session_id: str) -> str:
        """
        Serialize the full PG message history to a JSON file in blob storage.
        Updates blobPointer on the session. Returns the blob path.
        """

    @abstractmethod
    async def update_summary(self, session_id: str, summary: str) -> dict[str, Any]:
        """Persist an LLM-generated session summary."""


# ── Concrete PostgreSQL + Blob implementation ─────────────────────────────────

class ChatSessionService(ChatStorageInterface):
    """
    PostgresBlobProvider — the production implementation of ChatStorageInterface.

    Hot path  : PostgreSQL (messages table + contextWindow JSONB)
    Cold path : Blob storage JSON archive  (GCS in prod / local in dev)
    """

    def __init__(self, db: Prisma, blob: StorageService) -> None:
        self._db = db
        self._blob = blob

    # ── Session lifecycle ─────────────────────────────────────────────────────

    async def create_session(self, user_id: str | None = None, title: str = "") -> dict[str, Any]:
        """
        Atomically create a session with an empty contextWindow.
        Idempotency: caller should pass a deterministic ID if retry-safe creation
        is needed (the cuid() default is random, so retries produce new sessions).
        """
        logger.info("create_session user_id=%s title=%s", user_id, title)
        async with self._db.tx() as tx:
            session = await tx.chatsession.create(
                data={
                    "userId": user_id,
                    "title": title,
                    "contextWindow": Json([]),
                }
            )
        logger.info("create_session id=%s user_id=%s", session.id, user_id)
        return session.model_dump()

    async def get_session(self, session_id: str) -> dict[str, Any] | None:
        session = await self._db.chatsession.find_unique(where={"id": session_id})
        return session.model_dump() if session else None

    async def list_sessions(self, user_id: str) -> list[dict[str, Any]]:
        sessions = await self._db.chatsession.find_many(
            where={"userId": user_id},
            order={"updatedAt": "desc"},
        )
        return [s.model_dump() for s in sessions]

    async def update_summary(self, session_id: str, summary: str) -> dict[str, Any]:
        session = await self._db.chatsession.update(
            where={"id": session_id},
            data={"summary": summary},
        )
        return session.model_dump()

    async def delete_session(self, session_id: str) -> None:
        """Delete a session. Messages are removed automatically via DB-level CASCADE."""
        await self._db.chatsession.delete(where={"id": session_id})
        logger.info("delete_session id=%s", session_id)

    # ── Message append (hot path) ─────────────────────────────────────────────

    async def append_message(
        self,
        session_id: str,
        role: str,
        content: str,
        message_type: str = "TEXT",
        report_ref: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        1. Validate role.
        2. Insert into messages table (TEXT or REPORT type).
        3. Refresh contextWindow JSONB = last WINDOW_SIZE messages (ISO-serialised).
        4. If total > ARCHIVE_THRESHOLD: archive to blob, trim PG.
        Logs storage latency and token count for observability.
        """
        if role not in _VALID_ROLES:
            raise ValueError(f"Invalid role {role!r}. Must be one of {sorted(_VALID_ROLES)}")

        t0 = time.monotonic()

        # Extract token_count from metadata before storing (kept as a top-level column)
        token_count: int | None = None
        msg_data: dict[str, Any] = {
            "chatSessionId": session_id,
            "role": role,
            "messageType": message_type,
            "content": content,
        }
        if report_ref is not None:
            msg_data["reportRef"] = report_ref
        if metadata:
            token_count = metadata.pop("token_count", None)
            if metadata:
                msg_data["metadata"] = Json(metadata)
        if token_count is not None:
            msg_data["tokenCount"] = token_count

        message = await self._db.message.create(data=msg_data)

        # Refresh contextWindow JSONB — serialise datetimes to ISO strings explicitly
        # so the JSONB column never contains bare Python datetime objects.
        recent = await self._db.message.find_many(
            where={"chatSessionId": session_id},
            order={"createdAt": "desc"},
            take=WINDOW_SIZE,
        )
        window = [_serialise_message(m) for m in reversed(recent)]

        total = await self._db.message.count(where={"chatSessionId": session_id})

        await self._db.chatsession.update(
            where={"id": session_id},
            data={"contextWindow": Json(window)},
        )

        latency_ms = (time.monotonic() - t0) * 1000
        logger.info(
            "append_message session=%s role=%s type=%s token_count=%s total_msgs=%d latency_ms=%.1f",
            session_id, role, message_type, token_count, total, latency_ms,
        )

        # Archive + trim when conversation grows beyond threshold
        if total > ARCHIVE_THRESHOLD:
            await self._archive_and_trim(session_id)

        return _serialise_message(message)

    # ── Context window (fast read) ────────────────────────────────────────────

    async def get_context_window(self, session_id: str) -> list[dict[str, Any]]:
        """
        Reads contextWindow JSONB directly from the sessions row — single lookup,
        no JOIN, no ORDER BY. Falls back to a messages query if the cache is stale.
        """
        t0 = time.monotonic()
        session = await self._db.chatsession.find_unique(where={"id": session_id})
        latency_ms = (time.monotonic() - t0) * 1000
        logger.debug("get_context_window session=%s latency_ms=%.1f", session_id, latency_ms)

        if not session:
            return []

        cached: list | None = session.contextWindow  # type: ignore[assignment]
        if cached is not None:
            return cached

        # Cache miss — rebuild from messages table and persist
        return await self._rebuild_context_window(session_id)

    # ── Blob archival (cold path) ─────────────────────────────────────────────

    async def archive_to_blob(self, session_id: str) -> str:
        """
        Dump full PG message history to `chat_archives/{session_id}.json`.
        Embeds a SHA-256 checksum for integrity verification on restore.
        Updates blobPointer on the session record.
        """
        t0 = time.monotonic()

        messages = await self._db.message.find_many(
            where={"chatSessionId": session_id},
            order={"createdAt": "asc"},
        )

        # Build payload, compute checksum over the messages list only
        messages_payload = [_serialise_message(m) for m in messages]
        inner_bytes = json.dumps(messages_payload, default=str).encode()
        checksum = hashlib.sha256(inner_bytes).hexdigest()

        archive = {
            "session_id": session_id,
            "archived_at": datetime.now(timezone.utc).isoformat(),
            "message_count": len(messages),
            "checksum_sha256": checksum,
            "messages": messages_payload,
        }

        blob_path = f"chat_archives/{session_id}.json"
        await self._blob.write_bytes(
            blob_path,
            json.dumps(archive, default=str).encode(),
            content_type="application/json",
        )

        await self._db.chatsession.update(
            where={"id": session_id},
            data={"blobPointer": blob_path},
        )

        latency_ms = (time.monotonic() - t0) * 1000
        logger.info(
            "archive_to_blob session=%s msgs=%d path=%s checksum=%s... latency_ms=%.1f",
            session_id, len(messages), blob_path, checksum[:12], latency_ms,
        )
        return blob_path

    # ── Private helpers ───────────────────────────────────────────────────────

    async def _archive_and_trim(self, session_id: str) -> None:
        """Archive to blob then trim messages beyond WINDOW_SIZE from PG."""
        try:
            await self.archive_to_blob(session_id)
            await self._trim_old_messages(session_id)
        except Exception:
            logger.exception("_archive_and_trim failed for session=%s — messages preserved in PG", session_id)

    async def _trim_old_messages(self, session_id: str) -> int:
        """
        Delete messages older than the last WINDOW_SIZE from the messages table.
        They are preserved in blob storage. Returns the count deleted.
        """
        all_msgs = await self._db.message.find_many(
            where={"chatSessionId": session_id},
            order={"createdAt": "asc"},
        )
        to_delete = all_msgs[:-WINDOW_SIZE] if len(all_msgs) > WINDOW_SIZE else []
        if not to_delete:
            return 0

        ids = [m.id for m in to_delete]
        await self._db.message.delete_many(where={"id": {"in": ids}})
        logger.info("trim_old_messages session=%s deleted=%d kept=%d", session_id, len(ids), WINDOW_SIZE)
        return len(ids)

    async def _rebuild_context_window(self, session_id: str) -> list[dict[str, Any]]:
        recent = await self._db.message.find_many(
            where={"chatSessionId": session_id},
            order={"createdAt": "desc"},
            take=WINDOW_SIZE,
        )
        window = [_serialise_message(m) for m in reversed(recent)]
        await self._db.chatsession.update(
            where={"id": session_id},
            data={"contextWindow": Json(window)},
        )
        return window
