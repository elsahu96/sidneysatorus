import logging
import multiprocessing
import uuid
import asyncio
from dotenv import load_dotenv

from src.service import investigate_service

load_dotenv()

from fastapi import APIRouter
from pydantic import BaseModel

app = APIRouter()

logger = logging.getLogger(__name__)


class InvestigateRequest(BaseModel):
    query: str


# Store the process handle for running tasks
# Key: task_id, Value: Process Object
running_tasks = {}


def worker_wrapper(query: str, task_id: str):
    """
    A synchronous wrapper that runs in a subprocess.
    It is responsible for starting a new event loop to run the asynchronous investigation logic.
    """
    try:
        # Run the asynchronous investigation logic in a new event loop
        asyncio.run(investigate_service.investigate(query))
    except Exception as e:
        logger.error(f"Task {task_id} failed: {e}")


@app.post("/investigate")
async def investigate(request: InvestigateRequest):
    task_id = str(uuid.uuid4())

    # Create a separate process to execute AI logic
    p = multiprocessing.Process(target=worker_wrapper, args=(request.query, task_id))
    p.start()
    # Store the process handle
    running_tasks[task_id] = p
    logger.info("Investigate API Done: task_id=%s started", task_id)
    return {"id": task_id, "status": "started"}


@app.post("/terminate/{task_id}")
async def terminate_investigate(task_id: str):
    p = running_tasks.get(task_id)

    if p and p.is_alive():
        # --- Force termination: kill the subprocess directly ---
        p.terminate()
        p.join()  # Clean up resources
        del running_tasks[task_id]
        return {
            "message": f"Task {task_id} has been terminated and GPU/CPU resources freed."
        }

    return {"message": "Task not found or already finished."}
