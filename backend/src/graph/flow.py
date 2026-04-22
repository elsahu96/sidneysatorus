import ast
import json
import logging
import os
import uuid
from dotenv import load_dotenv

load_dotenv()
from deepagents.graph import create_deep_agent
from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from langgraph.checkpoint.memory import MemorySaver

from src.graph.tools.asknews import clear_grading_cache
from src.graph.tools.writer import _last_write_result

from src.graph.agents import (
    quick_planning_subagent,
    quick_writer_subagent,
    planning_subagent,
    planning_reviewer_subagent,
    research_subagent,
    writer_subagent,
)

# ── Logging (replaces raw print for non-interactive output) ─────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

MODEL_NAME = os.environ.get("GEMINI_MODEL_NAME")
if not MODEL_NAME:
    raise EnvironmentError("GEMINI_MODEL_NAME is not set in environment")

quick_checkpointer = MemorySaver()
# Quick-search agent: planning (knowledge-only) → writer. No AskNews, no HITL.
quick_agent = create_deep_agent(
    model=MODEL_NAME,
    tools=[],
    subagents=[quick_planning_subagent, quick_writer_subagent],
    checkpointer=quick_checkpointer,
    interrupt_on={},
    system_prompt=SystemMessage(
        content="""You are an orchestrator agent for fast intelligence lookups.
        For any query, follow these steps in order:
        1. Use the 'quick-search-planning-agent' subagent to synthesise a research briefing from your knowledge.
        2. Use the 'quick-search-writer-agent' subagent to format those findings into a structured JSON report.
        The writer-agent will return a json_path. Include that path in your final message."""
    ),
)


def run_quick_agent(
    task: str, on_progress=None, thread_id: str | None = None
) -> str | None:
    """
    Run the quick-search two-agent pipeline (planning → writer) with no HITL.

    Uses quick_agent (quick_planning_subagent + writer_subagent), so no AskNews
    calls are made. The planning agent synthesises findings from model knowledge
    and passes them directly to the writer agent.

    Returns the json_path of the written report, or None.
    """
    _last_write_result.clear()
    if thread_id is None:
        thread_id = f"quick-{uuid.uuid4().hex[:8]}"

    config = {"configurable": {"thread_id": thread_id}}

    if on_progress:
        on_progress("planning-agent")

    logger.info("Quick agent: invoking for task_len=%d", len(task))
    result = quick_agent.invoke(
        {"messages": [HumanMessage(content=task)]}, config=config
    )
    logger.info("Quick agent: invocation complete")

    # quick_agent has no interrupts, so it runs to completion in one shot
    messages = result.get("messages", [])
    if messages:
        logger.info("Quick agent final output: %s", str(messages[-1].content)[:200])

    if on_progress:
        on_progress("writer-agent")

    json_path = _last_write_result.get("json_path")
    if json_path:
        logger.info("Quick agent report written to: %s", json_path)
        try:
            import json as _json

            _p = __import__("pathlib").Path(json_path)
            _data = _json.loads(_p.read_text(encoding="utf-8"))
            _data.setdefault("metadata", {})["title"] = task
            _p.write_text(
                _json.dumps(_data, ensure_ascii=False, indent=2), encoding="utf-8"
            )
        except Exception as _e:
            logger.warning("Quick agent: could not patch report title: %s", _e)
    else:
        logger.warning("Quick agent: writer subagent did not produce a json_path.")

    return json_path


def _collect_articles_from_tool_messages(messages: list) -> list[dict]:
    """Extract Article dicts from ToolMessages produced by search_asknews calls."""
    articles: list[dict] = []
    seen_urls: set[str] = set()
    for msg in messages:
        if not isinstance(msg, ToolMessage):
            continue
        content = msg.content
        if not content:
            continue
        parsed = None
        try:
            parsed = json.loads(content)
        except (json.JSONDecodeError, TypeError):
            try:
                parsed = ast.literal_eval(content)
            except Exception:
                pass
        if isinstance(parsed, list):
            for item in parsed:
                if isinstance(item, dict):
                    url = item.get("url", "")
                    if url and url not in seen_urls:
                        seen_urls.add(url)
                        articles.append(item)
    return articles


def _last_message_content(result: dict) -> str:
    """Return the content of the last non-empty message in a subagent result."""
    for msg in reversed(result.get("messages", [])):
        content = getattr(msg, "content", None)
        if not content:
            continue
        return content if isinstance(content, str) else str(content)
    return ""


def _call_hitl(on_hitl, agent: str, content_type: str, content: str,
               editable: bool, sources: list | None = None) -> dict | None:
    """
    Call on_hitl and return the decision dict, or None if user rejected.

    Returns the decision dict with keys: approved, edited_content (optional),
    additional_urls (optional). Returns None on rejection.
    """
    if on_hitl is None:
        return {"approved": True}
    payload = {
        "agent": agent,
        "content_type": content_type,
        "content": content,
        "editable": editable,
    }
    if sources is not None:
        payload["sources"] = sources
    decision = on_hitl(payload)
    if not decision.get("approved"):
        return None
    return decision


