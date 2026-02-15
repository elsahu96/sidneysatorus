"""
Case Files, Folders, Projects, and Project Documents API.
All routes require auth and are scoped by team_id.
"""

from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from prisma import Prisma
from prisma.fields import Json
from pydantic import BaseModel

from src.auth import get_current_user_and_team
from src.deps import get_db
from src.storage import delete_file as storage_delete_file
from src.storage import get_presigned_url
from src.storage import upload_file as storage_upload_file

router = APIRouter(prefix="/api", tags=["case-files"])


async def require_auth(request: Request, database: Prisma = Depends(get_db)):
    return await get_current_user_and_team(request, database)


# --- Case Files ---


class CaseFileCreate(BaseModel):
    caseNumber: str
    subject: str
    folderId: str | None = None
    category: str | None = None
    projectId: str | None = None
    messages: list[dict[str, Any]] = []


class CaseFileUpdate(BaseModel):
    caseNumber: str | None = None
    subject: str | None = None
    folderId: str | None = None
    category: str | None = None
    projectId: str | None = None
    messages: list[dict[str, Any]] | None = None


@router.get("/case-files")
async def list_case_files(
    current_user: tuple[str, str] = Depends(require_auth),
    database: Prisma = Depends(get_db),
):
    user_id, team_id = current_user
    items = await database.casefile.find_many(
        where={"teamId": team_id}, order={"timestamp": "desc"}
    )
    return {
        "caseFiles": [
            {
                "id": x.id,
                "caseNumber": x.caseNumber,
                "subject": x.subject,
                "timestamp": int(x.timestamp.timestamp() * 1000),
                "folderId": x.folderId,
                "category": x.category,
                "projectId": x.projectId,
                "messages": x.messages if isinstance(x.messages, list) else [],
            }
            for x in items
        ]
    }


@router.post("/case-files")
async def create_case_file(
    body: CaseFileCreate,
    current_user: tuple[str, str] = Depends(require_auth),
    database: Prisma = Depends(get_db),
):
    user_id, team_id = current_user
    cf = await database.casefile.create(
        data={
            "team": {"connect": {"id": team_id}},
            "caseNumber": body.caseNumber,
            "subject": body.subject,
            "folderId": body.folderId,
            "category": body.category,
            "projectId": body.projectId,
            "messages": Json(body.messages),
        }
    )
    return {
        "id": cf.id,
        "caseNumber": cf.caseNumber,
        "subject": cf.subject,
        "timestamp": int(cf.timestamp.timestamp() * 1000),
        "folderId": cf.folderId,
        "category": cf.category,
        "projectId": cf.projectId,
        "messages": cf.messages if isinstance(cf.messages, list) else [],
    }


@router.get("/case-files/{case_file_id}")
async def get_case_file(
    case_file_id: str,
    current_user: tuple[str, str] = Depends(require_auth),
    database: Prisma = Depends(get_db),
):
    user_id, team_id = current_user
    cf = await database.casefile.find_first(
        where={"id": case_file_id, "teamId": team_id}
    )
    if not cf:
        raise HTTPException(status_code=404, detail="Case file not found")
    return {
        "id": cf.id,
        "caseNumber": cf.caseNumber,
        "subject": cf.subject,
        "timestamp": int(cf.timestamp.timestamp() * 1000),
        "folderId": cf.folderId,
        "category": cf.category,
        "projectId": cf.projectId,
        "messages": cf.messages if isinstance(cf.messages, list) else [],
    }


@router.patch("/case-files/{case_file_id}")
async def update_case_file(
    case_file_id: str,
    body: CaseFileUpdate,
    current_user: tuple[str, str] = Depends(require_auth),
    database: Prisma = Depends(get_db),
):
    user_id, team_id = current_user
    cf = await database.casefile.find_first(
        where={"id": case_file_id, "teamId": team_id}
    )
    if not cf:
        raise HTTPException(status_code=404, detail="Case file not found")
    data = {}
    if body.caseNumber is not None:
        data["caseNumber"] = body.caseNumber
    if body.subject is not None:
        data["subject"] = body.subject
    if body.folderId is not None:
        data["folderId"] = body.folderId
    if body.category is not None:
        data["category"] = body.category
    if body.projectId is not None:
        data["projectId"] = body.projectId
    if body.messages is not None:
        data["messages"] = body.messages
    updated = await database.casefile.update(where={"id": case_file_id}, data=data)
    return {
        "id": updated.id,
        "caseNumber": updated.caseNumber,
        "subject": updated.subject,
        "timestamp": int(updated.timestamp.timestamp() * 1000),
        "folderId": updated.folderId,
        "category": updated.category,
        "projectId": updated.projectId,
        "messages": updated.messages if isinstance(updated.messages, list) else [],
    }


