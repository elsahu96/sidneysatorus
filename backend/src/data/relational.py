"""
Relational database client — PostgreSQL via Prisma ORM.
"""

import logging
from dotenv import load_dotenv
from prisma import Prisma

logger = logging.getLogger(__name__)
load_dotenv()


class RelationalDB:
    """Wraps the Prisma client with explicit connect/disconnect lifecycle."""

    def __init__(self) -> None:
        self._client = Prisma()
        self._connected = False

    async def connect(self) -> None:
        if self._client.is_connected():
            return
        else:
            try:
                await self._client.connect()
                self._connected = True
                logger.info("RelationalDB connected")
            except Exception as e:
                if "Already connected" in str(e):
                    pass
                else:
                    raise e

    async def disconnect(self) -> None:
        if self._connected:
            await self._client.disconnect()
            self._connected = False
            logger.info("RelationalDB disconnected")

    @property
    def client(self) -> Prisma:
        """Direct access to the Prisma client. Raises if not connected."""
        if not self._connected:
            raise RuntimeError("RelationalDB is not connected. Call connect() first.")
        return self._client

    async def get_client(self) -> Prisma:
        """Return the Prisma client, connecting lazily if needed."""
        if not self._connected:
            try:
                await self.connect()
            except Exception:
                self._connected = False
                raise
        return self._client
