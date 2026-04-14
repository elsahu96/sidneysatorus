import ast
import json
import logging
import os
import re
import uuid
from time import sleep
from dotenv import load_dotenv

load_dotenv()
from src.graph.tools.writer import _last_write_result
from deepagents.graph import create_deep_agent
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.messages import ToolMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import create_react_agent
from langchain.chat_models import init_chat_model
from langgraph.types import Command

from src.graph.agents import (
    planning_subagent,
    quick_planning_subagent,
    quick_writer_subagent,
    research_subagent,
    writer_subagent,
    asknews_subagent,
)
from src.graph.prompts.prompts import (
    PLANNING_AGENT_PROMPT,
    RESEARCH_AGENT_PROMPT,
    WRITER_AGENT_PROMPT,
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

checkpointer = MemorySaver()
quick_checkpointer = MemorySaver()

agent = create_deep_agent(
    model=MODEL_NAME,
    tools=[],
    subagents=[planning_subagent, research_subagent, writer_subagent, asknews_subagent],
    checkpointer=checkpointer,
    interrupt_on={"planning-agent": True, "research-agent": True, "writer-agent": True},
    system_prompt=SystemMessage(
        content="""You are an orchestrator agent managing an investigation and writing pipeline.
        For any investigation task, follow these steps in order:
        1. Use the 'planning-agent' subagent to plan the investigation and produce a list of search queries.
        2. Use the 'research-agent' subagent to search AskNews with those queries and gather articles.
        3. Use the 'writer-agent' subagent to write a structured JSON report based on the findings.
        The writer-agent will return a json_path. Include that path in your final message."""
    ),
)

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
    hitl_handler=None,
    on_agent_start=None,
) -> str | None:
    """
    Run the agent with human-in-the-loop handling.

    Args:
        task:            The investigation task.
        thread_id:       Unique thread id. Auto-generated if not provided.
        auto_approve:    Skip human prompts and approve all actions automatically.
        hitl_handler:    Optional callable(action_request: dict) -> bool.
                         If provided, called instead of terminal input.
        on_agent_start:  Optional callable(agent_name: str).
                         Called with the agent name after the user approves.
    Returns:
        The json_path of the written report, or None if the writer did not run.
    """
    _last_write_result.clear()
    if thread_id is None:
        thread_id = f"thread-{uuid.uuid4().hex[:8]}"

    config = {"configurable": {"thread_id": thread_id}}

    logger.info("Invoking agent...")
    result = agent.invoke({"messages": [HumanMessage(content=task)]}, config=config)
    logger.info("Initial invocation complete.")

    iteration = 0
    while True:
        interrupts = result.get("__interrupt__", [])
        if not interrupts:
            logger.info("No pending interrupts — task complete.")
            break

        iteration += 1
        decisions: list[dict] = []

        for interrupt in interrupts:
            if not isinstance(interrupt.value, dict):
                logger.warning("Unexpected interrupt format: %s", interrupt.value)
                continue

            action_requests = interrupt.value.get("action_requests", [])
            if not action_requests:
                logger.warning(
                    "Interrupt contained no action_requests: %s", interrupt.value
                )
                continue

            logger.info(
                "Iteration %d: %d action(s) pending.", iteration, len(action_requests)
            )

            for action_request in action_requests:
                agent_name = action_request.get("name", "unknown")

                if hitl_handler is not None:
                    approved = hitl_handler(action_request)
                elif auto_approve:
                    approved = True
                else:
                    approved = (
                        _handle_action_request(action_request, auto_approve).get("type")
                        == "approve"
                    )

                if approved:
                    if on_agent_start is not None:
                        on_agent_start(agent_name)
                    decisions.append({"type": "approve"})
                else:
                    decisions.append({"type": "reject"})

        if not decisions:
            logger.warning("No decisions made — breaking to avoid infinite loop.")
            break

        logger.info("Resuming with %d decision(s)...", len(decisions))
        result = agent.invoke(
            Command(resume={"decisions": decisions}),
            config=config,
        )
        logger.info("Resume complete.")

    messages = result.get("messages", [])
    if messages:
        logger.info("Final output: %s", messages[-1].content)

    json_path = _last_write_result.get("json_path")
    if json_path:
        logger.info("Report written to: %s", json_path)
    else:
        logger.warning("Writer agent did not return a json_path.")

    logger.info("Graph flow: report written to: %s", json_path)
    return json_path


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


