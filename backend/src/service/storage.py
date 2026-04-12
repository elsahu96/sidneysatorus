from abc import ABC, abstractmethod
from pathlib import Path
import asyncio
import secrets
import time
from urllib.parse import urlencode
import hashlib
import hmac


class StorageService(ABC):
    @abstractmethod
    async def get_download_url(self, storage_path: str, expires_in: int = 900) -> str:
        """Return a time-limited download URL for the given storage path."""
        pass

    @abstractmethod
    async def file_exists(self, storage_path: str) -> bool:
        pass

    @abstractmethod
    async def write_bytes(self, storage_path: str, data: bytes, content_type: str = "application/octet-stream") -> None:
        """Write raw bytes to the given storage path."""
        pass


# ── 本地文件系统（当前阶段）──────────────────────────────
class LocalStorageService(StorageService):
    def __init__(self, base_dir: str, base_url: str, secret_key: str):
        self.base_dir = Path(base_dir)
        self.base_url = base_url  # e.g. "http://localhost:8080"
        self.secret_key = secret_key  # 用来签名 URL

    async def get_download_url(self, storage_path: str, expires_in: int = 900) -> str:
        expires_at = int(time.time()) + expires_in

        # 用 HMAC 签名，防止伪造
        payload = f"{storage_path}:{expires_at}"
        signature = hmac.new(
            self.secret_key.encode(), payload.encode(), hashlib.sha256
        ).hexdigest()

        params = urlencode(
            {"path": storage_path, "expires": expires_at, "sig": signature}
        )
        return f"{self.base_url}/api/files/serve?{params}"

    async def file_exists(self, storage_path: str) -> bool:
        return (self.base_dir / storage_path).exists()

    async def write_bytes(self, storage_path: str, data: bytes, content_type: str = "application/octet-stream") -> None:
        dest = self.base_dir / storage_path
        await asyncio.to_thread(dest.parent.mkdir, parents=True, exist_ok=True)
        await asyncio.to_thread(dest.write_bytes, data)


# ── GCS（之后切换用这个）────────────────────────────────
class GCSStorageService(StorageService):
    def __init__(self, bucket_name: str):
        from google.cloud import storage

        self.client = storage.Client()
        self.bucket = self.client.bucket(bucket_name)

    async def get_download_url(self, storage_path: str, expires_in: int = 900) -> str:
        from datetime import timedelta

        blob = self.bucket.blob(storage_path)
        return blob.generate_signed_url(expiration=timedelta(seconds=expires_in))

    async def file_exists(self, storage_path: str) -> bool:
        return self.bucket.blob(storage_path).exists()

    async def write_bytes(self, storage_path: str, data: bytes, content_type: str = "application/octet-stream") -> None:
        blob = self.bucket.blob(storage_path)
        await asyncio.to_thread(blob.upload_from_string, data, content_type=content_type)
