from dotenv import load_dotenv

load_dotenv()

import os
import logging
from src.api import investigate, report, user
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


BUCKET_NAME = (
    os.getenv("GCS_PATH_PREFIX") or "run-sources-satorus-sidney-europe-central2"
)
logger = logging.getLogger(__name__)
_FRONTEND_URL = os.getenv("FRONTEND_URL") or "http://localhost:4567"


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
