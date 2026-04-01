"""
Shared FastAPI dependencies.
Defined here to avoid circular imports between main and routers.

Primary dependency for data access:

    from src.deps import get_data_factory, DataFactory

    @router.get("/example")
    async def example(factory: DataFactory = Depends(get_data_factory)):
        user = await factory.relational.client.user.find_unique(...)
        cached = await factory.cache.get("key")
        ...
"""

from src.data import DataFactory, get_data_factory

__all__ = ["DataFactory", "get_data_factory"]
