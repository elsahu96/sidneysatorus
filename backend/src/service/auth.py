import logging
import os
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from src.service.tenants import TENANTS

security = HTTPBearer()

# Cloud Run does not set this by default; Terraform sets GOOGLE_CLOUD_PROJECT on the backend service.
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("GCP_PROJECT", "")
logger = logging.getLogger(__name__)


def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    if not PROJECT_ID:
        logger.error("GOOGLE_CLOUD_PROJECT or GCP_PROJECT must be set for Firebase token verification")
        raise HTTPException(status_code=500, detail="Server misconfiguration: missing GOOGLE_CLOUD_PROJECT")
    token = credentials.credentials
    try:
        # Verify ID Token（will automatically connect to Google to verify the signature）
        decoded = id_token.verify_firebase_token(
            token,
            google_requests.Request(),
            audience=PROJECT_ID,
        )

        # Check tenant（Multi-Tenant scenario）
        tenant_id = decoded.get("firebase", {}).get("tenant", "")
        logger.debug("Tenant ID from token: %s", tenant_id)
        logger.debug("Allowed tenants: %s", TENANTS)  # Check what's in the TENANTS

        if tenant_id and tenant_id not in TENANTS:
            raise HTTPException(status_code=403, detail="Tenant unauthorised")

        return {
            "uid": decoded.get("uid") or decoded.get("sub"),
            "email": decoded.get("email"),
            "tenant_id": tenant_id,
            "tenant_name": TENANTS.get(tenant_id),
        }
    except HTTPException:
        raise
    except ValueError as e:
        logger.error("Token invalid: %s", e)
        raise HTTPException(status_code=401, detail=f"Token invalid: {e}")
