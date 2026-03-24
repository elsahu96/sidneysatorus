import logging
import uvicorn, os

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
if __name__ == "__main__":
    uvicorn.run(
        "src.api.main:app",
        host="0.0.0.0",
    port=int(os.environ.get("PORT", 8080)),
        reload=True,  # Enable auto-reload during development
    )
