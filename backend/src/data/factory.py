"""
DataFactory — single entry point for all data store clients.

Instantiated once at application startup and torn down on shutdown.
Access via FastAPI dependency injection using `get_data_factory()`.

Usage in a route:
    from src.data.factory import get_data_factory, DataFactory

    @router.get("/example")
    async def example(factory: DataFactory = Depends(get_data_factory)):
        user = await factory.relational.client.user.find_unique(where={"id": uid})
        cached = await factory.cache.get(f"user:{uid}")
        results = await factory.search.search("articles", query="Iran sanctions")
        similar = await factory.vector.search("reports", query_vector=[...])
"""

import logging
import os

from src.data.cache import CacheDB
from src.data.relational import RelationalDB
from src.data.search import SearchDB
from src.data.vector import VectorDB

logger = logging.getLogger(__name__)

_instance: "DataFactory | None" = None


class DataFactory:
    """Manages lifecycle and access for all data store clients."""

    def __init__(self) -> None:
        self._relational = RelationalDB()

        qdrant_url = os.environ.get("QDRANT_URL")
        self._vector = VectorDB(
            url=qdrant_url or "",
            api_key=os.environ.get("QDRANT_API_KEY"),
        ) if qdrant_url else None

        es_url = os.environ.get("ELASTICSEARCH_URL")
        self._search = SearchDB(
            url=es_url or "",
            api_key=os.environ.get("ELASTICSEARCH_API_KEY"),
        ) if es_url else None

        redis_url = os.environ.get("REDIS_URL")
        self._cache = CacheDB(url=redis_url) if redis_url else None

    # ── Lifecycle ────────────────────────────────────────────────────────────

    async def connect(self) -> None:
        """Connect all data store clients. Called at application startup.

        Connection failures are logged as warnings so the server can still
        start in environments where not all services are running (e.g. local dev
        without Cloud SQL Auth Proxy). Routes that depend on an unavailable
        client will raise RuntimeError on first access.
        """
        for name, client in [
            ("relational", self._relational),
            ("vector", self._vector),
            ("search", self._search),
            ("cache", self._cache),
        ]:
            if client is None:
                logger.info("DataFactory: %s not configured — skipping", name)
                continue
            try:
                await client.connect()
                logger.info("DataFactory: %s connected", name)
            except Exception as exc:
                logger.warning("DataFactory: %s connection failed — %s", name, exc)

    async def disconnect(self) -> None:
        """Disconnect all clients gracefully. Called at application shutdown."""
        for name, client in [
            ("relational", self._relational),
            ("vector", self._vector),
            ("search", self._search),
            ("cache", self._cache),
        ]:
            if client is None:
                continue
            try:
                await client.disconnect()
            except Exception as exc:
                logger.warning("DataFactory: %s disconnect error — %s", name, exc)
        logger.info("DataFactory: all clients disconnected")

    # ── Accessors ────────────────────────────────────────────────────────────

    @property
    def relational(self) -> RelationalDB:
        return self._relational

    @property
    def vector(self) -> "VectorDB | None":
        return self._vector

    @property
    def search(self) -> "SearchDB | None":
        return self._search

    @property
    def cache(self) -> "CacheDB | None":
        return self._cache


# ── Singleton helpers ─────────────────────────────────────────────────────────


def get_data_factory() -> DataFactory:
    """FastAPI dependency — returns the shared DataFactory instance."""
    if _instance is None:
        raise RuntimeError(
            "DataFactory has not been initialised. "
            "Ensure init_data_factory() is called in the FastAPI lifespan."
        )
    return _instance


async def init_data_factory() -> DataFactory:
    """Create and connect the singleton. Call once in application lifespan."""
    global _instance
    _instance = DataFactory()
    await _instance.connect()
    return _instance


async def shutdown_data_factory() -> None:
    """Disconnect and destroy the singleton. Call once on application shutdown."""
    global _instance
    if _instance is not None:
        await _instance.disconnect()
        _instance = None
