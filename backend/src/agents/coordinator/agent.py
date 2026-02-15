"""
Coordinator Agent: SequentialAgent (A2A Client) that orchestrates the flow:
Analyzer → Searcher → Reporter
"""

from google.adk.agents.sequential_agent import SequentialAgent
from ..analyzer import create_analyzer_agent
from ..searcher import create_searcher_agent
from ..reporter import create_reporter_agent


def create_coordinator_agent() -> SequentialAgent:
    """
    Creates a SequentialAgent that orchestrates the intelligence report workflow.
    
    Flow:
    1. Analyzer: Parses query, extracts entities, generates search queries
       → Stores in session.state['research_context']
    
    2. Searcher: Executes searches using GoogleSearchTool
       → Stores in session.state['search_results']
    
    3. Reporter: Synthesizes report, generates HTML/PDF
       → Stores in session.state['report_html_path'], 'report_pdf_path', 'report_data'
    
    Returns:
        SequentialAgent configured with the three sub-agents
    """
    
    analyzer = create_analyzer_agent()
    searcher = create_searcher_agent()
    reporter = create_reporter_agent()
    
    return SequentialAgent(
        name="intelligence_coordinator",
        description="Orchestrates intelligence report generation through analysis, search, and reporting phases.",
        sub_agents=[analyzer, searcher, reporter]
    )
