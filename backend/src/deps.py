"""
Shared FastAPI dependencies.
Defined here to avoid circular imports between main and routers.
"""

import logging
from fastapi import Depends, HTTPException
from prisma import Prisma
from src.data import DataFactory, get_data_factory

logger = logging.getLogger(__name__)


async def get_db(factory: DataFactory = Depends(get_data_factory)) -> Prisma:
    """Return a connected Prisma client, connecting lazily if needed."""
    try:
        return await factory.relational.get_client()
    except Exception as exc:
        if "EngineConnectionError" in type(exc).__name__ or "ConnectError" in str(exc):
            raise HTTPException(status_code=503, detail="Database unavailable")
        raise


async def get_db_optional(factory: DataFactory = Depends(get_data_factory)) -> Prisma | None:
    """
    Like get_db but returns None instead of raising 503 when the DB is unavailable.
    Use for read-only list endpoints that should degrade gracefully (e.g. sidebar session list).
    """
    try:
        return await factory.relational.get_client()
    except Exception as exc:
        logger.warning("DB unavailable (optional dep): %s", exc)
        return None


__all__ = ["DataFactory", "get_data_factory", "get_db", "get_db_optional"]
