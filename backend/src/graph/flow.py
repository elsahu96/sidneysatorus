import json
import logging
import os
import re
import uuid
from dotenv import load_dotenv

load_dotenv()
from src.graph.tools.writer import _last_write_result  # 直接导入 side-channel
from deepagents.graph import create_deep_agent
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command

from src.graph.agents import planning_subagent, research_subagent, writer_subagent

# ── Logging (replaces raw print for non-interactive output) ─────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

MODEL_NAME = os.environ.get("GEMINI_MODEL_NAME")
if not MODEL_NAME:
    raise EnvironmentError("GEMINI_MODEL_NAME is not set in environment")

checkpointer = MemorySaver()

agent = create_deep_agent(
    model=MODEL_NAME,
    tools=[],
    subagents=[planning_subagent, research_subagent, writer_subagent],
    checkpointer=checkpointer,
    interrupt_on={
        "search_opoint": {"allowed_decisions": ["approve", "edit", "reject"]},
    },
    system_prompt=SystemMessage(
        content="""You are an orchestrator agent managing an investigation and writing pipeline.
        For any investigation task:
        1. Use the 'research-agent' subagent to research the topic and gather information.
        2. Use the 'writer-agent' subagent to write a structured JSON report based on the findings.
        The writer-agent will return a json_path. Include that path in your final message."""
    ),
)


# ── HITL helpers ─────────────────────────────────────────────────────────────


def _handle_action_request(action_request: dict, auto_approve: bool) -> dict:
    """Return a single HITL decision dict for one action request."""
    tool_name = action_request.get("name", "unknown")
    description = action_request.get("description", "")

    print(f"\n  [hitl] Tool    : {tool_name}")
    if description:
        print(f"  [hitl] Details : {description}")

    if auto_approve:
        print(f"  [hitl] Auto-approved.")
        return {"type": "approve"}

    user_input = input("\n  → Approve? (yes / edit / no): ").strip().lower()

    if user_input in ("yes", "y"):
        print("  [hitl] Approved.")
        return {"type": "approve"}

    if user_input == "edit":
        current_args = action_request.get("args", {})
        print(f"  Current args:\n{json.dumps(current_args, indent=2)}")

        new_args_str = input("  → New arguments (JSON, or Enter to keep): ").strip()
        new_name = input("  → New tool name (or Enter to keep): ").strip()

        # Safe JSON parse with fallback
        if new_args_str:
            try:
                new_args = json.loads(new_args_str)
            except json.JSONDecodeError as e:
                print(f"  [!] Invalid JSON ({e}). Keeping original args.")
                new_args = current_args
        else:
            new_args = current_args

        resolved_name = new_name or tool_name
        print(f"  [hitl] Edited → '{resolved_name}'.")
        return {
            "type": "edit",
            "edited_action": {"name": resolved_name, "args": new_args},
        }

    # reject
    reason = input("  → Reason for rejection (optional): ").strip()
    print(f"  [hitl] Rejected." + (f" Reason: {reason}" if reason else ""))
    return {"type": "reject", "message": reason} if reason else {"type": "reject"}


# ── Main runner ───────────────────────────────────────────────────────────────


def run_with_hitl(
    task: str,
    thread_id: str | None = None,
    auto_approve: bool = False,
) -> str | None:
    """
    Run the agent with human-in-the-loop handling.

    Args:
        task:         The investigation task.
        thread_id:    Unique thread id. Auto-generated if not provided to avoid
                      state bleed between runs.
        auto_approve: Skip human prompts and approve all actions automatically.

    Returns:
        The json_path of the written report, or None if the writer did not run.
    """
    _last_write_result.clear()
    # Auto-generate thread_id to prevent checkpointer state bleed across runs
    if thread_id is None:
        thread_id = f"thread-{uuid.uuid4().hex[:8]}"

    config = {"configurable": {"thread_id": thread_id}}

    print(f"\n{'='*60}")
    print(f"  TASK   : {task}")
    print(f"  THREAD : {thread_id}")
    print(f"  MODEL  : {MODEL_NAME}")
    print(f"{'='*60}\n")

    log.info("Invoking agent...")
    result = agent.invoke({"messages": [HumanMessage(content=task)]}, config=config)
    log.info("Initial invocation complete.")

    iteration = 0
    while True:
        interrupts = result.get("__interrupt__", [])
        if not interrupts:
            log.info("No pending interrupts — task complete.")
            break

        iteration += 1
        decisions: list[dict] = []

        for interrupt in interrupts:
            # Defensive: handle unexpected interrupt shapes
            if not isinstance(interrupt.value, dict):
                log.warning("Unexpected interrupt format: %s", interrupt.value)
                continue

            action_requests = interrupt.value.get("action_requests", [])
            if not action_requests:
                log.warning(
                    "Interrupt contained no action_requests: %s", interrupt.value
                )
                continue

            print(
                f"\n[agent] Iteration {iteration}: {len(action_requests)} action(s) pending.\n"
            )

            for action_request in action_requests:
                decision = _handle_action_request(action_request, auto_approve)
                decisions.append(decision)

        if not decisions:
            log.warning("No decisions made — breaking to avoid infinite loop.")
            break

        log.info("Resuming with %d decision(s)...", len(decisions))
        result = agent.invoke(
            Command(resume={"decisions": decisions}),
            config=config,
        )
        log.info("Resume complete.")

    # ── Final output ──────────────────────────────────────────────────────────
    messages = result.get("messages", [])
    if messages:
        print(f"\n{'='*60}")
        print("  FINAL OUTPUT")
        print(f"{'='*60}")
        print(messages[-1].content)

    json_path = _last_write_result.get("json_path")
    if json_path:
        log.info("Report written to: %s", json_path)
    else:
        log.warning("Writer agent did not return a json_path.")

    return json_path


if __name__ == "__main__":
    json_path = run_with_hitl(
        task="What targets were hit during the first wave of U.S / Israel attacks on Iran?",
        auto_approve=False,  # thread_id auto-generated
    )
    print(f"Report written to: {json_path}")
