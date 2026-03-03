"""
Vendor-agnostic document storage interface and factory.

Abstracts Firebase, Supabase, S3, GCS, etc. so business logic does not depend on the provider.
"""

from abc import ABC, abstractmethod
from datetime import timedelta
from typing import Any


class StorageError(Exception):
    """Raised when a storage operation fails."""

    def __init__(self, message: str, cause: Exception | None = None) -> None:
        self.cause = cause
        super().__init__(message)


class UnsupportedVendorError(StorageError):
    """Raised when the requested storage vendor is not supported."""

    pass


class DocumentStorage(ABC):
    """
    Abstract interface for document CRUD operations.
    All implementations must satisfy this interface.
    """

    @abstractmethod
    def upload(self, path: str, data: bytes, metadata: dict[str, Any]) -> str:
        """
        Upload data at the given path with optional metadata.

        :param path: Object path (e.g. "documents/report.pdf").
        :param data: Raw bytes to store.
        :param metadata: Custom metadata dict (e.g. {"author": "alice"}).
        :return: Public or signed URL to access the object.
        :raises StorageError: On upload failure.
        """
        ...

    @abstractmethod
    def download(self, path: str) -> bytes:
        """
        Download object content as bytes.

        :param path: Object path.
        :return: Raw bytes of the object.
        :raises StorageError: If object does not exist or download fails.
        """
        ...

    @abstractmethod
    def delete(self, path: str) -> None:
        """
        Delete the object at the given path.

        :param path: Object path.
        :raises StorageError: If delete fails (e.g. object not found).
        """
        ...

    @abstractmethod
    def exists(self, path: str) -> bool:
        """
        Check whether an object exists at the path.

        :param path: Object path.
        :return: True if the object exists, False otherwise.
        """
        ...

    @abstractmethod
    def get_url(self, path: str, expires_in_seconds: int = 3600) -> str:
        """
        Get a URL to access the object (public or signed).

        :param path: Object path.
        :param expires_in_seconds: For signed URLs, expiration time in seconds.
        :return: URL string.
        :raises StorageError: If object does not exist or URL generation fails.
        """
        ...

    @abstractmethod
    def list(self, prefix: str) -> list[str]:
        """
        List object paths under the given prefix.

        :param prefix: Prefix (e.g. "documents/").
        :return: List of full paths (keys) under the prefix.
        """
        ...

    @abstractmethod
    def copy(self, src_path: str, dest_path: str) -> None:
        """
        Copy an object from src_path to dest_path (same bucket).

        :param src_path: Source object path.
        :param dest_path: Destination object path.
        :raises StorageError: If source does not exist or copy fails.
        """
        ...

    @abstractmethod
    def get_metadata(self, path: str) -> dict[str, Any]:
        """
        Get metadata for the object at the given path.

        :param path: Object path.
        :return: Metadata dict (e.g. content_type, custom metadata).
        :raises StorageError: If object does not exist or metadata cannot be read.
        """
        ...


# ---------------------------------------------------------------------------
# Mock implementation (in-memory)
# ---------------------------------------------------------------------------


