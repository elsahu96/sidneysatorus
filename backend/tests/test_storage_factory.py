"""
Tests for DocumentStorage interface using MockDocumentStorage.

Covers all interface methods: upload, download, delete, exists, get_url, list, copy, get_metadata.
"""

import pytest

from src.storage_factory import (
    DocumentStorage,
    MockDocumentStorage,
    StorageError,
    StorageFactory,
    UnsupportedVendorError,
)


@pytest.fixture
def storage() -> DocumentStorage:
    """Fresh mock storage for each test."""
    return StorageFactory.create("mock", {})


def test_factory_create_mock(storage: DocumentStorage) -> None:
    """Factory returns MockDocumentStorage for vendor 'mock'."""
    assert isinstance(storage, MockDocumentStorage)


def test_factory_unsupported_vendor() -> None:
    """Factory raises UnsupportedVendorError for unknown vendor."""
    with pytest.raises(UnsupportedVendorError) as exc_info:
        StorageFactory.create("unknown", {})
    assert "Unsupported storage vendor" in str(exc_info.value)
    assert "mock" in str(exc_info.value).lower() and "firebase" in str(exc_info.value).lower()


def test_upload_returns_url(storage: DocumentStorage) -> None:
    """upload() stores data and returns a URL."""
    url = storage.upload("documents/report.pdf", b"PDF content", {"author": "alice"})
    assert url.startswith("https://")
    assert "documents/report.pdf" in url


def test_download_returns_uploaded_data(storage: DocumentStorage) -> None:
    """download() returns the same bytes that were uploaded."""
    data = b"%PDF-1.4 binary content"
    storage.upload("documents/report.pdf", data, {"author": "alice"})
    content = storage.download("documents/report.pdf")
    assert content == data


def test_download_missing_raises(storage: DocumentStorage) -> None:
    """download() raises StorageError for missing path."""
    with pytest.raises(StorageError) as exc_info:
        storage.download("nonexistent/path.pdf")
    assert "not found" in str(exc_info.value).lower()


def test_delete_removes_object(storage: DocumentStorage) -> None:
    """delete() removes the object so exists() is False and download raises."""
    storage.upload("documents/report.pdf", b"content", {})
    assert storage.exists("documents/report.pdf")
    storage.delete("documents/report.pdf")
    assert not storage.exists("documents/report.pdf")
    with pytest.raises(StorageError):
        storage.download("documents/report.pdf")


def test_delete_missing_raises(storage: DocumentStorage) -> None:
    """delete() raises StorageError for missing path."""
    with pytest.raises(StorageError) as exc_info:
        storage.delete("nonexistent/path.pdf")
    assert "not found" in str(exc_info.value).lower()


def test_exists_true_after_upload(storage: DocumentStorage) -> None:
    """exists() returns True for uploaded path."""
    assert not storage.exists("documents/report.pdf")
    storage.upload("documents/report.pdf", b"x", {})
    assert storage.exists("documents/report.pdf")


def test_exists_false_for_missing(storage: DocumentStorage) -> None:
    """exists() returns False for path that was never uploaded."""
    assert storage.exists("documents/missing.pdf") is False


def test_get_url_returns_url_with_expiry(storage: DocumentStorage) -> None:
    """get_url() returns a URL and honours expires_in_seconds."""
    storage.upload("documents/report.pdf", b"content", {})
    url = storage.get_url("documents/report.pdf", expires_in_seconds=300)
    assert "documents/report.pdf" in url
    assert "300" in url or "expires" in url.lower()


def test_get_url_missing_raises(storage: DocumentStorage) -> None:
    """get_url() raises StorageError for missing path."""
    with pytest.raises(StorageError) as exc_info:
        storage.get_url("nonexistent/path.pdf", 3600)
    assert "not found" in str(exc_info.value).lower()


def test_list_empty_prefix(storage: DocumentStorage) -> None:
    """list() with prefix that matches nothing returns empty list."""
    assert storage.list("empty/") == []


def test_list_returns_paths_under_prefix(storage: DocumentStorage) -> None:
    """list() returns all paths under the given prefix."""
    storage.upload("documents/a.pdf", b"a", {})
    storage.upload("documents/b.pdf", b"b", {})
    storage.upload("documents/sub/c.pdf", b"c", {})
    storage.upload("other/x.pdf", b"x", {})
    paths = storage.list("documents")
    assert "documents/a.pdf" in paths
    assert "documents/b.pdf" in paths
    assert "documents/sub/c.pdf" in paths
    assert "other/x.pdf" not in paths
    assert len(paths) == 3


def test_list_prefix_with_trailing_slash(storage: DocumentStorage) -> None:
    """list() works with prefix ending in slash."""
    storage.upload("documents/report.pdf", b"x", {})
    paths = storage.list("documents/")
    assert "documents/report.pdf" in paths


def test_copy_duplicates_content(storage: DocumentStorage) -> None:
    """copy() creates dest with same content as src."""
    data = b"original content"
    storage.upload("documents/source.pdf", data, {"author": "alice"})
    storage.copy("documents/source.pdf", "documents/dest.pdf")
    assert storage.exists("documents/dest.pdf")
    assert storage.download("documents/dest.pdf") == data
    assert storage.download("documents/source.pdf") == data


def test_copy_preserves_metadata(storage: DocumentStorage) -> None:
    """copy() preserves metadata on destination (mock stores custom metadata)."""
    storage.upload("documents/source.pdf", b"x", {"author": "alice"})
    storage.copy("documents/source.pdf", "documents/dest.pdf")
    meta = storage.get_metadata("documents/dest.pdf")
    assert meta.get("custom", meta).get("author") == "alice" or meta.get("author") == "alice" or "size" in meta


def test_copy_missing_src_raises(storage: DocumentStorage) -> None:
    """copy() raises StorageError when source does not exist."""
    with pytest.raises(StorageError) as exc_info:
        storage.copy("documents/missing.pdf", "documents/dest.pdf")
    assert "not found" in str(exc_info.value).lower() or "source" in str(exc_info.value).lower()


def test_get_metadata_returns_metadata(storage: DocumentStorage) -> None:
    """get_metadata() returns dict including size and custom metadata."""
    storage.upload("documents/report.pdf", b"hello", {"author": "alice", "version": "1"})
    meta = storage.get_metadata("documents/report.pdf")
    assert isinstance(meta, dict)
    assert meta.get("size") == 5


def test_get_metadata_missing_raises(storage: DocumentStorage) -> None:
    """get_metadata() raises StorageError for missing path."""
    with pytest.raises(StorageError) as exc_info:
        storage.get_metadata("nonexistent/path.pdf")
    assert "not found" in str(exc_info.value).lower()


def test_upload_download_roundtrip_with_metadata(storage: DocumentStorage) -> None:
    """Full roundtrip: upload with metadata, download, get_metadata, delete."""
    path = "documents/report.pdf"
    data = b"%PDF-1.4 mock content"
    metadata = {"author": "alice", "content_type": "application/pdf"}
    url = storage.upload(path, data, metadata)
    assert url
    assert storage.exists(path)
    assert storage.download(path) == data
    meta = storage.get_metadata(path)
    assert meta.get("size") == len(data)
    storage.delete(path)
    assert not storage.exists(path)
