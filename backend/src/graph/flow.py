import ast
import json
import logging
import os
import time
import uuid
from dotenv import load_dotenv

load_dotenv()
from deepagents.graph import create_deep_agent
from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from langgraph.checkpoint.memory import MemorySaver

from src.graph.tools.asknews import clear_grading_cache, get_articles_for_grading
from src.graph.tools.writer import _last_write_result

from src.graph.agents import (
    quick_planning_subagent,
    quick_writer_subagent,
    planning_subagent,
    planning_reviewer_subagent,
    research_subagent,
    analysis_subagent,
    call_writer,
)

# ── Logging (replaces raw print for non-interactive output) ─────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

_RATE_LIMIT_RETRIES = 5
_RATE_LIMIT_BASE_DELAY = 65  # seconds; must exceed the 1-minute token bucket window


def _invoke_with_retry(runnable, input_: dict, config: dict | None = None) -> dict:
    """Invoke a runnable, retrying on 429 rate-limit errors with exponential backoff."""
    delay = _RATE_LIMIT_BASE_DELAY
    for attempt in range(_RATE_LIMIT_RETRIES):
        try:
            return (
                runnable.invoke(input_, config=config)
                if config
                else runnable.invoke(input_)
            )
        except Exception as exc:
            msg = str(exc)
            is_rate_limit = (
                "429" in msg or "rate_limit_error" in msg or "rate limit" in msg.lower()
            )
            if is_rate_limit and attempt < _RATE_LIMIT_RETRIES - 1:
                logger.warning(
                    "Rate limit hit (attempt %d/%d), retrying in %ds: %s",
                    attempt + 1,
                    _RATE_LIMIT_RETRIES,
                    delay,
                    msg[:120],
                )
                time.sleep(delay)
                delay = min(delay * 2, 300)
            else:
                raise
    raise RuntimeError("Unreachable")  # pragma: no cover


def _call_with_retry(fn, *args, **kwargs):
    """Call a plain function, retrying on 429 rate-limit errors."""
    delay = _RATE_LIMIT_BASE_DELAY
    for attempt in range(_RATE_LIMIT_RETRIES):
        try:
            return fn(*args, **kwargs)
        except Exception as exc:
            msg = str(exc)
            is_rate_limit = (
                "429" in msg or "rate_limit_error" in msg or "rate limit" in msg.lower()
            )
            if is_rate_limit and attempt < _RATE_LIMIT_RETRIES - 1:
                logger.warning(
                    "Rate limit hit (attempt %d/%d), retrying in %ds: %s",
                    attempt + 1,
                    _RATE_LIMIT_RETRIES,
                    delay,
                    msg[:120],
                )
                time.sleep(delay)
                delay = min(delay * 2, 300)
            else:
                raise
    raise RuntimeError("Unreachable")  # pragma: no cover


MODEL_NAME = os.environ.get("ANTHROPIC_MODEL_NAME")
if not MODEL_NAME:
    raise EnvironmentError("ANTHROPIC_MODEL_NAME is not set in environment")

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


def _call_hitl(
    on_hitl,
    agent: str,
    content_type: str,
    content: str,
    editable: bool,
    sources: list | None = None,
) -> dict | None:
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