def _extract_text(content) -> str:
    """Normalize a message content value to a plain string.

    Gemini (and some other providers) return content as a list of typed parts
    rather than a bare string.  This collapses them into one string so callers
    always receive something safe to JSON-encode and display.
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict):
                parts.append(part.get("text", "") or "")
            else:
                text = getattr(part, "text", None)
                parts.append(text if isinstance(text, str) else str(part))
        return "\n".join(p for p in parts if p)
    return str(content)


def _init_chat_model():
    """Initialize the chat model from environment variable."""
    model_name = os.environ.get(
        "GEMINI_MODEL_NAME", "google_genai:gemini-3-flash-preview"
    )
    return init_chat_model(model_name)


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


def run_pipeline_stages(
    task: str,
    thread_id: str,
    on_progress: callable,
    on_hitl: callable,
    quick_search: bool = False,
) -> str | None:
    """
    Run the investigation pipeline in discrete stages with post-agent HITL.

    When quick_search=True the AskNews research stage is skipped entirely.
    The planning agent directly synthesises findings from its own knowledge,
    then the writer agent formats those findings into a report — no HITL pauses.

    Args:
        task:          Original investigation query.
        thread_id:     Unique ID for this run (unused here but kept for parity).
        on_progress:   callable(agent_name: str) — called when an agent starts.
        on_hitl:       callable(hitl_data: dict) -> dict — called with HITL payload.
        quick_search:  If True, skip AskNews research and auto-approve all stages.

    Returns:
        json_path of the written report, or None if the user cancelled.
    """
    _last_write_result.clear()
    model = _init_chat_model()

    def _auto_approve(hitl_data: dict) -> dict:
        return {"approved": True}

    hitl = _auto_approve if quick_search else on_hitl

    # ── Quick-search: dedicated two-agent workflow (planning → writer) ────────
    if quick_search:
        return run_quick_agent(task=task, on_progress=on_progress)

    # ── Stage 1: Planning ────────────────────────────────────────────────────
    on_progress("planning-agent")
    planning_runner = create_react_agent(model, tools=[], prompt=PLANNING_AGENT_PROMPT)
    plan_result = planning_runner.invoke({"messages": [HumanMessage(content=task)]})
    plan_text = _extract_text(plan_result["messages"][-1].content)

    decision = hitl(
        {
            "agent": "planning-agent",
            "content_type": "plan",
            "content": plan_text,
            "editable": True,
        }
    )
    if not decision.get("approved"):
        return None
    refined_plan = decision.get("edited_content") or plan_text

    # ── Stage 2: Research ────────────────────────────────────────────────────
    on_progress("research-agent")

    from src.graph.tools.asknews import parallel_search_asknews  # local import to avoid circular

    research_runner = create_react_agent(
        model,
        tools=[parallel_search_asknews],
        prompt=RESEARCH_AGENT_PROMPT,
    )
    research_prompt = (
        f"Investigation task: {task}\n\n"
        f"Investigation plan:\n{refined_plan}\n\n"
        "Execute the research plan and return structured findings."
    )
    research_result = research_runner.invoke(
        {"messages": [HumanMessage(content=research_prompt)]}
    )
    research_summary = _extract_text(research_result["messages"][-1].content)

    # Collect article objects from tool call results for the HITL display
    all_messages = research_result["messages"]
    articles = _collect_articles_from_tool_messages(all_messages)

    sources_for_hitl: list[dict] = []
    for art in articles:
        url = art.get("url", "")
        if not url:
            continue
        sources_for_hitl.append(
            {
                "title": art.get("header", ""),
                "url": url,
                "summary": (art.get("summary", "") or "")[:200],
            }
        )

    decision = hitl(
        {
            "agent": "research-agent",
            "content_type": "sources",
            "content": research_summary,
            "sources": sources_for_hitl,
            "editable": True,
        }
    )
    if not decision.get("approved"):
        return None

    additional_urls = decision.get("additional_urls") or []
    additional_context = ""
    if additional_urls:
        additional_context = "\n\nAdditional sources added by analyst:\n" + "\n".join(
            f"- {u}" for u in additional_urls
        )

    # ── Stage 2.5: Source grading ────────────────────────────────────────────
    on_progress("grading-sources")
    from src.graph.grading import grade_articles
    from src.graph.tools.asknews import _last_raw_articles
    from src.graph.grading.config import INVESTIGATION_PROFILE_MAP

    # Merge AskNews side-channel data into article dicts for grading
    enriched_articles = []
    for art in articles:
        url = art.get("url", "")
        enriched = {**art}
        if url in _last_raw_articles:
            enriched.update(_last_raw_articles[url])
        enriched_articles.append(enriched)

    # Select grading profile based on investigation type (from plan) or default
    grading_profile = "default"
    plan_lower = refined_plan.lower()
    for inv_type, profile in INVESTIGATION_PROFILE_MAP.items():
        if inv_type.lower().replace("_", " ") in plan_lower:
            grading_profile = profile
            break

    graded_articles = grade_articles(enriched_articles, profile=grading_profile)

    # Build grading summary for the writer
    grading_summary_lines = [f"\nSource Grading (profile: {grading_profile}):"]
    for i, ga in enumerate(graded_articles, 1):
        grade = ga.get("grade", "?")
        score = ga.get("composite_score", 0)
        domain = ga.get("url", "").split("/")[2] if "://" in ga.get("url", "") else ga.get("url", "")
        signals = ga.get("analyst_signals", [])
        signal_text = "; ".join(s.get("text", "") for s in signals[:2]) if signals else ""
        grading_summary_lines.append(f"  [{i}] {domain} — Grade: {grade} ({score}/100) — {signal_text}")
    grading_context = "\n".join(grading_summary_lines)

    # ── Stage 2.75: Confirm report format (pre-writer) ──────────────────────
    source_count = len(sources_for_hitl) + len(additional_urls)
    grade_dist: dict[str, int] = {}
    for ga in graded_articles:
        g = ga.get("grade", "?")
        grade_dist[g] = grade_dist.get(g, 0) + 1
    grade_dist_str = ", ".join(f"{g}: {c}" for g, c in sorted(grade_dist.items()))

    decision = hitl(
        {
            "agent": "writer-agent",
            "content_type": "format_confirmation",
            "content": (
                f"Ready to write the intelligence report.\n\n"
                f"• {source_count} sources collected\n"
                f"• Source grades: {grade_dist_str}\n"
                f"• Grading profile: {grading_profile}\n"
                f"• Sections: Executive Summary · Detailed Analysis · Risk Factors · Sources\n"
                f"• Format: Structured JSON with inline citations and source grades"
            ),
            "editable": False,
        }
    )
    if not decision.get("approved"):
        return None

    # ── Stage 3: Writer ──────────────────────────────────────────────────────
    on_progress("writer-agent")

    from src.graph.tools.writer import write_report  # local import

    writer_runner = create_react_agent(
        model,
        tools=[write_report],
        prompt=WRITER_AGENT_PROMPT,
    )
    from src.graph.tools.asknews import _sanitize_text as _asknews_sanitize

    # Sanitise every non-whitespace token > 500 bytes, then cap total length.
    # This prevents both Gemini chunk-limit errors regardless of what the
    # research agent returned.
    research_summary = _asknews_sanitize(research_summary)
    _MAX_RESEARCH_CHARS = 30_000
    if len(research_summary) > _MAX_RESEARCH_CHARS:
        research_summary = (
            research_summary[:_MAX_RESEARCH_CHARS] + "\n\n[Research summary truncated]"
        )
        logger.warning(
            "Research summary truncated to %d chars for writer agent.",
            _MAX_RESEARCH_CHARS,
        )

    writer_prompt = _asknews_sanitize(
        f"Investigation task: {task}\n\n"
        f"Research findings:\n{research_summary}"
        + additional_context
        + "\n\n" + grading_context
    )
    writer_runner.invoke({"messages": [HumanMessage(content=writer_prompt)]})

    json_path = _last_write_result.get("json_path")
    if json_path:
        logger.info("Pipeline complete. Report written to: %s", json_path)
        # Post-write: patch report title and inject source grading metadata
        try:
            import json as _json

            _p = __import__("pathlib").Path(json_path)
            _data = _json.loads(_p.read_text(encoding="utf-8"))
            _data.setdefault("metadata", {})["title"] = task

            # Inject grading data into each source and add grading summary
            report_sources = _data.get("report", {}).get("sources", [])
            graded_by_url = {ga.get("url", ""): ga for ga in graded_articles}
            for src in report_sources:
                url = src.get("url", "")
                ga = graded_by_url.get(url)
                if ga:
                    src["grade"] = ga.get("grade", "")
                    src["composite_score"] = ga.get("composite_score", 0)
                    src["factor_scores"] = ga.get("factor_scores", {})
                    src["analyst_signals"] = [
                        {"text": s.get("text", ""), "sentiment": s.get("sentiment", "neutral")}
                        for s in ga.get("analyst_signals", [])
                    ]

            # Add top-level source_grading summary
            avg_score = (
                sum(ga.get("composite_score", 0) for ga in graded_articles) // len(graded_articles)
                if graded_articles else 0
            )
            _data["source_grading"] = {
                "profile_used": grading_profile,
                "grade_distribution": grade_dist,
                "average_score": avg_score,
                "total_sources_graded": len(graded_articles),
            }

            _p.write_text(
                _json.dumps(_data, ensure_ascii=False, indent=2), encoding="utf-8"
            )
        except Exception as _e:
            logger.warning("Could not patch report with grading data: %s", _e)
    else:
        logger.warning("Writer agent did not produce a json_path.")
    return json_path


if __name__ == "__main__":
    json_path = run_with_hitl(
        task="What targets were hit during the first wave of U.S / Israel attacks on Iran?",
        auto_approve=False,  # thread_id auto-generated
    )
    print(f"Report written to: {json_path}")
