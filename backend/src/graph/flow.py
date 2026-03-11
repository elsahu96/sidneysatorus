import json
import os
from dotenv import load_dotenv

load_dotenv()

from deepagents.graph import create_deep_agent
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command

from src.graph.agents import planning_subagent, research_subagent, writer_subagent
from src.graph.tools.writer import _last_write_result

MODEL_NAME = os.environ.get("GEMINI_MODEL_NAME")

# Checkpointer is REQUIRED for HITL — it saves state so execution can resume
checkpointer = MemorySaver()


agent = create_deep_agent(
    model=MODEL_NAME,
    tools=[],  # orchestrator has no direct tools; it delegates via "task" to subagents
    subagents=[planning_subagent, research_subagent, writer_subagent],
    checkpointer=checkpointer,
    interrupt_on={
        "search_opoint": {"allowed_decisions": ["approve", "edit", "reject"]},
    },
    system_prompt=SystemMessage(
        content="""
        You are an orchestrator agent managing an investigation and writing pipeline.
        For any investigation task:
        1. Use the 'research-agent' subagent to research the topic and gather information.
        2. Use the 'writer-agent' subagent to write a report based on the information gathered.
    """
    ),
)


def run_with_hitl(
    task: str, thread_id: str = "thread-1", auto_approve: bool = False
) -> dict | None:
    """
    Run the agent with human-in-the-loop handling.

    Args:
        task:         The task to run.
        thread_id:    The thread id.
        auto_approve: Whether to auto-approve HITL requests.

    Returns:
        A dict with ``md_path`` and ``json_path`` keys pointing to the files
        written by the writer-agent, or ``None`` if the writer did not run.
    """
    _last_write_result.clear()
    config = {"configurable": {"thread_id": thread_id}}

    print(f"\n{'='*60}")
    print(f"  TASK   : {task}")
    print(f"  THREAD : {thread_id}")
    print(f"  MODEL  : {MODEL_NAME}")
    print(f"{'='*60}\n")

    print("[agent] Invoking agent...")
    result = agent.invoke({"messages": [HumanMessage(content=task)]}, config=config)
    print("[agent] Initial invocation complete.")

    iteration = 0
    while True:
        interrupts = result.get("__interrupt__", [])

        if not interrupts:
            print("\n[agent] No pending interrupts — task complete.")
            break

        iteration += 1
        interrupt_count = sum(
            len(i.value.get("action_requests", [])) for i in interrupts
        )
        print(
            f"\n[agent] Iteration {iteration}: paused with "
            f"{interrupt_count} pending action(s) awaiting approval.\n"
        )

        decisions: list[dict[str, object]] = []

        for interrupt in interrupts:
            hitl_request = interrupt.value  # HITLRequest
            action_requests = hitl_request.get("action_requests", [])

            for action_request in action_requests:
                tool_name = action_request.get("name", "unknown")
                description = action_request.get("description", "")
                print(f"  [hitl] Tool     : {tool_name}")
                if description:
                    print(f"  [hitl] Details  : {description}\n")

                if auto_approve:
                    print(f"  [hitl] Auto-approved '{tool_name}'.")
                    decisions.append({"type": "approve"})
                    continue

                user_input = input("  → Approve? (yes/edit/no): ").strip().lower()

                if user_input in ("yes", "y"):
                    print(f"  [hitl] Approved '{tool_name}'.")
                    decisions.append({"type": "approve"})
                elif user_input == "edit":
                    current_args = action_request.get("args", {})
                    print(f"  Current args: {json.dumps(current_args, indent=2)}")
                    new_args_str = input(
                        "  → Enter new arguments (JSON, or Enter to keep): "
                    ).strip()
                    new_name = input(
                        "  → Enter new tool name (or Enter to keep): "
                    ).strip()
                    print(f"  [hitl] Edited '{tool_name}' → '{new_name or tool_name}'.")
                    decisions.append(
                        {
                            "type": "edit",
                            "edited_action": {
                                "name": new_name or tool_name,
                                "args": (
                                    json.loads(new_args_str)
                                    if new_args_str
                                    else current_args
                                ),
                            },
                        }
                    )
                else:
                    reason = input("  → Reason for rejection (optional): ").strip()
                    print(
                        f"  [hitl] Rejected '{tool_name}'."
                        + (f" Reason: {reason}" if reason else "")
                    )
                    decisions.append(
                        {"type": "reject", "message": reason}
                        if reason
                        else {"type": "reject"}
                    )

        print(f"\n[agent] Resuming with {len(decisions)} decision(s)...")
        result = agent.invoke(
            Command(resume={"decisions": decisions}),
            config=config,
        )
        print("[agent] Resume complete.")

    messages = result.get("messages", [])
    if messages:
        print(f"\n{'='*60}")
        print("  FINAL OUTPUT")
        print(f"{'='*60}")
        print(messages[-1].content)
    else:
        print("\n[agent] No output messages returned.")

    return dict(_last_write_result) or None


if __name__ == "__main__":
    """Which Iranian provinces are experiencing the most unrest?

    What targets were hit during the first wave of U.S / Israel attacks on Iran?

    What intelligence justified the pre-emptive strikes on Iran?

    How many Iranian officials were killed in the opening phase of Operation Epic Fury?
    """
    run_with_hitl(
        task="What intelligence justified the pre-emptive strikes on Iran?",
        thread_id="investigation-workflow-1",
        auto_approve=False,
    )
