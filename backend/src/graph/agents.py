import os
from deepagents.middleware.subagents import SubAgent
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

from src.graph.tools.asknews import search_asknews, parallel_search_asknews
from src.graph.tools.writer import write_report

from src.graph.prompts.prompts import (
    PLANNING_AGENT_PROMPT,
    QUICK_SEARCH_PLANNING_PROMPT,
    RESEARCH_AGENT_PROMPT,
    WRITER_AGENT_PROMPT,
    ASKNEWS_AGENT_PROMPT,
    QUICK_SEARCH_WRITER_AGENT_PROMPT,
)

_MODEL_NAME = os.environ.get("GEMINI_MODEL_NAME")


planning_subagent = SubAgent(
    name="planning-agent",
    description="Plans the investigation",
    system_prompt=PLANNING_AGENT_PROMPT.format(
        current_date=datetime.now().strftime("%Y-%m-%d")
    ),
    tools=[],
    model="google_genai:gemini-3-flash-preview",
)

research_subagent = SubAgent(
    name="research-agent",
    description="Searches the web and gathers information on a topic in depth",
    system_prompt=RESEARCH_AGENT_PROMPT.format(
        current_date=datetime.now().strftime("%Y-%m-%d")
    ),
    tools=[parallel_search_asknews],
    model="google_genai:gemini-3-flash-preview",
)

writer_subagent = SubAgent(
    name="writer-agent",
    description="Takes research findings (a list of Article objects with header, summary, content, url fields) and writes a polished, structured markdown report, then saves it to disk",
    system_prompt=WRITER_AGENT_PROMPT,
    tools=[write_report],
    model="google_genai:gemini-3-flash-preview",
)

asknews_subagent = SubAgent(
    name="asknews-agent",
    description="Searches for recent news articles using the AskNews API",
    system_prompt=ASKNEWS_AGENT_PROMPT,
    tools=[search_asknews],
    model="google_genai:gemini-3-flash-preview",
)


quick_planning_subagent = SubAgent(
    name="quick-search-planning-agent",
    description="Synthesises an intelligence briefing directly from model knowledge — no external search",
    system_prompt=QUICK_SEARCH_PLANNING_PROMPT.format(
        current_date=datetime.now().strftime("%Y-%m-%d")
    ),
    tools=[],
    model="google_genai:gemini-3-flash-preview",
)

quick_writer_subagent = SubAgent(
    name="quick-search-writer-agent",
    description="Takes a research briefing and writes a polished, structured markdown report",
    system_prompt=QUICK_SEARCH_WRITER_AGENT_PROMPT.format(
        current_date=datetime.now().strftime("%Y-%m-%d")
    ),
    tools=[write_report],
    model="google_genai:gemini-3-flash-preview",
)
