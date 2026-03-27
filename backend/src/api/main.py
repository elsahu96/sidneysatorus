from dotenv import load_dotenv

load_dotenv()

import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from src.api import investigate, report, user
from src.service.auth import verify_token
from src.data import init_data_factory, shutdown_data_factory
import firebase_admin
from firebase_admin import credentials

logger = logging.getLogger(__name__)

_FRONTEND_URL = os.getenv("FRONTEND_URL") or "http://localhost:4567"

cred = credentials.Certificate(os.getenv("GOOGLE_APPLICATION_CREDENTIALS"))
firebase_admin.initialize_app(cred)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_data_factory()
    yield
    await shutdown_data_factory()


app = FastAPI(title="Sidney Backend API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[_FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(investigate.app, tags=["investigate"])
app.include_router(report.app, tags=["reports"])
app.include_router(user.app, tags=["user"])


@app.get("/")
async def root():
    logger.debug("GET /")
    return {"message": "Backend API is running"}


@app.get("/health")
async def health_check():
    logger.debug("GET /health")
    return {"status": "healthy"}


@app.get("/auth/protected")
def protected(user: dict = Depends(verify_token)):
    logger.debug("GET /auth/protected")
    return {
        "message": f"Hello {user['email']}",
        "uid": user["uid"],
        "tenant": user["tenant_id"],
    }