def run_pipeline_stages(
    task: str,
    thread_id: str,
    on_progress=None,
    on_hitl=None,
    quick_search: bool = False,
) -> str | None:
    """
    Run the investigation pipeline in discrete stages with post-execution HITL.

    Each subagent runs to completion before the user is asked to review its
    output. The user sees the actual results (plan text, reviewed plan, sources
    list) rather than the proposed task description.

    Stages:
      1. planning-agent       → user reviews/edits the plan
      2. planning-reviewer-agent → user reviews/edits the reviewed plan
      3. research-agent       → user reviews the sources list
      4. writer-agent         → produces the report (no HITL)

    Args:
        task:        Original investigation query.
        thread_id:   Unique ID for this run (unused — kept for API compatibility).
        on_progress: Callback(agent_name) emitted before each stage starts.
        on_hitl:     Callback(payload) → decision dict. Blocks until user responds.
        quick_search: Unused here (handled upstream); reserved for API compat.

    Returns:
        json_path of the written report, or None if the user cancelled.
    """
    _last_write_result.clear()
    clear_grading_cache()

    # ── Stage 1: Planning ────────────────────────────────────────────────
    if on_progress:
        on_progress("planning-agent")
    logger.info("Pipeline: running planning-agent")
    planning_result = planning_subagent["runnable"].invoke(
        {"messages": [HumanMessage(content=task)]}
    )
    plan_text = _last_message_content(planning_result)
    logger.info("Pipeline: planning-agent done, plan_len=%d", len(plan_text))

    decision = _call_hitl(on_hitl, "planning-agent", "plan", plan_text, editable=True)
    if decision is None:
        return None
    plan_text = decision.get("edited_content") or plan_text

    # ── Stage 2: Plan review ─────────────────────────────────────────────
    if on_progress:
        on_progress("planning-reviewer-agent")
    logger.info("Pipeline: running planning-reviewer-agent")
    reviewer_input = f"Original task:\n{task}\n\nProposed investigation plan:\n{plan_text}"
    reviewer_result = planning_reviewer_subagent["runnable"].invoke(
        {"messages": [HumanMessage(content=reviewer_input)]}
    )
    reviewed_plan = _last_message_content(reviewer_result)
    logger.info("Pipeline: planning-reviewer-agent done, plan_len=%d", len(reviewed_plan))

    decision = _call_hitl(on_hitl, "planning-reviewer-agent", "plan", reviewed_plan, editable=True)
    if decision is None:
        return None
    reviewed_plan = decision.get("edited_content") or reviewed_plan

    # ── Stage 3: Research ────────────────────────────────────────────────
    if on_progress:
        on_progress("research-agent")
    logger.info("Pipeline: running research-agent")
    research_input = f"Task:\n{task}\n\nApproved investigation plan:\n{reviewed_plan}"
    research_result = research_subagent["runnable"].invoke(
        {"messages": [HumanMessage(content=research_input)]}
    )
    articles = _collect_articles_from_tool_messages(research_result.get("messages", []))
    research_summary = _last_message_content(research_result)
    logger.info("Pipeline: research-agent done, articles=%d", len(articles))

    # Build a lightweight sources list for the HITL card (title + url + summary)
    hitl_sources = [
        {
            "title": a.get("header", a.get("title", "")),
            "url": a.get("url", ""),
            "summary": a.get("summary", ""),
        }
        for a in articles
    ]
    decision = _call_hitl(
        on_hitl, "research-agent", "sources", research_summary,
        editable=False, sources=hitl_sources,
    )
    if decision is None:
        return None

    # ── Stage 4: Writer ──────────────────────────────────────────────────
    if on_progress:
        on_progress("writer-agent")
    logger.info("Pipeline: running writer-agent, articles=%d", len(articles))
    writer_input = (
        f"Task:\n{task}\n\n"
        f"Research findings (articles):\n{json.dumps(articles, ensure_ascii=False)}"
    )
    writer_subagent["runnable"].invoke(
        {"messages": [HumanMessage(content=writer_input)]}
    )

    json_path = _last_write_result.get("json_path")
    if json_path:
        logger.info("Pipeline: report written to %s", json_path)
    else:
        logger.warning("Pipeline: writer-agent did not produce a json_path")
    return json_path


if __name__ == "__main__":
    print(
        run_pipeline_stages(
            task="What targets were hit during the first wave of U.S / Israel attacks on Iran?",
            thread_id="investigation-workflow-1",
        )
    )
