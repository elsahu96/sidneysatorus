"""
Search client — Elasticsearch.

Used for full-text search across investigation articles, reports, and case files.
"""

import logging
from typing import Any

from elasticsearch import AsyncElasticsearch

logger = logging.getLogger(__name__)


class SearchDB:
    """Async Elasticsearch client with helpers for index, search, and delete."""

    def __init__(self, url: str, api_key: str | None = None) -> None:
        self._url = url
        self._api_key = api_key
        self._client: AsyncElasticsearch | None = None

    async def connect(self) -> None:
        kwargs: dict[str, Any] = {"hosts": [self._url]}
        if self._api_key:
            kwargs["api_key"] = self._api_key
        self._client = AsyncElasticsearch(**kwargs)
        # Verify connectivity
        info = await self._client.info()
        logger.info("SearchDB connected — cluster: %s", info["cluster_name"])

    async def disconnect(self) -> None:
        if self._client:
            await self._client.close()
            self._client = None
            logger.info("SearchDB disconnected")

    @property
    def client(self) -> AsyncElasticsearch:
        if self._client is None:
            raise RuntimeError("SearchDB is not connected. Call connect() first.")
        return self._client

    # ── Index management ─────────────────────────────────────────────────────

    async def ensure_index(self, index: str, mappings: dict | None = None) -> None:
        """Create index with optional mappings if it does not exist."""
        if not await self.client.indices.exists(index=index):
            body: dict[str, Any] = {}
            if mappings:
                body["mappings"] = mappings
            await self.client.indices.create(index=index, body=body)
            logger.info("SearchDB: created index '%s'", index)

    # ── Write ────────────────────────────────────────────────────────────────

    async def index_document(
        self, index: str, doc_id: str, document: dict[str, Any]
    ) -> None:
        """Insert or replace a document."""
        await self.client.index(index=index, id=doc_id, document=document)

    async def bulk_index(
        self, index: str, documents: list[tuple[str, dict[str, Any]]]
    ) -> None:
        """
        Bulk index documents for efficiency.

        Args:
            documents: List of (doc_id, document) tuples.
        """
        actions = []
        for doc_id, doc in documents:
            actions.append({"index": {"_index": index, "_id": doc_id}})
            actions.append(doc)
        await self.client.bulk(operations=actions)

    # ── Read ─────────────────────────────────────────────────────────────────

    async def search(
        self,
        index: str,
        query: str,
        fields: list[str] | None = None,
        filters: dict[str, Any] | None = None,
        size: int = 10,
    ) -> list[dict[str, Any]]:
        """
        Full-text search with optional field targeting and term filters.

        Args:
            query:   Free-text search string.
            fields:  Fields to search (default: all text fields).
            filters: Optional key/value pairs added as term filters.
            size:    Max number of results.
        """
        must_clauses: list[dict] = [
            {
                "multi_match": {
                    "query": query,
                    **({"fields": fields} if fields else {}),
                    "type": "best_fields",
                    "fuzziness": "AUTO",
                }
            }
        ]

        filter_clauses: list[dict] = []
        if filters:
            filter_clauses = [{"term": {k: v}} for k, v in filters.items()]

        es_query: dict[str, Any] = {
            "bool": {
                "must": must_clauses,
                **({"filter": filter_clauses} if filter_clauses else {}),
            }
        }

        response = await self.client.search(
            index=index, query=es_query, size=size
        )
        return [
            {"id": hit["_id"], "score": hit["_score"], **hit["_source"]}
            for hit in response["hits"]["hits"]
        ]

    async def get_document(self, index: str, doc_id: str) -> dict[str, Any] | None:
        """Fetch a document by ID. Returns None if not found."""
        try:
            result = await self.client.get(index=index, id=doc_id)
            return {"id": result["_id"], **result["_source"]}
        except Exception:
            return None

    # ── Delete ───────────────────────────────────────────────────────────────

    async def delete_document(self, index: str, doc_id: str) -> None:
        """Delete a document by ID."""
        await self.client.delete(index=index, id=doc_id, ignore=[404])

    async def delete_by_query(
        self, index: str, filters: dict[str, Any]
    ) -> None:
        """Delete all documents matching the given term filters."""
        filter_clauses = [{"term": {k: v}} for k, v in filters.items()]
        await self.client.delete_by_query(
            index=index, query={"bool": {"filter": filter_clauses}}
        )
