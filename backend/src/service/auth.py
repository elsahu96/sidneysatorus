from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

PROJECT_ID = "satorus-sidney"

# TODO:允许的 tenant（可选，加强安全）
ALLOWED_TENANTS = {"Satorus-kpar0": "Satorus", "tenant-b-id-xxxx": "company_b"}


def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    try:
        # 验证 ID Token（会自动联网到 Google 验证签名）
        decoded = id_token.verify_firebase_token(
            token,
            google_requests.Request(),
            audience=PROJECT_ID,
        )

        # 检查 tenant（Multi-Tenant 场景）
        tenant_id = decoded.get("firebase", {}).get("tenant")
        if tenant_id and tenant_id not in ALLOWED_TENANTS:
            raise HTTPException(status_code=403, detail="Tenant unauthorised")

        return {
            "uid": decoded["uid"],
            "email": decoded.get("email"),
            "tenant_id": tenant_id,
            "tenant_name": ALLOWED_TENANTS.get(tenant_id),
        }
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Token invalid: {e}")
