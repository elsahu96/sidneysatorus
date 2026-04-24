import os
import uuid
from langchain.agents import create_agent
from deepagents.middleware.subagents import CompiledSubAgent, SubAgent
from langchain_google_vertexai.model_garden import ChatAnthropicVertex
from langchain_core.messages import SystemMessage, HumanMessage
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

from src.graph.tools.asknews import search_asknews, parallel_search_asknews
from src.graph.tools.writer import write_report

from src.graph.prompts.prompts import (
    PLANNING_AGENT_PROMPT,
    RESEARCH_AGENT_PROMPT,
    PLAN_REVIEWER_AGENT_PROMPT,
    ANALYSIS_AGENT_PROMPT,
    WRITER_AGENT_PROMPT,
    QUICK_SEARCH_PLANNING_AGENT_PROMPT,
    QUICK_SEARCH_WRITER_AGENT_PROMPT,
    format_prompt,
)

_MODEL_NAME = os.environ.get("ANTHROPIC_MODEL_NAME", "claude-opus-4-6")
# Writer uses a lighter/faster model — set WRITER_MODEL_NAME in .env to override.
# Recommended: a Haiku or Sonnet variant (e.g. claude-haiku-4-6).
_WRITER_MODEL_NAME = os.environ.get("WRITER_MODEL_NAME", _MODEL_NAME)
_GEMINI_MODEL_NAME = os.environ.get(
    "GEMINI_MODEL_NAME", "google_genai:gemini-3.1-pro-preview"
)
_VERTEX_PROJECT = os.environ.get("VERTEX_PROJECT", "satorus-sidney-dev")
_VERTEX_LOCATION = os.environ.get("VERTEX_LOCATION", "global")
_VERTEX_CLAUDE_MODEL = os.environ.get("VERTEX_CLAUDE_MODEL", "claude-opus-4-6")
_today = datetime.now().strftime("%Y-%m-%d")
################################################################################
#  Deep search agents
################################################################################

_model = ChatAnthropicVertex(
    model_name=_MODEL_NAME,
    project=_VERTEX_PROJECT,
    location=_VERTEX_LOCATION,
)
_writer_model = ChatAnthropicVertex(
    model_name=_WRITER_MODEL_NAME,
    project=_VERTEX_PROJECT,
    location=_VERTEX_LOCATION,
    max_tokens=16000,
)
planning_graph = create_agent(
    model=_model,
    tools=[],
    system_prompt=format_prompt(
        PLANNING_AGENT_PROMPT,
        current_date=_today,
        thread_id=uuid.uuid4().hex[:8],
    ),
)
planning_subagent = CompiledSubAgent(
    name="planning-agent",
    description="Plans the investigation",
    runnable=planning_graph,
)


planning_reviewer_graph = create_agent(
    model=_MODEL_NAME,
    tools=[],
    system_prompt=format_prompt(
        PLAN_REVIEWER_AGENT_PROMPT,
        current_date=_today,
    ),
)
planning_reviewer_subagent = CompiledSubAgent(
    name="planning-reviewer-agent",
    description="Reviews the investigation plan and makes sure it is complete and accurate",
    runnable=planning_reviewer_graph,
)

research_graph = create_agent(
    model=_model,
    tools=[parallel_search_asknews],
    system_prompt=format_prompt(
        RESEARCH_AGENT_PROMPT,
        current_date=_today,
    ),
)
research_subagent = CompiledSubAgent(
    name="research-agent",
    description="Searches the web and gathers information on a topic in depth",
    runnable=research_graph,
)

analysis_graph = create_agent(
    model=_model,
    tools=[],
    system_prompt=format_prompt(
        ANALYSIS_AGENT_PROMPT,
        current_date=_today,
    ),
)
analysis_subagent = CompiledSubAgent(
    name="analysis-agent",
    description="Analyzes the research findings and writes a report",
    runnable=analysis_graph,
)

# Writer uses a forced single tool call instead of a ReAct agent loop.
# bind_tools with tool_choice="write_report" guarantees exactly one LLM
# inference that populates every field and immediately calls write_report —
# no intermediate thinking turns, no retry cycles, no recursion counter.
_forced_writer = _writer_model.bind_tools(
    [write_report],
    tool_choice="write_report",
)
_writer_system_prompt = format_prompt(WRITER_AGENT_PROMPT, current_date=_today)


def call_writer(writer_input: str) -> None:
    """
    Execute the writer as a single forced tool call.

    One Vertex API request → model generates write_report arguments →
    write_report runs once. No agent loop, no recursion.
    """
    response = _forced_writer.invoke(
        [
            SystemMessage(content=_writer_system_prompt),
            HumanMessage(content=writer_input),
        ]
    )
    for tc in getattr(response, "tool_calls", []):
        if tc["name"] == "write_report":
            write_report.invoke(tc["args"])
            return

################################################################################
#  Quick search agents
################################################################################ts

quick_planning_subagent = SubAgent(
    name="quick-search-planning-agent",
    description="Synthesises an intelligence briefing directly from model knowledge — no external search",
    system_prompt=format_prompt(
        QUICK_SEARCH_PLANNING_AGENT_PROMPT,
        current_date=datetime.now().strftime("%Y-%m-%d"),
    ),
    tools=[],
    model=_MODEL_NAME,
)

quick_writer_subagent = SubAgent(
    name="quick-search-writer-agent",
    description="Takes a research briefing and writes a polished, structured markdown report",
    system_prompt=format_prompt(
        QUICK_SEARCH_WRITER_AGENT_PROMPT,
        current_date=datetime.now().strftime("%Y-%m-%d"),
    ),
    tools=[write_report],
    model=_MODEL_NAME,
)