class MockDocumentStorage(DocumentStorage):
    """
    In-memory implementation for local testing.
    Stores blobs and metadata in memory; list/copy/urls are simulated.
    """

    def __init__(self) -> None:
        self._blobs: dict[str, bytes] = {}
        self._metadata: dict[str, dict[str, Any]] = {}
        self._base_url = "https://mock-storage.local"

    def upload(self, path: str, data: bytes, metadata: dict[str, Any]) -> str:
        try:
            self._blobs[path] = data
            self._metadata[path] = dict(metadata) if metadata else {}
            return f"{self._base_url}/{path}"
        except Exception as e:
            raise StorageError(f"Mock upload failed for {path}: {e}", cause=e) from e

    def download(self, path: str) -> bytes:
        try:
            if path not in self._blobs:
                raise StorageError(f"Object not found: {path}")
            return self._blobs[path]
        except StorageError:
            raise
        except Exception as e:
            raise StorageError(f"Mock download failed for {path}: {e}", cause=e) from e

    def delete(self, path: str) -> None:
        try:
            if path not in self._blobs:
                raise StorageError(f"Object not found: {path}")
            del self._blobs[path]
            self._metadata.pop(path, None)
        except StorageError:
            raise
        except Exception as e:
            raise StorageError(f"Mock delete failed for {path}: {e}", cause=e) from e

    def exists(self, path: str) -> bool:
        return path in self._blobs

    def get_url(self, path: str, expires_in_seconds: int = 3600) -> str:
        try:
            if path not in self._blobs:
                raise StorageError(f"Object not found: {path}")
            return f"{self._base_url}/{path}?expires={expires_in_seconds}"
        except StorageError:
            raise
        except Exception as e:
            raise StorageError(f"Mock get_url failed for {path}: {e}", cause=e) from e

    def list(self, prefix: str) -> list[str]:
        try:
            normalized = prefix.rstrip("/")
            if normalized:
                normalized += "/"
            return sorted(k for k in self._blobs if k == prefix or k.startswith(normalized))
        except Exception as e:
            raise StorageError(f"Mock list failed for prefix {prefix}: {e}", cause=e) from e

    def copy(self, src_path: str, dest_path: str) -> None:
        try:
            if src_path not in self._blobs:
                raise StorageError(f"Source not found: {src_path}")
            self._blobs[dest_path] = self._blobs[src_path]
            self._metadata[dest_path] = dict(self._metadata.get(src_path, {}))
        except StorageError:
            raise
        except Exception as e:
            raise StorageError(f"Mock copy failed {src_path} -> {dest_path}: {e}", cause=e) from e

    def get_metadata(self, path: str) -> dict[str, Any]:
        try:
            if path not in self._blobs:
                raise StorageError(f"Object not found: {path}")
            meta = dict(self._metadata.get(path, {}))
            meta.setdefault("size", len(self._blobs[path]))
            return meta
        except StorageError:
            raise
        except Exception as e:
            raise StorageError(f"Mock get_metadata failed for {path}: {e}", cause=e) from e


# ---------------------------------------------------------------------------
# Firebase implementation (firebase-admin)
# ---------------------------------------------------------------------------


class FirebaseDocumentStorage(DocumentStorage):
    """
    Firebase Storage implementation using firebase-admin.
    Config: {"credential_path": "...", "bucket": "my-project.appspot.com"}
    or {"credential_dict": {...}, "bucket": "..."} for inline credentials.
    """

    def __init__(self, config: dict[str, Any]) -> None:
        credential_path = config.get("credential_path")
        credential_dict = config.get("credential_dict")
        bucket_name = config.get("bucket")
        if not bucket_name:
            raise ValueError("Firebase config must include 'bucket'")
        try:
            import firebase_admin  # type: ignore[import-untyped]
            from firebase_admin import credentials, storage
        except ImportError as e:
            raise StorageError(
                "firebase-admin is required for Firebase storage; install with: pip install firebase-admin",
                cause=e,
            ) from e
        app = None
        for app in firebase_admin._apps.values():
            if getattr(app, "project_id", None):
                break
        else:
            if credential_path:
                cred = credentials.Certificate(credential_path)
            elif credential_dict:
                cred = credentials.Certificate(credential_dict)
            else:
                raise ValueError("Firebase config must include 'credential_path' or 'credential_dict'")
            firebase_admin.initialize_app(cred, {"storageBucket": bucket_name})
        self._bucket = storage.bucket(bucket_name)

    def _blob(self, path: str):
        return self._bucket.blob(path)

    def upload(self, path: str, data: bytes, metadata: dict[str, Any]) -> str:
        try:
            blob = self._blob(path)
            blob.upload_from_string(
                data,
                content_type=metadata.get("content_type", "application/octet-stream"),
            )
            if metadata:
                blob.metadata = {k: str(v) for k, v in metadata.items() if k != "content_type"}
                blob.patch()
            return blob.public_url or blob.generate_signed_url(expiration=timedelta(seconds=3600))
        except Exception as e:
            raise StorageError(f"Firebase upload failed for {path}: {e}", cause=e) from e

    def download(self, path: str) -> bytes:
        try:
            blob = self._blob(path)
            if not blob.exists():
                raise StorageError(f"Object not found: {path}")
            return blob.download_as_bytes()
        except StorageError:
            raise
        except Exception as e:
            raise StorageError(f"Firebase download failed for {path}: {e}", cause=e) from e

    def delete(self, path: str) -> None:
        try:
            blob = self._blob(path)
            if not blob.exists():
                raise StorageError(f"Object not found: {path}")
            blob.delete()
        except StorageError:
            raise
        except Exception as e:
            raise StorageError(f"Firebase delete failed for {path}: {e}", cause=e) from e

    def exists(self, path: str) -> bool:
        try:
            return self._blob(path).exists()
        except Exception as e:
            raise StorageError(f"Firebase exists check failed for {path}: {e}", cause=e) from e

    def get_url(self, path: str, expires_in_seconds: int = 3600) -> str:
        try:
            blob = self._blob(path)
            if not blob.exists():
                raise StorageError(f"Object not found: {path}")
            return blob.generate_signed_url(expiration=timedelta(seconds=expires_in_seconds))
        except StorageError:
            raise
        except Exception as e:
            raise StorageError(f"Firebase get_url failed for {path}: {e}", cause=e) from e

    def list(self, prefix: str) -> list[str]:
        try:
            blobs = self._bucket.list_blobs(prefix=prefix)
            return [b.name for b in blobs]
        except Exception as e:
            raise StorageError(f"Firebase list failed for prefix {prefix}: {e}", cause=e) from e

    def copy(self, src_path: str, dest_path: str) -> None:
        try:
            src = self._blob(src_path)
            if not src.exists():
                raise StorageError(f"Source not found: {src_path}")
            self._bucket.copy_blob(src, self._bucket, dest_path)
        except StorageError:
            raise
        except Exception as e:
            raise StorageError(f"Firebase copy failed {src_path} -> {dest_path}: {e}", cause=e) from e

    def get_metadata(self, path: str) -> dict[str, Any]:
        try:
            blob = self._blob(path)
            blob.reload()
            if not blob.exists():
                raise StorageError(f"Object not found: {path}")
            meta: dict[str, Any] = {"content_type": blob.content_type, "size": blob.size}
            if blob.metadata:
                meta["custom"] = dict(blob.metadata)
            return meta
        except StorageError:
            raise
        except Exception as e:
            raise StorageError(f"Firebase get_metadata failed for {path}: {e}", cause=e) from e


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------


