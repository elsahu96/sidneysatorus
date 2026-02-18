import uvicorn, os

if __name__ == "__main__":
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 8080)),
        reload=True,  # Enable auto-reload during development
    )