@router.delete("/case-files/{case_file_id}")
async def delete_case_file(
    case_file_id: str,
    current_user: tuple[str, str] = Depends(require_auth),
    database: Prisma = Depends(get_db),
):
    user_id, team_id = current_user
    cf = await database.casefile.find_first(
        where={"id": case_file_id, "teamId": team_id}
    )
    if not cf:
        raise HTTPException(status_code=404, detail="Case file not found")
    await database.casefile.delete(where={"id": case_file_id})
    return {"ok": True}


# --- Folders ---


class FolderCreate(BaseModel):
    name: str
    color: str | None = None


class FolderUpdate(BaseModel):
    name: str | None = None
    color: str | None = None


@router.get("/folders")
async def list_folders(
    current_user: tuple[str, str] = Depends(require_auth),
    database: Prisma = Depends(get_db),
):
    user_id, team_id = current_user
    items = await database.folder.find_many(
        where={"teamId": team_id}, order={"timestamp": "desc"}
    )
    return {
        "folders": [
            {
                "id": x.id,
                "name": x.name,
                "timestamp": int(x.timestamp.timestamp() * 1000),
                "color": x.color,
            }
            for x in items
        ]
    }


@router.post("/folders")
async def create_folder(
    body: FolderCreate,
    current_user: tuple[str, str] = Depends(require_auth),
    database: Prisma = Depends(get_db),
):
    user_id, team_id = current_user
    f = await database.folder.create(
        data={"teamId": team_id, "name": body.name, "color": body.color}
    )
    return {
        "id": f.id,
        "name": f.name,
        "timestamp": int(f.timestamp.timestamp() * 1000),
        "color": f.color,
    }


@router.patch("/folders/{folder_id}")
async def update_folder(
    folder_id: str,
    body: FolderUpdate,
    current_user: tuple[str, str] = Depends(require_auth),
    database: Prisma = Depends(get_db),
):
    user_id, team_id = current_user
    f = await database.folder.find_first(where={"id": folder_id, "teamId": team_id})
    if not f:
        raise HTTPException(status_code=404, detail="Folder not found")
    data = {}
    if body.name is not None:
        data["name"] = body.name
    if body.color is not None:
        data["color"] = body.color
    updated = await database.folder.update(where={"id": folder_id}, data=data)
    return {
        "id": updated.id,
        "name": updated.name,
        "timestamp": int(updated.timestamp.timestamp() * 1000),
        "color": updated.color,
    }


@router.delete("/folders/{folder_id}")
async def delete_folder(
    folder_id: str,
    current_user: tuple[str, str] = Depends(require_auth),
    database: Prisma = Depends(get_db),
):
    user_id, team_id = current_user
    f = await database.folder.find_first(where={"id": folder_id, "teamId": team_id})
    if not f:
        raise HTTPException(status_code=404, detail="Folder not found")
    await database.folder.delete(where={"id": folder_id})
    return {"ok": True}


# --- Projects ---


class ProjectCreate(BaseModel):
    name: str
    description: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


@router.get("/projects")
async def list_projects(
    current_user: tuple[str, str] = Depends(require_auth),
    database: Prisma = Depends(get_db),
):
    user_id, team_id = current_user
    items = await database.project.find_many(
        where={"teamId": team_id},
        order={"timestamp": "desc"},
        include={"documents": True},
    )
    out = []
    for p in items:
        docs = [
            {
                "id": d.id,
                "name": d.name,
                "size": d.size,
                "type": d.type,
                "uploadedAt": int(d.uploadedAt.timestamp() * 1000),
                "storageKey": d.storageKey,
            }
            for d in p.documents
        ]
        for d in docs:
            d["url"] = get_presigned_url(d["storageKey"]) or ""
        out.append(
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "timestamp": int(p.timestamp.timestamp() * 1000),
                "documents": docs,
                "reports": [],
                "chatHistory": [],
            }
        )
    return {"projects": out}


@router.post("/projects")
async def create_project(
    body: ProjectCreate,
    current_user: tuple[str, str] = Depends(require_auth),
    database: Prisma = Depends(get_db),
):
    user_id, team_id = current_user
    p = await database.project.create(
        data={"teamId": team_id, "name": body.name, "description": body.description}
    )
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "timestamp": int(p.timestamp.timestamp() * 1000),
        "documents": [],
        "reports": [],
        "chatHistory": [],
    }


