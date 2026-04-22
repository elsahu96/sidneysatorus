import os
import uuid
from langchain.agents import create_agent
from deepagents.middleware.subagents import CompiledSubAgent, SubAgent
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

from src.graph.tools.asknews import search_asknews, parallel_search_asknews
from src.graph.tools.writer import write_report

from src.graph.prompts.prompts import (
    PLANNING_AGENT_PROMPT,
    RESEARCH_AGENT_PROMPT,
    PLAN_REVIEWER_AGENT_PROMPT,
    WRITER_AGENT_PROMPT,
    QUICK_SEARCH_PLANNING_AGENT_PROMPT,
    QUICK_SEARCH_WRITER_AGENT_PROMPT,
    format_prompt,
)

_MODEL_NAME = os.environ.get("GEMINI_MODEL_NAME")
_today = datetime.now().strftime("%Y-%m-%d")
################################################################################
#  Deep search agents
################################################################################


planning_graph = create_agent(
    model="google_genai:gemini-3.1-pro-preview",
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
    model="google_genai:gemini-3.1-pro-preview",
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
    model="google_genai:gemini-3.1-pro-preview",
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

writer_graph = create_agent(
    model="google_genai:gemini-3.1-pro-preview",
    tools=[write_report],
    system_prompt=format_prompt(WRITER_AGENT_PROMPT, current_date=_today),
)
writer_subagent = CompiledSubAgent(
    name="writer-agent",
    description="Takes research findings (a list of Article objects with header, summary, content, url fields) and writes a polished, structured markdown report, then saves it to disk",
    runnable=writer_graph,
)

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
    model="google_genai:gemini-3-flash-preview",
)

quick_writer_subagent = SubAgent(
    name="quick-search-writer-agent",
    description="Takes a research briefing and writes a polished, structured markdown report",
    system_prompt=format_prompt(
        QUICK_SEARCH_WRITER_AGENT_PROMPT,
        current_date=datetime.now().strftime("%Y-%m-%d"),
    ),
    tools=[write_report],
    model="google_genai:gemini-3-flash-preview",
)
