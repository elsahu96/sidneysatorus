"""
Case file CRUD endpoints.
All endpoints require a valid Firebase token.
Team is resolved from the authenticated user's first team membership,
auto-created if the user has no team yet.
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.service.auth import verify_token
from src.deps import get_data_factory, DataFactory
from src.service.db import (
    get_or_create_team_for_user,
    create_case_file,
    list_case_files,
    get_case_file,
    update_case_file,
    delete_case_file,
)

app = APIRouter(prefix="/cases", tags=["cases"])
logger = logging.getLogger(__name__)


async def _resolve_team(user: dict, factory: DataFactory) -> str:
    return await get_or_create_team_for_user(
        await factory.relational.get_client(),
        firebase_uid=user["uid"],
        email=user["email"],
    )


class CreateCaseRequest(BaseModel):
    subject: str
    messages: list[dict[str, Any]] = []
    folder_id: str | None = None
    category: str | None = None
    project_id: str | None = None


class UpdateCaseRequest(BaseModel):
    subject: str | None = None
    case_number: str | None = None
    folder_id: str | None = None
    category: str | None = None
    project_id: str | None = None
    messages: list[dict[str, Any]] | None = None


@app.get("/")
async def list_cases(
    folder_id: str | None = None,
    project_id: str | None = None,
    user=Depends(verify_token),
    factory: DataFactory = Depends(get_data_factory),
):
    team_id = await _resolve_team(user, factory)
    cases = await list_case_files(
        factory.relational.client,
        team_id=team_id,
        folder_id=folder_id,
        project_id=project_id,
    )
    return {"cases": cases}


@app.post("/", status_code=201)
async def create_case(
    body: CreateCaseRequest,
    user=Depends(verify_token),
    factory: DataFactory = Depends(get_data_factory),
):
    team_id = await _resolve_team(user, factory)
    case = await create_case_file(
        factory.relational.client,
        team_id=team_id,
        subject=body.subject,
        messages=body.messages,
        folder_id=body.folder_id,
        category=body.category,
        project_id=body.project_id,
    )
    return case


@app.get("/{case_id}")
async def get_case(
    case_id: str,
    user=Depends(verify_token),
    factory: DataFactory = Depends(get_data_factory),
):
    team_id = await _resolve_team(user, factory)
    case = await get_case_file(factory.relational.client, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if case["teamId"] != team_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return case


@app.patch("/{case_id}")
async def update_case(
    case_id: str,
    body: UpdateCaseRequest,
    user=Depends(verify_token),
    factory: DataFactory = Depends(get_data_factory),
):
    team_id = await _resolve_team(user, factory)
    case = await get_case_file(factory.relational.client, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if case["teamId"] != team_id:
        raise HTTPException(status_code=403, detail="Access denied")
    updated = await update_case_file(
        factory.relational.client,
        case_id=case_id,
        subject=body.subject,
        case_number=body.case_number,
        folder_id=body.folder_id,
        category=body.category,
        project_id=body.project_id,
        messages=body.messages,
    )
    return updated


@app.delete("/{case_id}", status_code=204)
async def delete_case(
    case_id: str,
    user=Depends(verify_token),
    factory: DataFactory = Depends(get_data_factory),
):
    team_id = await _resolve_team(user, factory)
    case = await get_case_file(factory.relational.client, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if case["teamId"] != team_id:
        raise HTTPException(status_code=403, detail="Access denied")
    await delete_case_file(factory.relational.client, case_id)
