"""
A2A Server Configuration: AgentCard and AgentSkill definitions for A2A discovery.
"""

from typing import Dict, Any, List

# Try importing A2A types - may need to adjust import path based on actual package structure
try:
    from a2a.types import AgentCard, AgentSkill
except ImportError:
    # Fallback: Define minimal types if package not available
    from pydantic import BaseModel
    from typing import Optional
    
    class AgentSkill(BaseModel):
        id: str
        name: str
        description: str
        tags: List[str] = []
    
    class AgentCard(BaseModel):
        name: str
        url: str
        description: str
        version: str
        capabilities: Dict[str, Any]
        skills: List[AgentSkill]
        defaultInputModes: List[str]
        defaultOutputModes: List[str]
        supportsAuthenticatedExtendedCard: bool


def create_analyzer_agent_card(base_url: str = "http://localhost:8001") -> AgentCard:
    """Create AgentCard for Analyzer agent."""
    return AgentCard(
        name="analyzer_agent",
        url=base_url,
        description="Parses user queries, extracts entities, and generates 3-5 specific search queries for intelligence gathering.",
        version="1.0.0",
        capabilities={},
        skills=[
            AgentSkill(
                id="analyzer_agent",
                name="query_analysis",
                description="Analyzes user queries to extract entities and generate focused search queries. Outputs structured JSON with query understanding, entities, and search queries.",
                tags=["llm", "analysis"]
            )
        ],
        defaultInputModes=["text/plain"],
        defaultOutputModes=["application/json"],
        supportsAuthenticatedExtendedCard=False
    )


def create_searcher_agent_card(base_url: str = "http://localhost:8002") -> AgentCard:
    """Create AgentCard for Searcher agent."""
    return AgentCard(
        name="searcher_agent",
        url=base_url,
        description="Uses GoogleSearchTool to gather external intelligence data and synthesize search results.",
        version="1.0.0",
        capabilities={},
        skills=[
            AgentSkill(
                id="searcher_agent",
                name="web_search",
                description="Executes web searches using Google Search tool and synthesizes results into structured intelligence. Requires research_context input with search_queries.",
                tags=["llm", "search", "google"]
            )
        ],
        defaultInputModes=["application/json"],
        defaultOutputModes=["application/json"],
        supportsAuthenticatedExtendedCard=False
    )


def create_reporter_agent_card(base_url: str = "http://localhost:8003") -> AgentCard:
    """Create AgentCard for Reporter agent."""
    return AgentCard(
        name="reporter_agent",
        url=base_url,
        description="Synthesizes intelligence reports from search results and file uploads, outputting HTML and PDF formats.",
        version="1.0.0",
        capabilities={},
        skills=[
            AgentSkill(
                id="reporter_agent",
                name="report_generation",
                description="Synthesizes comprehensive intelligence reports and generates HTML and PDF outputs. Requires research_context and search_results inputs.",
                tags=["custom", "reporting", "pdf", "html"]
            )
        ],
        defaultInputModes=["application/json"],
        defaultOutputModes=["application/json", "text/html", "application/pdf"],
        supportsAuthenticatedExtendedCard=False
    )


def create_coordinator_agent_card(base_url: str = "http://localhost:8000") -> AgentCard:
    """Create AgentCard for Coordinator agent."""
    return AgentCard(
        name="intelligence_coordinator",
        url=base_url,
        description="Orchestrates intelligence report generation through analysis, search, and reporting phases using A2A protocol.",
        version="1.0.0",
        capabilities={},
        skills=[
            AgentSkill(
                id="intelligence_coordinator",
                name="intelligence_workflow",
                description="Coordinates multi-agent intelligence report generation: Analyzer → Searcher → Reporter. Accepts user queries and produces comprehensive intelligence reports.",
                tags=["sequential", "orchestration", "a2a"]
            )
        ],
        defaultInputModes=["text/plain"],
        defaultOutputModes=["application/json", "text/html", "application/pdf"],
        supportsAuthenticatedExtendedCard=False
    )
