import asyncio
import json
import logging
import os
import pathlib
from pydantic import BaseModel
from dotenv import load_dotenv
from pydantic import EmailStr
from slowapi import Limiter
from slowapi.util import get_remote_address

load_dotenv()
from fastapi import APIRouter, HTTPException, Depends, Request
import firebase_admin
from firebase_admin import tenant_mgt
from firebase_admin import credentials, auth as admin_auth
from fastapi import APIRouter, HTTPException, Depends
from src.service.auth import verify_token
from firebase_admin._auth_utils import EmailAlreadyExistsError

app = APIRouter(prefix="/user")

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    tenantId: str


def register_user(email: str, password: str, tenant_id: str):
    # 用 tenant_id 创建 tenant 专属的 auth client
    tenant_client = tenant_mgt.auth_for_tenant(tenant_id)

    user = tenant_client.create_user(
        email=email,
        password=password,
        email_verified=False,
    )
    return user.uid


@app.post("/register")
@limiter.limit("5/minute")
def register(request: Request, body: RegisterRequest):
    logger.info("Registering user with email: %s", body.email)
    logger.info("Tenant ID: %s", body.tenantId)
    try:
        uid = register_user(
            email=body.email,
            password=body.password,
            tenant_id=body.tenantId,
        )
        return {"uid": uid, "message": "User registered successfully"}
    except EmailAlreadyExistsError:
        raise HTTPException(
            status_code=400, detail="An account with this email already exists."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/profile")
def get_profile(user=Depends(verify_token)):
    logger.info("Getting profile for user: %s", user["uid"])
    return {
        "uid": user["uid"],
        "email": user["email"],
        "tenant": user["tenant_name"],
        "message": f"Welcome, {user['email']}!",
    }


@app.get("/data")
def get_data(user=Depends(verify_token)):
    logger.info("Getting data for user: %s", user["uid"])
    tenant = user["tenant_id"]
    return {"tenant": tenant, "data": []}
