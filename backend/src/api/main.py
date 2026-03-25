from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import asyncio
import os

load_dotenv()

import os
import logging
from src.api import investigate, report, user
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Depends
from src.service.auth import verify_token
import firebase_admin
from firebase_admin import credentials, auth as admin_auth

logger = logging.getLogger(__name__)
BUCKET_NAME = (
    os.getenv("GCS_PATH_PREFIX") or "run-sources-satorus-sidney-europe-central2"
)
_FRONTEND_URL = os.getenv("FRONTEND_URL") or "http://localhost:4567"


cred = credentials.Certificate(os.getenv("GOOGLE_APPLICATION_CREDENTIALS"))
firebase_admin.initialize_app(cred)

app = FastAPI(title="Sidney Backend API", version="1.0.0")


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


# Health check endpoint
@app.get("/")
async def root():
    logger.debug("GET /")
    return {"message": "Backend API is running"}


@app.get("/health")
async def health_check():
    """Health check; pings DB and reconnects if connection was closed."""
    logger.debug("GET /health")
    try:
        return {"status": "healthy"}
    except Exception as e:
        logger.warning(
            "Health check failed: %s", e, exc_info=logger.isEnabledFor(logging.DEBUG)
        )


@app.get("/auth/protected")
def protected(user: dict = Depends(verify_token)):
    logger.debug("GET /auth/protected")
    # 到这里 token 已经验证通过，user 包含用户信息
    return {
        "message": f"Hello {user['email']}",
        "uid": user["uid"],
        "tenant": user["tenant_id"],
    }


@app.websocket("/ws/{task_id}")
async def websocket_endpoint(websocket: WebSocket, task_id: str):
    # FastAPI default checks the Origin in the Headers
    # If forwarded through Vite proxy, Origin may be http://localhost:4567

    # Force accept the connection (this will skip the default same-origin check)
    await websocket.accept()

    try:
        while True:
            # Logic to check the report file generation
            await asyncio.sleep(1)
            # Logic to send the completed message
            # await websocket.send_json({"status": "completed"})
    except WebSocketDisconnect:
        print(f"Client {task_id} disconnected")
