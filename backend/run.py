import logging
import uvicorn, os

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
if __name__ == "__main__":
    # Cloud Run sets K_SERVICE; reload spawns a child process and is wrong for production.
    port = int(os.environ.get("PORT", 8080))
    use_reload = os.environ.get("K_SERVICE") is None
    uvicorn.run(
        "src.api.main:app",
        host="0.0.0.0",
        port=port,
        reload=use_reload,
    )
