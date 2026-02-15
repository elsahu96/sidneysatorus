"""
A2A Server Setup: Expose agents via A2A protocol using to_a2a() function.
"""

import os
from google.adk.a2a.utils.agent_to_a2a import to_a2a
from .analyzer import create_analyzer_agent
from .searcher import create_searcher_agent
from .reporter import create_reporter_agent
from .a2a_config import (
    create_analyzer_agent_card,
    create_searcher_agent_card,
    create_reporter_agent_card
)


def create_analyzer_a2a_server(port: int = 8001):
    """Create A2A server for Analyzer agent."""
    agent = create_analyzer_agent()
    agent_card = create_analyzer_agent_card(base_url=f"http://localhost:{port}")
    return to_a2a(agent, port=port, agent_card=agent_card)


def create_searcher_a2a_server(port: int = 8002):
    """Create A2A server for Searcher agent."""
    agent = create_searcher_agent()
    agent_card = create_searcher_agent_card(base_url=f"http://localhost:{port}")
    return to_a2a(agent, port=port, agent_card=agent_card)


def create_reporter_a2a_server(port: int = 8003):
    """Create A2A server for Reporter agent."""
    agent = create_reporter_agent()
    agent_card = create_reporter_agent_card(base_url=f"http://localhost:{port}")
    return to_a2a(agent, port=port, agent_card=agent_card)


# A2A app instances for uvicorn
analyzer_a2a_app = create_analyzer_a2a_server()
searcher_a2a_app = create_searcher_a2a_server()
reporter_a2a_app = create_reporter_a2a_server()
