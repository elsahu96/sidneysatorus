from pydantic_settings import BaseSettings
from functools import lru_cache
import os
from dotenv import load_dotenv

load_dotenv()

# class Settings(BaseSettings):
#     STORAGE_BACKEND: str = "local"  # "local" | "gcs"
#     LOCAL_STORAGE_DIR: str = "./storage"
#     BASE_URL: str = "http://localhost:8080"
#     SECRET_KEY: str = "change-me-in-production"
#     GCS_BUCKET: str = ""

#     class Config:
#         env_file = ".env"


# @lru_cache
# def get_settings():
#     return Settings()


# settings = get_settings()


def get_storage_service():
    storage_backend = os.getenv("STORAGE_BACKEND")
    gcs_bucket = os.getenv("GCS_BUCKET", "")
    local_storage_dir = os.getenv("LOCAL_STORAGE_DIR", "")
    base_url = os.getenv("BASE_URL", "")
    secret_key = os.getenv("SECRET_KEY", "")
    if storage_backend == "gcs":
        from src.service.storage import GCSStorageService

        return GCSStorageService(gcs_bucket)
    else:
        from src.service.storage import LocalStorageService

        return LocalStorageService(
            base_dir=local_storage_dir, base_url=base_url, secret_key=secret_key
        )