def _grade_and_patch_report(json_path: str, articles: list[dict]) -> None:
    """
    Run the grading pipeline on collected AskNews articles and inject grade data
    into the saved report JSON for every source whose URL matches a graded article.

    Grade fields added to each source dict:
        grade             – letter grade (A+, A, B+, B, C, D)
        composite_score   – 0-100 numeric score
        factor_scores     – dict of the six individual factor scores
        analyst_signals   – list of {text, sentiment} analyst bullets

    Unmatched sources receive a minimal grade stub (grade="C", composite_score=0).
    This function never raises; all errors are logged.
    """
    import json as _json
    import pathlib as _pathlib

    try:
        from src.graph.grading import grade_articles
        from src.graph.grading.config import INVESTIGATION_PROFILE_MAP
        from src.graph.grading.data_loaders import normalize_domain
    except ImportError as exc:
        logger.warning("Grading module not available — skipping source grading: %s", exc)
        return

    if not articles:
        logger.info("No articles to grade.")
        return

    try:
        report_path = _pathlib.Path(json_path)
        report_data = _json.loads(report_path.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.warning("Could not read report JSON for grading patch: %s", exc)
        return

    investigation_type = report_data.get("metadata", {}).get("investigation_type", "")
    profile = INVESTIGATION_PROFILE_MAP.get(investigation_type, "default")
    logger.info(
        "Grading %d articles with profile '%s' (investigation_type=%s)",
        len(articles), profile, investigation_type,
    )

    try:
        graded = grade_articles(articles, profile=profile)
    except Exception as exc:
        logger.warning("grade_articles failed — report sources will not have grades: %s", exc)
        return

    url_to_grade: dict[str, dict] = {}
    domain_to_grade: dict[str, dict] = {}
    for art in graded:
        grade_data = {
            "grade": art.get("grade", "C"),
            "composite_score": art.get("composite_score", 0),
            "factor_scores": art.get("factor_scores", {}),
            "analyst_signals": art.get("analyst_signals", []),
            "source_name": art.get("source_name", ""),
        }
        art_url = art.get("url", "")
        if art_url:
            url_to_grade[art_url] = grade_data
        art_domain = normalize_domain(art_url)
        if art_domain and art_domain not in domain_to_grade:
            domain_to_grade[art_domain] = grade_data

    sources = report_data.get("report", {}).get("sources", [])
    patched = 0
    for source in sources:
        src_url = source.get("url", "")
        grade_data = url_to_grade.get(src_url)
        if grade_data is None:
            src_domain = normalize_domain(src_url)
            grade_data = domain_to_grade.get(src_domain)
        if grade_data:
            source.update(grade_data)
            patched += 1
        else:
            source.setdefault("grade", "C")
            source.setdefault("composite_score", 0)
            source.setdefault("factor_scores", {})
            source.setdefault("analyst_signals", [])

    try:
        report_path.write_text(
            _json.dumps(report_data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        logger.info(
            "Grading patch complete: %d/%d sources matched and graded.", patched, len(sources)
        )
    except Exception as exc:
        logger.warning("Could not write graded report JSON: %s", exc)


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
    planning_result = _invoke_with_retry(
        planning_subagent["runnable"], {"messages": [HumanMessage(content=task)]}
    )
    plan_text = _last_message_content(planning_result)
    logger.info("Pipeline: planning-agent done, plan_len=%d", len(plan_text))

    decision = _call_hitl(on_hitl, "planning-agent", "plan", plan_text, editable=True)
    if decision is None:
        return None
    plan_text = decision.get("edited_content") or plan_text

    # ── Stage 2: Research ────────────────────────────────────────────────
    if on_progress:
        on_progress("research-agent")
    logger.info("Pipeline: running research-agent")
    research_input = f"Task:\n{task}\n\nApproved investigation plan:\n{plan_text}"
    research_result = _invoke_with_retry(
        research_subagent["runnable"],
        {"messages": [HumanMessage(content=research_input)]},
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
        on_hitl,
        "research-agent",
        "sources",
        research_summary,
        editable=False,
        sources=hitl_sources,
    )
    if decision is None:
        return None

    # ── Stage 3: Analysis ──────────────────────────────────────────────────
    if on_progress:
        on_progress("analysis-agent")
    logger.info("Pipeline: running analysis-agent")
    analysis_input = f"Task:\n{task}\n\nResearch findings:\n{json.dumps(articles, ensure_ascii=False)}"
    analysis_result = _invoke_with_retry(
        analysis_subagent["runnable"],
        {"messages": [HumanMessage(content=analysis_input)]},
        config={"recursion_limit": 10},
    )
    analysis_summary = _last_message_content(analysis_result)
    logger.info("Pipeline: analysis-agent done, summary_len=%d", len(analysis_summary))

    # ── Stage 4: Writer ──────────────────────────────────────────────────
    if on_progress:
        on_progress("writer-agent")
    # Cap articles at 20. Strip content/site_rank fields — the writer only needs
    # citation metadata (header, url, date, summary). Full content was already
    # synthesised by the analysis agent and sending it again inflates context
    # by ~50-100k tokens for no benefit.
    _CITATION_FIELDS = {
        "header",
        "url",
        "unix_timestamp",
        "summary",
        "countrycode",
        "language",
    }
    writer_articles = [
        {k: v for k, v in a.items() if k in _CITATION_FIELDS} for a in articles[:20]
    ]
    logger.info(
        "Pipeline: running writer-agent, articles=%d, analysis_len=%d",
        len(writer_articles),
        len(analysis_summary),
    )
    writer_input = (
        f"Task:\n{task}\n\n"
        f"Analysis summary:\n{analysis_summary}\n\n"
        f"Research articles (for citations):\n{json.dumps(writer_articles, ensure_ascii=False)}"
    )
    _call_with_retry(call_writer, writer_input)

    json_path = _last_write_result.get("json_path")
    if json_path:
        logger.info("Pipeline: report written to %s", json_path)
        # ── Stage 5: Source grading ─────────────────────────────────────
        # Use the full-field article cache (page_rank, key_points, etc.)
        # rather than the lean citation dicts sent to the writer.
        if on_progress:
            on_progress("grading-sources")
        grading_articles = get_articles_for_grading(
            [a.get("url", "") for a in articles]
        )
        _grade_and_patch_report(json_path, grading_articles)
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
