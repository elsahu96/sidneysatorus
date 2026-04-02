from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import asyncio
import os

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


def _cors_allow_origins() -> list[str]:
    """CORS origins from FRONTEND_URL (comma-separated for multiple Cloud Run hostnames)."""
    raw = os.getenv("FRONTEND_URL") or "http://localhost:4567"
    return [o.strip() for o in raw.split(",") if o.strip()]

# On Cloud Run: GOOGLE_APPLICATION_CREDENTIALS is not set — use ADC (the revision's service account).
# Locally: point GOOGLE_APPLICATION_CREDENTIALS at your Firebase service-account JSON and it is used instead.
_firebase_cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
if _firebase_cred_path:
    firebase_admin.initialize_app(credentials.Certificate(_firebase_cred_path))
else:
    firebase_admin.initialize_app()


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
    allow_origins=_cors_allow_origins(),
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


@app.websocket("/ws/{task_id}")
async def websocket_endpoint(websocket: WebSocket, task_id: str):

    await websocket.accept()
    await websocket.send_json({"status": "connected", "task_id": task_id})

    try:
        timeout = 60  
        elapsed = 0

        while elapsed < timeout:
            # Logic to check the report file generation

            await websocket.send_json(
                {
                    "status": "completed",
                    "task_id": task_id,
                    "report_id": task_id,
                    "message": "Report generated successfully",
                }
            )
            return

            await asyncio.sleep(1)
            elapsed += 1

            # Logic to send the completed message
            # await websocket.send_json({"status": "completed"})
        await websocket.send_json(
            {"status": "error", "message": "Timed out waiting for report."}
        )
    except WebSocketDisconnect:
        logger.warning(f"Client {task_id} disconnected")
    except Exception as e:
        logger.error(f"Error in websocket_endpoint: {e}")
        await websocket.send_json({"status": "error", "message": str(e)})
