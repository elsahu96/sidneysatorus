"""
Folder and Project CRUD endpoints.
All endpoints require a valid Firebase token.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.service.auth import verify_token
from src.deps import get_data_factory, DataFactory
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


async def _resolve_team(user: dict, factory: DataFactory) -> str:
    return await get_or_create_team_for_user(
        await factory.relational.get_client(),
        firebase_uid=user["uid"],
        email=user["email"],
    )


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
    factory: DataFactory = Depends(get_data_factory),
):
    team_id = await _resolve_team(user, factory)
    folders = await list_folders(factory.relational.client, team_id)
    return {"folders": folders}


@app.post("/folders", status_code=201)
async def create_folder_route(
    body: CreateFolderRequest,
    user=Depends(verify_token),
    factory: DataFactory = Depends(get_data_factory),
):
    team_id = await _resolve_team(user, factory)
    folder = await create_folder(factory.relational.client, team_id, body.name, body.color)
    return folder


@app.patch("/folders/{folder_id}")
async def update_folder_route(
    folder_id: str,
    body: UpdateFolderRequest,
    user=Depends(verify_token),
    factory: DataFactory = Depends(get_data_factory),
):
    folder = await update_folder(factory.relational.client, folder_id, body.name, body.color)
    return folder


@app.delete("/folders/{folder_id}", status_code=204)
async def delete_folder_route(
    folder_id: str,
    user=Depends(verify_token),
    factory: DataFactory = Depends(get_data_factory),
):
    await delete_folder(factory.relational.client, folder_id)


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
    factory: DataFactory = Depends(get_data_factory),
):
    team_id = await _resolve_team(user, factory)
    projects = await list_projects(factory.relational.client, team_id)
    return {"projects": projects}


@app.post("/projects", status_code=201)
async def create_project_route(
    body: CreateProjectRequest,
    user=Depends(verify_token),
    factory: DataFactory = Depends(get_data_factory),
):
    team_id = await _resolve_team(user, factory)
    project = await create_project(factory.relational.client, team_id, body.name, body.description)
    return project


@app.get("/projects/{project_id}")
async def get_project_route(
    project_id: str,
    user=Depends(verify_token),
    factory: DataFactory = Depends(get_data_factory),
):
    project = await get_project(factory.relational.client, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@app.patch("/projects/{project_id}")
async def update_project_route(
    project_id: str,
    body: UpdateProjectRequest,
    user=Depends(verify_token),
    factory: DataFactory = Depends(get_data_factory),
):
    project = await update_project(factory.relational.client, project_id, body.name, body.description)
    return project


@app.delete("/projects/{project_id}", status_code=204)
async def delete_project_route(
    project_id: str,
    user=Depends(verify_token),
    factory: DataFactory = Depends(get_data_factory),
):
    await delete_project(factory.relational.client, project_id)


@app.post("/projects/{project_id}/documents", status_code=201)
async def create_document_route(
    project_id: str,
    body: CreateDocumentRequest,
    user=Depends(verify_token),
    factory: DataFactory = Depends(get_data_factory),
):
    doc = await create_project_document(
        factory.relational.client,
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
    factory: DataFactory = Depends(get_data_factory),
):
    await delete_project_document(factory.relational.client, doc_id)
