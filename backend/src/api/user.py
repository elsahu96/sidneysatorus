import asyncio
import json
import logging
import os
import pathlib
from dotenv import load_dotenv

load_dotenv()

import firebase_admin
from firebase_admin import credentials, auth as admin_auth
from fastapi import APIRouter, HTTPException, Depends
from src.service.auth import verify_token

app = APIRouter(prefix="/user")

logger = logging.getLogger(__name__)

import firebase_admin
from firebase_admin import credentials, auth as admin_auth

# 初始化（只需一次）
cred = credentials.ApplicationDefault()  # 或用 service account JSON
firebase_admin.initialize_app(cred)


def register_user(email: str, password: str, tenant_id: str):
    # 用 tenant_id 创建 tenant 专属的 auth client
    tenant_client = admin_auth.tenant_mgt.auth_for_tenant(tenant_id)

    user = tenant_client.create_user(
        email=email,
        password=password,
        email_verified=False,
    )
    return user.uid


@app.post("/register")
def register(body: dict):
    uid = register_user(
        email=body["email"],
        password=body["password"],
        tenant_id=body["tenant_id"],
    )
    return {"uid": uid, "message": "注册成功"}


@app.get("/profile")
def get_profile(user=Depends(verify_token)):
    # user 已经是验证过的用户信息
    return {
        "uid": user["uid"],
        "email": user["email"],
        "tenant": user["tenant_name"],
        "message": f"Welcome, {user['email']}!",
    }


@app.get("/data")
def get_data(user=Depends(verify_token)):
    # 用 tenant_id 隔离数据（Multi-Tenant 核心）
    tenant = user["tenant_id"]
    # 从数据库按 tenant 查询数据
    return {"tenant": tenant, "data": [...]}
