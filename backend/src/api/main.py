from dotenv import load_dotenv

load_dotenv()

import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from src.api import investigate, report, user, cases, workspace
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


@app.exception_handler(Exception)
async def prisma_engine_error_handler(request: Request, exc: Exception) -> JSONResponse:
    from prisma.engine.errors import EngineConnectionError
    if isinstance(exc, EngineConnectionError):
        logger.error("Database unavailable: %s", exc)
        return JSONResponse(
            status_code=503,
            content={"detail": "Database unavailable. Check that the Cloud SQL Auth Proxy is running."},
        )
    raise exc


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
app.include_router(cases.app)
app.include_router(workspace.app)


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
