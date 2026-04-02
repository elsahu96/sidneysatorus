"""
Folder and Project CRUD endpoints.
All endpoints require a valid Firebase token.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from prisma import Prisma
from pydantic import BaseModel

from src.service.auth import verify_token
from src.deps import get_db
from src.service.db import (
    get_or_create_team_for_user,
    create_folder,
    list_folders,
    update_folder,
    delete_folder,
    create_project,
    list_projects,
    get_project,
    update_project,
    delete_project,
    create_project_document,
    delete_project_document,
)

app = APIRouter(tags=["workspace"])
logger = logging.getLogger(__name__)


# ── Folders ────────────────────────────────────────────────────────────────────

class CreateFolderRequest(BaseModel):
    name: str
    color: str | None = None


class UpdateFolderRequest(BaseModel):
    name: str | None = None
    color: str | None = None


@app.get("/folders")
async def list_folders_route(
    user=Depends(verify_token),
    db: Prisma = Depends(get_db),
):
    team_id = await get_or_create_team_for_user(db, firebase_uid=user["uid"], email=user["email"])
    folders = await list_folders(db, team_id)
    return {"folders": folders}


@app.post("/folders", status_code=201)
async def create_folder_route(
    body: CreateFolderRequest,
    user=Depends(verify_token),
    db: Prisma = Depends(get_db),
):
    team_id = await get_or_create_team_for_user(db, firebase_uid=user["uid"], email=user["email"])
    folder = await create_folder(db, team_id, body.name, body.color)
    return folder


@app.patch("/folders/{folder_id}")
async def update_folder_route(
    folder_id: str,
    body: UpdateFolderRequest,
    user=Depends(verify_token),
    db: Prisma = Depends(get_db),
):
    folder = await update_folder(db, folder_id, body.name, body.color)
    return folder


@app.delete("/folders/{folder_id}", status_code=204)
async def delete_folder_route(
    folder_id: str,
    user=Depends(verify_token),
    db: Prisma = Depends(get_db),
):
    await delete_folder(db, folder_id)


# ── Projects ──────────────────────────────────────────────────────────────────

class CreateProjectRequest(BaseModel):
    name: str
    description: str | None = None


class UpdateProjectRequest(BaseModel):
    name: str | None = None
    description: str | None = None


class CreateDocumentRequest(BaseModel):
    name: str
    size: int
    doc_type: str
    storage_key: str


@app.get("/projects")
async def list_projects_route(
    user=Depends(verify_token),
    db: Prisma = Depends(get_db),
):
    team_id = await get_or_create_team_for_user(db, firebase_uid=user["uid"], email=user["email"])
    projects = await list_projects(db, team_id)
    return {"projects": projects}


@app.post("/projects", status_code=201)
async def create_project_route(
    body: CreateProjectRequest,
    user=Depends(verify_token),
    db: Prisma = Depends(get_db),
):
    team_id = await get_or_create_team_for_user(db, firebase_uid=user["uid"], email=user["email"])
    project = await create_project(db, team_id, body.name, body.description)
    return project


@app.get("/projects/{project_id}")
async def get_project_route(
    project_id: str,
    user=Depends(verify_token),
    db: Prisma = Depends(get_db),
):
    project = await get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@app.patch("/projects/{project_id}")
async def update_project_route(
    project_id: str,
    body: UpdateProjectRequest,
    user=Depends(verify_token),
    db: Prisma = Depends(get_db),
):
    project = await update_project(db, project_id, body.name, body.description)
    return project


@app.delete("/projects/{project_id}", status_code=204)
async def delete_project_route(
    project_id: str,
    user=Depends(verify_token),
    db: Prisma = Depends(get_db),
):
    await delete_project(db, project_id)


@app.post("/projects/{project_id}/documents", status_code=201)
async def create_document_route(
    project_id: str,
    body: CreateDocumentRequest,
    user=Depends(verify_token),
    db: Prisma = Depends(get_db),
):
    doc = await create_project_document(
        db,
        project_id=project_id,
        name=body.name,
        size=body.size,
        doc_type=body.doc_type,
        storage_key=body.storage_key,
    )
    return doc


@app.delete("/projects/{project_id}/documents/{doc_id}", status_code=204)
async def delete_document_route(
    project_id: str,
    doc_id: str,
    user=Depends(verify_token),
    db: Prisma = Depends(get_db),
):
    await delete_project_document(db, doc_id)
