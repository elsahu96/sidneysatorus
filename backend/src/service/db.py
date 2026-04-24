"""
Database service — thin CRUD helpers over the Prisma client.

Usage:
    from src.service.db import create_or_get_user, create_case_file, ...

All functions accept a Prisma client instance (factory.relational.client)
so they stay testable without requiring a live DataFactory.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from prisma import Json, Prisma

logger = logging.getLogger(__name__)


# ── Users ─────────────────────────────────────────────────────────────────────

async def create_or_get_user(
    db: Prisma,
    firebase_uid: str,
    email: str,
    name: str | None = None,
) -> dict[str, Any]:
    """Upsert a user by Firebase UID. Returns the user record as a dict."""
    user = await db.user.find_unique(where={"firebaseUid": firebase_uid})
    if user:
        return user.model_dump()

    user = await db.user.create(
        data={
            "firebaseUid": firebase_uid,
            "email": email,
            "name": name,
        }
    )
    logger.info("Created user id=%s firebaseUid=%s", user.id, firebase_uid)
    return user.model_dump()


async def get_user_by_firebase_uid(db: Prisma, firebase_uid: str) -> dict[str, Any] | None:
    user = await db.user.find_unique(where={"firebaseUid": firebase_uid})
    return user.model_dump() if user else None


# ── Teams ─────────────────────────────────────────────────────────────────────

async def create_team_with_owner(
    db: Prisma,
    team_name: str,
    owner_id: str,
) -> dict[str, Any]:
    """Create a team and add owner_id as OWNER in a single transaction."""
    team = await db.team.create(data={"name": team_name})
    await db.teammembership.create(
        data={
            "teamId": team.id,
            "userId": owner_id,
            "role": "OWNER",
        }
    )
    logger.info("Created team id=%s owner=%s", team.id, owner_id)
    return team.model_dump()


async def get_teams_for_user(db: Prisma, user_id: str) -> list[dict[str, Any]]:
    memberships = await db.teammembership.find_many(
        where={"userId": user_id},
        include={"team": True},
    )
    return [m.team.model_dump() for m in memberships if m.team]


async def get_or_create_team_for_user(
    db: Prisma,
    firebase_uid: str,
    email: str,
) -> str:
    """Return the user's first team ID, auto-creating a personal team if none exists."""
    db_user = await create_or_get_user(db, firebase_uid=firebase_uid, email=email)
    teams = await get_teams_for_user(db, db_user["id"])
    if teams:
        return teams[0]["id"]
    team = await create_team_with_owner(db, team_name=f"{email}'s Team", owner_id=db_user["id"])
    return team["id"]


# ── Case Files ─────────────────────────────────────────────────────────────────

async def create_case_file(
    db: Prisma,
    team_id: str,
    subject: str,
    messages: list[dict[str, Any]],
    case_number: str | None = None,
    folder_id: str | None = None,
    category: str | None = None,
    project_id: str | None = None,
) -> dict[str, Any]:
    if not case_number:
        ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        case_number = f"CASE-{ts}"

    data: dict[str, Any] = {
        "teamId": team_id,
        "caseNumber": case_number,
        "subject": subject,
        "messages": Json(messages),
    }
    if folder_id is not None:
        data["folderId"] = folder_id
    if category is not None:
        data["category"] = category
    if project_id is not None:
        data["projectId"] = project_id

    case = await db.casefile.create(data=data)
    logger.info("Created case_file id=%s team=%s", case.id, team_id)
    return case.model_dump()


async def list_case_files(
    db: Prisma,
    team_id: str,
    folder_id: str | None = None,
    project_id: str | None = None,
) -> list[dict[str, Any]]:
    where: dict[str, Any] = {"teamId": team_id}
    if folder_id is not None:
        where["folderId"] = folder_id
    if project_id is not None:
        where["projectId"] = project_id

    cases = await db.casefile.find_many(
        where=where,
        order={"createdAt": "desc"},
    )
    return [c.model_dump() for c in cases]


async def get_case_file(db: Prisma, case_id: str) -> dict[str, Any] | None:
    case = await db.casefile.find_unique(where={"id": case_id})
    return case.model_dump() if case else None


