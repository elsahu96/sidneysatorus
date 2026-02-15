"""
Shared FastAPI dependencies (e.g. get_db).
Defined here to avoid circular imports between main and routers.
"""

from prisma import Prisma

db = Prisma()


async def get_db():
    """Dependency that yields the shared Prisma client."""
    yield db
