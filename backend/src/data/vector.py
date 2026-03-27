"""
Vector database client — Qdrant.

Used for semantic similarity search over investigation articles and reports.
Each item stored as a dense vector alongside a JSON payload for filtering.
"""

import logging
import os
from typing import Any

from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
)

logger = logging.getLogger(__name__)

# Default embedding dimension (text-embedding-004 / Gemini embed)
_DEFAULT_DIM = 768


class VectorDB:
    """Async Qdrant client with helpers for upsert, search, and delete."""

    def __init__(self, url: str, api_key: str | None = None) -> None:
        self._url = url
        self._api_key = api_key
        self._client: AsyncQdrantClient | None = None

    async def connect(self) -> None:
        self._client = AsyncQdrantClient(url=self._url, api_key=self._api_key)
        logger.info("VectorDB connected to %s", self._url)

    async def disconnect(self) -> None:
        if self._client:
            await self._client.close()
            self._client = None
            logger.info("VectorDB disconnected")

    @property
    def client(self) -> AsyncQdrantClient:
        if self._client is None:
            raise RuntimeError("VectorDB is not connected. Call connect() first.")
        return self._client

    # ── Collection management ────────────────────────────────────────────────

    async def ensure_collection(
        self, collection: str, dim: int = _DEFAULT_DIM
    ) -> None:
        """Create collection if it does not already exist."""
        existing = {c.name for c in (await self.client.get_collections()).collections}
        if collection not in existing:
            await self.client.create_collection(
                collection_name=collection,
                vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
            )
            logger.info("VectorDB: created collection '%s' (dim=%d)", collection, dim)

    # ── Write ────────────────────────────────────────────────────────────────

    async def upsert(
        self,
        collection: str,
        id: str,
        vector: list[float],
        payload: dict[str, Any],
    ) -> None:
        """Insert or update a single vector with its payload."""
        await self.client.upsert(
            collection_name=collection,
            points=[PointStruct(id=id, vector=vector, payload=payload)],
        )

    async def upsert_batch(
        self,
        collection: str,
        ids: list[str],
        vectors: list[list[float]],
        payloads: list[dict[str, Any]],
    ) -> None:
        """Batch upsert for efficiency."""
        points = [
            PointStruct(id=id_, vector=vec, payload=pl)
            for id_, vec, pl in zip(ids, vectors, payloads)
        ]
        await self.client.upsert(collection_name=collection, points=points)

    # ── Read ─────────────────────────────────────────────────────────────────

    async def search(
        self,
        collection: str,
        query_vector: list[float],
        limit: int = 10,
        filters: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """
        Return the top-k nearest neighbours.

        Args:
            filters: Optional key/value pairs for exact-match payload filtering.
                     e.g. {"team_id": "abc123"}
        """
        qdrant_filter = None
        if filters:
            qdrant_filter = Filter(
                must=[
                    FieldCondition(key=k, match=MatchValue(value=v))
                    for k, v in filters.items()
                ]
            )

        results = await self.client.search(
            collection_name=collection,
            query_vector=query_vector,
            limit=limit,
            query_filter=qdrant_filter,
            with_payload=True,
        )
        return [
            {"id": r.id, "score": r.score, **r.payload} for r in results
        ]

    # ── Delete ───────────────────────────────────────────────────────────────

    async def delete(self, collection: str, ids: list[str]) -> None:
        """Delete vectors by ID."""
        await self.client.delete(
            collection_name=collection,
            points_selector=ids,
        )