class StorageFactory:
    """
    Factory for creating vendor-specific DocumentStorage instances.
    Config is a plain dict (no hardcoded credentials).
    """

    _registry: dict[str, type[DocumentStorage]] = {
        "firebase": FirebaseDocumentStorage,
        "mock": MockDocumentStorage,
    }

    @staticmethod
    def create(vendor: str, config: dict[str, Any]) -> DocumentStorage:
        """
        Create a DocumentStorage instance for the given vendor.

        :param vendor: One of "firebase", "mock".
        :param config: Vendor-specific config (e.g. credential_path, bucket).
        :return: DocumentStorage implementation.
        :raises UnsupportedVendorError: If vendor is not supported.
        :raises StorageError: If initialization fails.
        """
        vendor_lower = vendor.strip().lower()
        if vendor_lower not in StorageFactory._registry:
            raise UnsupportedVendorError(
                f"Unsupported storage vendor: '{vendor}'. Supported: {list(StorageFactory._registry.keys())}"
            )
        try:
            impl_class = StorageFactory._registry[vendor_lower]
            if impl_class is MockDocumentStorage:
                return MockDocumentStorage()
            return impl_class(config)
        except (ValueError, StorageError):
            raise
        except Exception as e:
            raise StorageError(f"Failed to create storage for vendor '{vendor}': {e}", cause=e) from e


# ---------------------------------------------------------------------------
# Usage example (do not run with real credentials in CI)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Example with Firebase (requires serviceAccountKey.json and bucket)
    # storage = StorageFactory.create("firebase", {
    #     "credential_path": "serviceAccountKey.json",
    #     "bucket": "my-project.appspot.com"
    # })
    # url = storage.upload("documents/report.pdf", file_bytes, {"author": "alice"})
    # content = storage.download("documents/report.pdf")
    # storage.delete("documents/report.pdf")

    # Example with Mock (no credentials)
    storage = StorageFactory.create("mock", {})
    file_bytes = b"%PDF-1.4 mock content"
    url = storage.upload("documents/report.pdf", file_bytes, {"author": "alice"})
    print("Upload URL:", url)
    content = storage.download("documents/report.pdf")
    print("Downloaded length:", len(content))
    storage.delete("documents/report.pdf")
    print("Exists after delete:", storage.exists("documents/report.pdf"))
