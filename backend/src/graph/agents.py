import os
from deepagents.middleware.subagents import SubAgent
from dotenv import load_dotenv

load_dotenv()

from src.graph.tools.writer import write_report
from src.graph.tools.opoint import search_opoint

from src.graph.prompts.prompts import (
    PLANNING_AGENT_PROMPT,
    RESEARCH_AGENT_PROMPT,
    WRITER_AGENT_PROMPT,
)

_MODEL_NAME = os.environ.get("GEMINI_MODEL_NAME")


planning_subagent = SubAgent(
    name="planning-agent",
    description="Plans the investigation",
    system_prompt=PLANNING_AGENT_PROMPT,
    tools=[],
    model="google_genai:gemini-3-flash-preview",
)

research_subagent = SubAgent(
    name="research-agent",
    description="Searches the web and gathers information on a topic in depth",
    system_prompt=RESEARCH_AGENT_PROMPT,
    tools=[search_opoint],
    model="google_genai:gemini-3-flash-preview",
)


writer_subagent = SubAgent(
    name="writer-agent",
    description="Takes research findings (a list of Article objects with header, summary, content, url fields) and writes a polished, structured markdown report, then saves it to disk",
    system_prompt=WRITER_AGENT_PROMPT,
    tools=[write_report],
    model="google_genai:gemini-3-flash-preview",
)