@router.get("/projects/{project_id}")
async def get_project(
    project_id: str,
    current_user: tuple[str, str] = Depends(require_auth),
    database: Prisma = Depends(get_db),
):
    user_id, team_id = current_user
    p = await database.project.find_first(
        where={"id": project_id, "teamId": team_id},
        include={"documents": True},
    )
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    docs = [
        {
            "id": d.id,
            "name": d.name,
            "size": d.size,
            "type": d.type,
            "uploadedAt": int(d.uploadedAt.timestamp() * 1000),
            "url": get_presigned_url(d.storageKey) or "",
        }
        for d in p.documents
    ]
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "timestamp": int(p.timestamp.timestamp() * 1000),
        "documents": docs,
        "reports": [],
        "chatHistory": [],
    }


@router.patch("/projects/{project_id}")
async def update_project(
    project_id: str,
    body: ProjectUpdate,
    current_user: tuple[str, str] = Depends(require_auth),
    database: Prisma = Depends(get_db),
):
    user_id, team_id = current_user
    p = await database.project.find_first(where={"id": project_id, "teamId": team_id})
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    data = {}
    if body.name is not None:
        data["name"] = body.name
    if body.description is not None:
        data["description"] = body.description
    updated = await database.project.update(where={"id": project_id}, data=data)
    return {
        "id": updated.id,
        "name": updated.name,
        "description": updated.description,
        "timestamp": int(updated.timestamp.timestamp() * 1000),
    }


@router.delete("/projects/{project_id}")
async def delete_project(
    project_id: str,
    current_user: tuple[str, str] = Depends(require_auth),
    database: Prisma = Depends(get_db),
):
    user_id, team_id = current_user
    p = await database.project.find_first(
        where={"id": project_id, "teamId": team_id}, include={"documents": True}
    )
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    for d in p.documents:
        storage_delete_file(d.storageKey)
    await database.project.delete(where={"id": project_id})
    return {"ok": True}


# --- Project documents (upload + list + delete) ---


@router.post("/projects/{project_id}/documents")
async def upload_project_document(
    project_id: str,
    file: UploadFile = File(...),
    current_user: tuple[str, str] = Depends(require_auth),
    database: Prisma = Depends(get_db),
):
    user_id, team_id = current_user
    p = await database.project.find_first(where={"id": project_id, "teamId": team_id})
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    content = await file.read()
    storage_key = storage_upload_file(
        team_id,
        content,
        file.filename or "file",
        file.content_type or "application/octet-stream",
    )
    if not storage_key:
        raise HTTPException(
            status_code=503, detail="File storage not configured (GCS_BUCKET)"
        )
    doc = await database.projectdocument.create(
        data={
            "projectId": project_id,
            "name": file.filename or "file",
            "size": len(content),
            "type": file.content_type or "application/octet-stream",
            "storageKey": storage_key,
        }
    )
    url = get_presigned_url(storage_key) or ""
    return {
        "id": doc.id,
        "name": doc.name,
        "size": doc.size,
        "type": doc.type,
        "uploadedAt": int(doc.uploadedAt.timestamp() * 1000),
        "url": url,
    }


@router.delete("/projects/{project_id}/documents/{document_id}")
async def delete_project_document(
    project_id: str,
    document_id: str,
    current_user: tuple[str, str] = Depends(require_auth),
    database: Prisma = Depends(get_db),
):
    user_id, team_id = current_user
    p = await database.project.find_first(where={"id": project_id, "teamId": team_id})
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    doc = await database.projectdocument.find_first(
        where={"id": document_id, "projectId": project_id}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    storage_delete_file(doc.storageKey)
    await database.projectdocument.delete(where={"id": document_id})
    return {"ok": True}


# --- Generic upload (returns storage key + URL for use in investigations etc.) ---


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: tuple[str, str] = Depends(require_auth),
):
    user_id, team_id = current_user
    content = await file.read()
    storage_key = storage_upload_file(
        team_id,
        content,
        file.filename or "file",
        file.content_type or "application/octet-stream",
    )
    if not storage_key:
        raise HTTPException(
            status_code=503, detail="File storage not configured (GCS_BUCKET)"
        )
    url = get_presigned_url(storage_key) or ""
    return {
        "storageKey": storage_key,
        "url": url,
        "name": file.filename,
        "size": len(content),
    }
