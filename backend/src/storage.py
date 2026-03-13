"""
Google Cloud Storage (GCS) multi-tenant file storage.
Object names are prefixed with team_id so each team's files are isolated.
Uses env: GCS_BUCKET; credentials via GOOGLE_APPLICATION_CREDENTIALS or default ADC.
"""

import os
import uuid
from datetime import timedelta


def _bucket():
    bucket_name = os.environ.get("GCS_BUCKET")
    if not bucket_name:
        return None
    try:
        from google.cloud import storage

        client = storage.Client()
        return client.bucket(bucket_name)
    except Exception:
        return None


def _blob_key(team_id: str, filename: str) -> str:
    """Multi-tenant blob name: team_id/unique_sanitized_filename."""
    safe = "".join(c for c in filename if c.isalnum() or c in "._- ").strip() or "file"
    unique = uuid.uuid4().hex[:12]
    return f"{team_id}/{unique}_{safe}"


def upload_file(
    team_id: str, file_content: bytes, filename: str, content_type: str
) -> str | None:
    """Upload bytes to GCS under team prefix. Returns storage_key (blob name) or None if GCS not configured."""
    bucket = _bucket()
    if not bucket:
        return None
    key = _blob_key(team_id, filename)
    blob = bucket.blob(key)
    blob.upload_from_string(
        file_content,
        content_type=content_type or "application/octet-stream",
    )
    return key


def get_presigned_url(storage_key: str, expires_in: int = 3600) -> str | None:
    """Generate a signed GET URL for the object. Returns None if GCS not configured or signing fails."""
    bucket = _bucket()
    if not bucket:
        return None
    try:
        blob = bucket.blob(storage_key)
        url = blob.generate_signed_url(
            expiration=timedelta(seconds=expires_in),
            method="GET",
        )
        return url
    except Exception:
        return None


def delete_file(storage_key: str) -> bool:
    """Delete object from GCS. Returns True if deleted or GCS not configured."""
    bucket = _bucket()
    if not bucket:
        return True
    try:
        bucket.blob(storage_key).delete()
        return True
    except Exception:
        return False


def is_configured() -> bool:
    return bool(os.environ.get("GCS_BUCKET"))
