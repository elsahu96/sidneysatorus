"""
Shared FastAPI dependencies.
Defined here to avoid circular imports between main and routers.
"""

from fastapi import Depends, HTTPException
from prisma import Prisma
from src.data import DataFactory, get_data_factory


async def get_db(factory: DataFactory = Depends(get_data_factory)) -> Prisma:
    """Return a connected Prisma client, connecting lazily if needed."""
    try:
        return await factory.relational.get_client()
    except Exception as exc:
        if "EngineConnectionError" in type(exc).__name__ or "ConnectError" in str(exc):
            raise HTTPException(status_code=503, detail="Database unavailable")
        raise


__all__ = ["DataFactory", "get_data_factory", "get_db"]