async def update_case_file(
    db: Prisma,
    case_id: str,
    subject: str | None = None,
    case_number: str | None = None,
    folder_id: str | None = None,
    category: str | None = None,
    project_id: str | None = None,
    messages: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    data: dict[str, Any] = {}
    if subject is not None:
        data["subject"] = subject
    if case_number is not None:
        data["caseNumber"] = case_number
    if folder_id is not None:
        data["folderId"] = folder_id
    if category is not None:
        data["category"] = category
    if project_id is not None:
        data["projectId"] = project_id
    if messages is not None:
        data["messages"] = Json(messages)
    case = await db.casefile.update(where={"id": case_id}, data=data)
    return case.model_dump()


async def delete_case_file(db: Prisma, case_id: str) -> bool:
    case = await db.casefile.delete(where={"id": case_id})
    return case is not None


# ── Folders ────────────────────────────────────────────────────────────────────

async def create_folder(
    db: Prisma,
    team_id: str,
    name: str,
    color: str | None = None,
) -> dict[str, Any]:
    folder = await db.folder.create(
        data={"teamId": team_id, "name": name, "color": color}
    )
    logger.info("Created folder id=%s team=%s", folder.id, team_id)
    return folder.model_dump()


async def list_folders(db: Prisma, team_id: str) -> list[dict[str, Any]]:
    folders = await db.folder.find_many(
        where={"teamId": team_id},
        order={"createdAt": "desc"},
    )
    return [f.model_dump() for f in folders]


async def update_folder(
    db: Prisma,
    folder_id: str,
    name: str | None = None,
    color: str | None = None,
) -> dict[str, Any]:
    data: dict[str, Any] = {}
    if name is not None:
        data["name"] = name
    if color is not None:
        data["color"] = color
    folder = await db.folder.update(where={"id": folder_id}, data=data)
    return folder.model_dump()


async def delete_folder(db: Prisma, folder_id: str) -> bool:
    folder = await db.folder.delete(where={"id": folder_id})
    return folder is not None


# ── Projects ──────────────────────────────────────────────────────────────────

async def create_project(
    db: Prisma,
    team_id: str,
    name: str,
    description: str | None = None,
) -> dict[str, Any]:
    project = await db.project.create(
        data={"teamId": team_id, "name": name, "description": description}
    )
    logger.info("Created project id=%s team=%s", project.id, team_id)
    return project.model_dump()


async def list_projects(db: Prisma, team_id: str) -> list[dict[str, Any]]:
    projects = await db.project.find_many(
        where={"teamId": team_id},
        order={"createdAt": "desc"},
    )
    return [p.model_dump() for p in projects]


async def get_project(db: Prisma, project_id: str) -> dict[str, Any] | None:
    project = await db.project.find_unique(
        where={"id": project_id},
        include={"documents": True},
    )
    return project.model_dump() if project else None


async def update_project(
    db: Prisma,
    project_id: str,
    name: str | None = None,
    description: str | None = None,
) -> dict[str, Any]:
    data: dict[str, Any] = {}
    if name is not None:
        data["name"] = name
    if description is not None:
        data["description"] = description
    project = await db.project.update(where={"id": project_id}, data=data)
    return project.model_dump()


async def delete_project(db: Prisma, project_id: str) -> bool:
    project = await db.project.delete(where={"id": project_id})
    return project is not None


# ── Project Documents ─────────────────────────────────────────────────────────

async def create_project_document(
    db: Prisma,
    project_id: str,
    name: str,
    size: int,
    doc_type: str,
    storage_key: str,
) -> dict[str, Any]:
    doc = await db.projectdocument.create(
        data={
            "projectId": project_id,
            "name": name,
            "size": size,
            "type": doc_type,
            "storageKey": storage_key,
        }
    )
    return doc.model_dump()


async def delete_project_document(db: Prisma, doc_id: str) -> bool:
    doc = await db.projectdocument.delete(where={"id": doc_id})
    return doc is not None


# ── Chat Sessions & Messages ──────────────────────────────────────────────────
# Low-level CRUD helpers.  Business logic (sliding window, archival) lives in
# src/service/chat_session_service.py — use ChatSessionService from there.

async def get_or_create_chat_session(db: Prisma, session_id: str) -> dict[str, Any]:
    """Upsert a bare session by ID (no user, no title). Legacy helper."""
    session = await db.chatsession.find_unique(where={"id": session_id})
    if session:
        return session.model_dump()
    session = await db.chatsession.create(
        data={"id": session_id, "contextWindow": Json([])}
    )
    return session.model_dump()


async def list_messages(
    db: Prisma,
    session_id: str,
    limit: int = 100,
) -> list[dict[str, Any]]:
    messages = await db.message.find_many(
        where={"chatSessionId": session_id},
        order={"createdAt": "asc"},
        take=limit,
    )
    return [m.model_dump() for m in messages]
