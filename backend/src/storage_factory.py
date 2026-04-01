"""
Document storage abstraction.

Vendors:
  - "mock"     — in-memory (tests / local dev without cloud)
  - "gcs"      — Google Cloud Storage (prod)
  - "firebase" — alias for GCS (Firebase Storage uses GCS under the hood)

Usage:
    storage = StorageFactory.create("mock", {})
    url = storage.upload("docs/report.pdf", b"...", {"author": "alice"})
"""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from typing import Any


class StorageError(Exception):
    """Raised for any storage operation failure."""


class UnsupportedVendorError(StorageError):
    """Raised when the requested storage vendor is unknown."""


# ── Interface ─────────────────────────────────────────────────────────────────

class DocumentStorage(ABC):
    @abstractmethod
    def upload(self, path: str, data: bytes, metadata: dict[str, Any]) -> str:
        """Store data at path. Returns a URL."""

    @abstractmethod
    def download(self, path: str) -> bytes:
        """Return bytes for path. Raises StorageError if missing."""

    @abstractmethod
    def delete(self, path: str) -> None:
        """Remove path. Raises StorageError if missing."""

    @abstractmethod
    def exists(self, path: str) -> bool:
        """Return True if path exists."""

    @abstractmethod
    def get_url(self, path: str, expires_in_seconds: int = 3600) -> str:
        """Return a (possibly signed) URL. Raises StorageError if missing."""

    @abstractmethod
    def list(self, prefix: str) -> list[str]:
        """Return all paths under prefix."""

    @abstractmethod
    def copy(self, src: str, dest: str) -> None:
        """Copy src to dest. Raises StorageError if src missing."""

    @abstractmethod
    def get_metadata(self, path: str) -> dict[str, Any]:
        """Return metadata dict (always includes 'size'). Raises StorageError if missing."""


# ── Mock ──────────────────────────────────────────────────────────────────────

class MockDocumentStorage(DocumentStorage):
    """In-memory storage for tests and local development."""

    def __init__(self) -> None:
        self._store: dict[str, tuple[bytes, dict[str, Any]]] = {}

    def upload(self, path: str, data: bytes, metadata: dict[str, Any]) -> str:
        self._store[path] = (data, {**metadata, "size": len(data)})
        return f"https://mock-storage.example.com/{path}"

    def download(self, path: str) -> bytes:
        if path not in self._store:
            raise StorageError(f"Object not found: {path}")
        return self._store[path][0]

    def delete(self, path: str) -> None:
        if path not in self._store:
            raise StorageError(f"Object not found: {path}")
        del self._store[path]

    def exists(self, path: str) -> bool:
        return path in self._store

    def get_url(self, path: str, expires_in_seconds: int = 3600) -> str:
        if path not in self._store:
            raise StorageError(f"Object not found: {path}")
        expires_at = int(time.time()) + expires_in_seconds
        return f"https://mock-storage.example.com/{path}?expires={expires_at}"

    def list(self, prefix: str) -> list[str]:
        # Normalise prefix: strip trailing slash for comparison
        normalised = prefix.rstrip("/")
        return [p for p in self._store if p == normalised or p.startswith(normalised + "/")]

    def copy(self, src: str, dest: str) -> None:
        if src not in self._store:
            raise StorageError(f"Source not found: {src}")
        data, meta = self._store[src]
        self._store[dest] = (data, dict(meta))

    def get_metadata(self, path: str) -> dict[str, Any]:
        if path not in self._store:
            raise StorageError(f"Object not found: {path}")
        return dict(self._store[path][1])


# ── GCS ───────────────────────────────────────────────────────────────────────

class GCSDocumentStorage(DocumentStorage):
    """Google Cloud Storage backend."""

    def __init__(self, bucket_name: str) -> None:
        from google.cloud import storage as gcs  # type: ignore[import]

        self._client = gcs.Client()
        self._bucket = self._client.bucket(bucket_name)

    def _blob(self, path: str):  # type: ignore[return]
        return self._bucket.blob(path)

    def upload(self, path: str, data: bytes, metadata: dict[str, Any]) -> str:
        blob = self._blob(path)
        blob.metadata = {k: str(v) for k, v in metadata.items() if k != "content_type"}
        blob.upload_from_string(data, content_type=metadata.get("content_type", "application/octet-stream"))
        return blob.public_url

    def download(self, path: str) -> bytes:
        try:
            return self._blob(path).download_as_bytes()
        except Exception as exc:
            raise StorageError(f"Object not found: {path}") from exc

    def delete(self, path: str) -> None:
        try:
            self._blob(path).delete()
        except Exception as exc:
            raise StorageError(f"Object not found: {path}") from exc

    def exists(self, path: str) -> bool:
        return self._blob(path).exists()

    def get_url(self, path: str, expires_in_seconds: int = 3600) -> str:
        from datetime import timedelta
        blob = self._blob(path)
        if not blob.exists():
            raise StorageError(f"Object not found: {path}")
        return blob.generate_signed_url(expiration=timedelta(seconds=expires_in_seconds), method="GET")

    def list(self, prefix: str) -> list[str]:
        normalised = prefix.rstrip("/") + "/"
        return [b.name for b in self._client.list_blobs(self._bucket, prefix=normalised)]

    def copy(self, src: str, dest: str) -> None:
        src_blob = self._blob(src)
        if not src_blob.exists():
            raise StorageError(f"Source not found: {src}")
        self._bucket.copy_blob(src_blob, self._bucket, dest)

    def get_metadata(self, path: str) -> dict[str, Any]:
        blob = self._blob(path)
        if not blob.exists():
            raise StorageError(f"Object not found: {path}")
        blob.reload()
        meta: dict[str, Any] = {"size": blob.size}
        if blob.metadata:
            meta["custom"] = blob.metadata
        return meta


# ── Factory ───────────────────────────────────────────────────────────────────

_SUPPORTED = {"mock", "gcs", "firebase"}


class StorageFactory:
    @staticmethod
    def create(vendor: str, config: dict[str, Any]) -> DocumentStorage:
        if vendor == "mock":
            return MockDocumentStorage()
        if vendor in ("gcs", "firebase"):
            bucket = config.get("bucket") or config.get("GCS_BUCKET")
            if not bucket:
                raise StorageError("GCS bucket name required in config['bucket'] or config['GCS_BUCKET']")
            return GCSDocumentStorage(bucket_name=bucket)
        raise UnsupportedVendorError(
            f"Unsupported storage vendor '{vendor}'. Supported vendors: {sorted(_SUPPORTED)}"
        )
