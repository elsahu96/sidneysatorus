import logging
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
from src.service.auth import verify_token
from src.deps import get_data_factory, DataFactory
from src.service.db import create_or_get_user, create_team_with_owner, get_teams_for_user
from firebase_admin._auth_utils import EmailAlreadyExistsError

app = APIRouter(prefix="/user")

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    tenantId: str


def _create_firebase_user(email: str, password: str, tenant_id: str) -> str:
    tenant_client = tenant_mgt.auth_for_tenant(tenant_id)
    user = tenant_client.create_user(
        email=email,
        password=password,
        email_verified=False,
    )
    return user.uid


@app.post("/register")
@limiter.limit("5/minute")
async def register(
    request: Request,
    body: RegisterRequest,
    factory: DataFactory = Depends(get_data_factory),
):
    logger.info("Registering user email=%s tenant=%s", body.email, body.tenantId)
    try:
        uid = _create_firebase_user(body.email, body.password, body.tenantId)
    except EmailAlreadyExistsError:
        raise HTTPException(
            status_code=400, detail="An account with this email already exists."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    db = factory.relational.client
    user = await create_or_get_user(db, firebase_uid=uid, email=body.email)
    team = await create_team_with_owner(db, team_name=f"{body.email}'s Team", owner_id=user["id"])

    return {"uid": uid, "user_id": user["id"], "team_id": team["id"], "message": "User registered successfully"}


@app.get("/profile")
async def get_profile(
    user=Depends(verify_token),
    factory: DataFactory = Depends(get_data_factory),
):
    logger.info("Getting profile for user: %s", user["uid"])
    db = factory.relational.client
    db_user = await create_or_get_user(db, firebase_uid=user["uid"], email=user["email"])
    teams = await get_teams_for_user(db, db_user["id"])
    return {
        "uid": user["uid"],
        "user_id": db_user["id"],
        "email": user["email"],
        "tenant": user["tenant_name"],
        "teams": teams,
    }


@app.get("/teams")
async def get_teams(
    user=Depends(verify_token),
    factory: DataFactory = Depends(get_data_factory),
):
    db = factory.relational.client
    db_user = await create_or_get_user(db, firebase_uid=user["uid"], email=user["email"])
    teams = await get_teams_for_user(db, db_user["id"])
    return {"teams": teams}
