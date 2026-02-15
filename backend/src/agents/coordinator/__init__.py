"""
Coordinator Agent: SequentialAgent that orchestrates Analyzer → Searcher → Reporter.
"""

from .agent import create_coordinator_agent

__all__ = ["create_coordinator_agent"]
