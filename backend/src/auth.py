"""
Supabase JWT verification and user/team resolution for multi-tenant auth.
Supports (1) legacy JWT secret (SUPABASE_JWT_SECRET) and (2) JWT signing keys via JWKS (SUPABASE_URL).
"""

import base64
import logging
import json
import os
import time
from typing import Optional

import httpx
import jwt
from jwcrypto import jwk
from fastapi import HTTPException, Request, status
from prisma import Prisma

logger = logging.getLogger(__name__)

JWT_OPTIONS = {
    "verify_signature": True,
    "verify_exp": True,
    "require": ["sub", "email"],
}

# In-memory cache for JWKS: {url: (keys_dict, expiry)}
_jwks_cache: dict[str, tuple[dict, float]] = {}
_JWKS_CACHE_TTL = 600  # 10 minutes


def _jwt_header_unverified(token: str) -> dict:
    """Decode JWT header without verification (avoids relying on PyJWT.get_unverified_header)."""
    try:
        part = token.split(".")[0]
        # base64url: add padding if needed
        pad = 4 - len(part) % 4
        if pad != 4:
            part += "=" * pad
        raw = base64.urlsafe_b64decode(part)
        return json.loads(raw)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token format")


def _get_jwks(url: str) -> dict:
    """Fetch JWKS from Supabase auth endpoint; cache for 10 minutes."""
    now = time.time()
    if url in _jwks_cache:
        keys, expiry = _jwks_cache[url]
        if now < expiry:
            return keys
    jwks_url = url.rstrip("/") + "/auth/v1/.well-known/jwks.json"
    try:
        with httpx.Client(timeout=10.0) as client:
            r = client.get(jwks_url)
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Auth JWKS unavailable: {e}",
        )
    _jwks_cache[url] = (data, now + _JWKS_CACHE_TTL)
    return data


def _verify_with_jwks(token: str, supabase_url: str) -> dict:
    """Verify JWT using Supabase JWT signing keys (JWKS). Returns payload."""
    header = _jwt_header_unverified(token)
    kid = header.get("kid")
    if not kid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing kid")
    keys_data = _get_jwks(supabase_url)
    keys = keys_data.get("keys") or []
    key_dict = next((k for k in keys if k.get("kid") == kid), None)
    if not key_dict:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Key not found in JWKS")
    try:
        jwk_key = jwk.JWK.from_json(json.dumps(key_dict))
        public_pem = jwk_key.export_to_pem()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"JWK error: {e}")
    alg = header.get("alg", "RS256")
    algorithms = ["RS256", "ES256", "EdDSA"]
    try:
        payload = jwt.decode(
            token,
            public_pem,
            algorithms=algorithms,
            options=JWT_OPTIONS,
        )
        return payload
    except AttributeError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Wrong 'jwt' package: install PyJWT (pip uninstall jwt && pip install PyJWT)",
        ) from e
    except Exception as e:
        if type(e).__name__ == "ExpiredSignatureError":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def verify_supabase_token(token: str) -> dict:
    """Verify Bearer token with Supabase. Uses JWT signing keys (JWKS) if SUPABASE_URL is set and SUPABASE_JWT_SECRET is not; else legacy JWT secret. Returns payload with sub, email."""
    secret = os.environ.get("SUPABASE_JWT_SECRET")
    url = os.environ.get("SUPABASE_URL", "").strip()
    if secret:
        try:
            return jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                options=JWT_OPTIONS,
            )
        except AttributeError as e:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Wrong 'jwt' package: install PyJWT (pip uninstall jwt && pip install PyJWT)",
            ) from e
        except Exception as e:
            if type(e).__name__ == "ExpiredSignatureError":
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if url:
        return _verify_with_jwks(token, url)
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Auth not configured (set SUPABASE_URL for JWKS or SUPABASE_JWT_SECRET for legacy)",
    )


async def get_or_create_user_and_team(
    db: Prisma,
    supabase_id: str,
    email: str,
    name: Optional[str] = None,
) -> tuple[str, str]:
    """
    Find user by supabase_id, or create User + default Team + membership.
    Returns (user_id, team_id). Team_id is the user's first (or only) team.
    """
    user = await db.user.find_unique(where={"supabaseId": supabase_id})
    if user:
        membership = await db.teammembership.find_first(
            where={"userId": user.id},
            order={"createdAt": "asc"},
        )
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="User has no team membership",
            )
        return user.id, membership.teamId

    # Create user and default team (Prisma client uses schema field names: camelCase)
    display_name = name or email.split("@")[0]
    team_name = f"{display_name}'s Team"
    user = await db.user.create(
        data={
            "supabaseId": supabase_id,
            "email": email,
            "name": display_name,
            "username": email.split("@")[0],
        }
    )
    team = await db.team.create(data={"name": team_name})
    await db.teammembership.create(
        data={
            "teamId": team.id,
            "userId": user.id,
            "role": "OWNER",
        }
    )
    return user.id, team.id


async def get_current_user_and_team(request: Request, db: Prisma) -> tuple[str, str]:
    """
    FastAPI dependency: read Authorization Bearer token, verify with Supabase,
    resolve or create User and Team, return (user_id, team_id).
    """
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        logger.debug("Auth 401: missing or invalid Authorization header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )
    token = auth.split(" ", 1)[1].strip()
    try:
        payload = verify_supabase_token(token)
    except HTTPException as e:
        logger.info("Auth 401: %s", e.detail)
        raise
    sub = payload.get("sub")
    email = payload.get("email") or payload.get("email_address") or ""
    if not sub or not email:
        logger.info("Auth 401: token missing sub or email (sub=%s, email=%s)", sub, email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing sub or email",
        )
    name = (payload.get("user_metadata") or {}).get("name") or (payload.get("name"))
    user_id, team_id = await get_or_create_user_and_team(db, sub, email, name)
    return user_id, team_id
