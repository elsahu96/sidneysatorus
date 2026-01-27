from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from prisma import Prisma

router = APIRouter()
db = Prisma()


class UserCreate(BaseModel):
    email: str
    name: str | None = None


class UserResponse(BaseModel):
    id: str
    email: str
    name: str | None


@router.post("/api/users", response_model=UserResponse)
async def create_user(user: UserCreate):
    try:
        new_user = await db.user.create(data=user.model_dump())
        return new_user
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/users", response_model=list[UserResponse])
async def list_users():
    users = await db.user.find_many()
    return users
