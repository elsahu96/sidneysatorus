import os
import logging
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.store.postgres import PostgresStore
from deepagents.middleware.agent import AgentMiddleware
from deepagents.graph import AgentState

# ── Observability ────────────────────────────────────────────────────────────
os.environ["LANGSMITH_TRACING"] = "true"
os.environ["LANGSMITH_PROJECT"] = "osint-pipeline"
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ── Storage / Checkpointing ──────────────────────────────────────────────────
DB_URI = os.environ["POSTGRES_URI"]  # e.g. "postgresql://user:pw@host/db"

# Cross-thread persistent store — survives crashes between subagent calls
store = PostgresStore.from_conn_string(DB_URI)
store.setup()

# Full LangGraph checkpoint — lets us resume any interrupted run
checkpointer = PostgresSaver.from_conn_string(DB_URI)
checkpointer.setup()


# ── Write-Verification Middleware ────────────────────────────────────────────
class WriteVerificationMiddleware(AgentMiddleware):
    """
    Intercepts every wrap_model_call cycle and, after agent completion,
    verifies that /report/final_report.md was actually written and non-empty.
    If it isn't, injects a corrective instruction back into the model call
    so the agent retries the write before finishing.
    """

    REPORT_PATH = "/report/final_report.md"
    MIN_CHARS = 500  # tune to your expected minimum report length

    async def wrap_model_call(self, call_model, state: AgentState):
        response = await call_model(state)

        # Check after each LLM turn whether the report file has been written
        try:
            backend = state.get("backend")
            if backend:
                content = await backend.read(self.REPORT_PATH)
                if content and len(content) >= self.MIN_CHARS:
                    logger.info(
                        "✅ Report verified: %d chars at %s",
                        len(content),
                        self.REPORT_PATH,
                    )
        except FileNotFoundError:
            logger.warning(
                "⚠️  %s not found yet — writer hasn't completed.",
                self.REPORT_PATH,
            )
        except Exception as exc:
            logger.error("Write verification error: %s", exc)

        return response
