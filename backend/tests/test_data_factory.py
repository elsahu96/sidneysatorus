"""
Unit tests for the DataFactory and each data store client.
All external connections are mocked — no live services required.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ── DataFactory ───────────────────────────────────────────────────────────────

_TEST_ENV = {
    "QDRANT_URL": "http://localhost:6333",
    "ELASTICSEARCH_URL": "http://localhost:9200",
    "REDIS_URL": "redis://localhost:6379",
}


@pytest.mark.asyncio
async def test_factory_connects_all_clients():
    """DataFactory.connect() calls connect() on every client."""
    with patch("src.data.factory.RelationalDB") as MockRel, \
         patch("src.data.factory.VectorDB") as MockVec, \
         patch("src.data.factory.SearchDB") as MockSearch, \
         patch("src.data.factory.CacheDB") as MockCache, \
         patch.dict("os.environ", _TEST_ENV):

        for Mock in (MockRel, MockVec, MockSearch, MockCache):
            Mock.return_value.connect = AsyncMock()
            Mock.return_value.disconnect = AsyncMock()

        from src.data.factory import DataFactory
        factory = DataFactory()
        await factory.connect()

        MockRel.return_value.connect.assert_awaited_once()
        MockVec.return_value.connect.assert_awaited_once()
        MockSearch.return_value.connect.assert_awaited_once()
        MockCache.return_value.connect.assert_awaited_once()


@pytest.mark.asyncio
async def test_factory_disconnects_all_clients():
    """DataFactory.disconnect() calls disconnect() on every client."""
    with patch("src.data.factory.RelationalDB") as MockRel, \
         patch("src.data.factory.VectorDB") as MockVec, \
         patch("src.data.factory.SearchDB") as MockSearch, \
         patch("src.data.factory.CacheDB") as MockCache, \
         patch.dict("os.environ", _TEST_ENV):

        for Mock in (MockRel, MockVec, MockSearch, MockCache):
            Mock.return_value.connect = AsyncMock()
            Mock.return_value.disconnect = AsyncMock()

        from src.data.factory import DataFactory
        factory = DataFactory()
        await factory.connect()
        await factory.disconnect()

        MockRel.return_value.disconnect.assert_awaited_once()
        MockVec.return_value.disconnect.assert_awaited_once()
        MockSearch.return_value.disconnect.assert_awaited_once()
        MockCache.return_value.disconnect.assert_awaited_once()


def test_get_data_factory_raises_before_init():
    """get_data_factory() raises if init_data_factory() was not called."""
    import src.data.factory as fmod
    fmod._instance = None
    with pytest.raises(RuntimeError, match="DataFactory has not been initialised"):
        fmod.get_data_factory()


# ── RelationalDB ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_relational_client_raises_when_not_connected():
    from src.data.relational import RelationalDB
    db = RelationalDB()
    with pytest.raises(RuntimeError, match="not connected"):
        _ = db.client


@pytest.mark.asyncio
async def test_relational_connect_disconnect():
    with patch("src.data.relational.Prisma") as MockPrisma:
        MockPrisma.return_value.connect = AsyncMock()
        MockPrisma.return_value.disconnect = AsyncMock()

        from src.data.relational import RelationalDB
        db = RelationalDB()
        await db.connect()
        assert db._connected
        _ = db.client  # should not raise

        await db.disconnect()
        assert not db._connected


# ── VectorDB ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_vector_search_returns_formatted_results():
    with patch("src.data.vector.AsyncQdrantClient") as MockClient:
        mock_result = MagicMock()
        mock_result.id = "abc"
        mock_result.score = 0.95
        mock_result.payload = {"title": "Iran sanctions"}

        instance = MockClient.return_value
        instance.search = AsyncMock(return_value=[mock_result])
        instance.close = AsyncMock()

        from src.data.vector import VectorDB
        db = VectorDB(url="http://localhost:6333")
        db._client = instance

        results = await db.search("articles", query_vector=[0.1] * 768, limit=5)

        assert len(results) == 1
        assert results[0]["id"] == "abc"
        assert results[0]["score"] == 0.95
        assert results[0]["title"] == "Iran sanctions"


@pytest.mark.asyncio
async def test_vector_client_raises_when_not_connected():
    from src.data.vector import VectorDB
    db = VectorDB(url="http://localhost:6333")
    with pytest.raises(RuntimeError, match="not connected"):
        _ = db.client


# ── SearchDB ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_search_returns_formatted_hits():
    with patch("src.data.search.AsyncElasticsearch") as MockES:
        instance = MockES.return_value
        instance.info = AsyncMock(return_value={"cluster_name": "test"})
        instance.search = AsyncMock(return_value={
            "hits": {
                "hits": [
                    {"_id": "doc1", "_score": 1.5, "_source": {"title": "test article"}}
                ]
            }
        })

        from src.data.search import SearchDB
        db = SearchDB(url="http://localhost:9200")
        db._client = instance

        results = await db.search("articles", query="sanctions")

        assert len(results) == 1
        assert results[0]["id"] == "doc1"
        assert results[0]["score"] == 1.5
        assert results[0]["title"] == "test article"


@pytest.mark.asyncio
async def test_search_client_raises_when_not_connected():
    from src.data.search import SearchDB
    db = SearchDB(url="http://localhost:9200")
    with pytest.raises(RuntimeError, match="not connected"):
        _ = db.client


# ── CacheDB ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cache_get_returns_none_on_miss():
    with patch("src.data.cache.aioredis.from_url") as mock_from_url:
        instance = AsyncMock()
        instance.get = AsyncMock(return_value=None)
        mock_from_url.return_value = instance

        from src.data.cache import CacheDB
        db = CacheDB(url="redis://localhost:6379")
        db._client = instance

        result = await db.get("missing_key")
        assert result is None


@pytest.mark.asyncio
async def test_cache_set_and_get_roundtrip():
    with patch("src.data.cache.aioredis.from_url") as mock_from_url:
        store: dict = {}
        instance = AsyncMock()
        instance.set = AsyncMock(side_effect=lambda k, v: store.update({k: v}))
        instance.get = AsyncMock(side_effect=lambda k: store.get(k))
        mock_from_url.return_value = instance

        from src.data.cache import CacheDB
        db = CacheDB(url="redis://localhost:6379")
        db._client = instance

        await db.set("key1", {"data": 42})
        raw = await db.get("key1")
        # CacheDB.get() deserializes the JSON string back to the original value
        assert raw == {"data": 42}


@pytest.mark.asyncio
async def test_cache_get_or_set_calls_loader_on_miss():
    with patch("src.data.cache.aioredis.from_url"):
        from src.data.cache import CacheDB
        db = CacheDB(url="redis://localhost:6379")
        db.get = AsyncMock(return_value=None)
        db.set = AsyncMock()

        loader = AsyncMock(return_value={"result": "fresh"})
        value = await db.get_or_set("some_key", loader, ttl=60)

        loader.assert_awaited_once()
        db.set.assert_awaited_once_with("some_key", {"result": "fresh"}, ttl=60)
        assert value == {"result": "fresh"}


@pytest.mark.asyncio
async def test_cache_client_raises_when_not_connected():
    from src.data.cache import CacheDB
    db = CacheDB(url="redis://localhost:6379")
    with pytest.raises(RuntimeError, match="not connected"):
        _ = db.client
