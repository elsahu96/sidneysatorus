"""
Cache client — Redis.

Used for API response caching, rate limiting, and short-lived session data.
"""

import json
import logging
from typing import Any

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

_SENTINEL = object()


class CacheDB:
    """Async Redis client with typed get/set/delete helpers."""

    def __init__(self, url: str) -> None:
        self._url = url
        self._client: aioredis.Redis | None = None

    async def connect(self) -> None:
        self._client = aioredis.from_url(
            self._url, encoding="utf-8", decode_responses=True
        )
        await self._client.ping()
        logger.info("CacheDB connected to %s", self._url)

    async def disconnect(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None
            logger.info("CacheDB disconnected")

    @property
    def client(self) -> aioredis.Redis:
        if self._client is None:
            raise RuntimeError("CacheDB is not connected. Call connect() first.")
        return self._client

    # ── Core operations ──────────────────────────────────────────────────────

    async def get(self, key: str) -> Any | None:
        """Return the cached value or None if the key does not exist."""
        raw = await self.client.get(key)
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return raw

    async def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        """
        Cache a value.

        Args:
            key:   Cache key.
            value: Any JSON-serialisable value.
            ttl:   Time-to-live in seconds. None means no expiry.
        """
        serialised = json.dumps(value) if not isinstance(value, str) else value
        if ttl is not None:
            await self.client.setex(key, ttl, serialised)
        else:
            await self.client.set(key, serialised)

    async def delete(self, key: str) -> None:
        """Delete a key."""
        await self.client.delete(key)

    async def exists(self, key: str) -> bool:
        """Return True if the key exists in cache."""
        return bool(await self.client.exists(key))

    async def expire(self, key: str, ttl: int) -> None:
        """Set / update the TTL on an existing key."""
        await self.client.expire(key, ttl)

    # ── Bulk ─────────────────────────────────────────────────────────────────

    async def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching a glob pattern. Returns count deleted."""
        keys = await self.client.keys(pattern)
        if not keys:
            return 0
        return await self.client.delete(*keys)

    # ── Convenience helpers ──────────────────────────────────────────────────

    async def get_or_set(
        self,
        key: str,
        loader,
        ttl: int | None = None,
    ) -> Any:
        """
        Cache-aside helper.

        Returns the cached value if present; otherwise calls `loader()`,
        caches the result, and returns it.

        Args:
            loader: A zero-argument async callable that produces the value.
            ttl:    TTL in seconds for the cached result.
        """
        cached = await self.get(key)
        if cached is not None:
            return cached
        value = await loader()
        await self.set(key, value, ttl=ttl)
        return value

    async def increment(self, key: str, amount: int = 1, ttl: int | None = None) -> int:
        """Increment a counter. Optionally set TTL if key is new."""
        value = await self.client.incrby(key, amount)
        if value == amount and ttl is not None:
            await self.client.expire(key, ttl)
        return value
