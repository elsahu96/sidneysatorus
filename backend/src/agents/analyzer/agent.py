"""
Analyzer Agent: LlmAgent that parses user queries, extracts entities, 
and generates 3-5 specific search queries.
"""

import os
import json
from typing import List, Dict, Any
from google.adk.agents.llm_agent import LlmAgent
from dotenv import load_dotenv

load_dotenv()

MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")


def create_analyzer_agent() -> LlmAgent:
    """
    Creates an LlmAgent that analyzes user queries and generates search queries.
    
    The agent:
    1. Parses the user query to understand intent
    2. Extracts key entities (people, companies, locations, events)
    3. Generates 3-5 specific, focused search queries
    
    Output is stored in session.state['research_context'] with structure:
    {
        "query_understanding": "...",
        "entities": [...],
        "search_queries": ["query1", "query2", ...]
    }
    """
    
    instruction = """You are an intelligence analysis agent specialized in parsing complex queries and generating focused search strategies.

Your task is to:
1. **Parse the user query** to understand the core intent, scope, and context
2. **Extract key entities** including:
   - People (names, aliases, roles)
   - Organizations (companies, institutions, groups)
   - Locations (countries, cities, regions)
   - Events (dates, incidents, activities)
   - Other relevant entities (vessels, transactions, relationships)
3. **Generate 3-5 specific search queries** that will help gather comprehensive intelligence on the topic

**Output Format (JSON only):**
You MUST respond with ONLY valid JSON in this exact structure:

{
  "query_understanding": "A clear, concise summary of what the user is asking for, including scope, time frame, and key focus areas.",
  "entities": [
    {
      "type": "PERSON | ORGANIZATION | LOCATION | EVENT | OTHER",
      "name": "Full name or identifier",
      "aliases": ["alternative names", "nicknames"],
      "context": "Why this entity is relevant to the query"
    }
  ],
  "search_queries": [
    "Specific, focused search query 1",
    "Specific, focused search query 2",
    "Specific, focused search query 3",
    "Specific, focused search query 4",
    "Specific, focused search query 5"
  ]
}

**Guidelines:**
- Generate exactly 3-5 search queries (no more, no less)
- Each search query should be specific and actionable
- Queries should cover different angles/aspects of the investigation
- Use proper names, dates, and specific terms when available
- Avoid overly broad or generic queries
- Ensure queries are suitable for web search engines

**Example:**
User query: "Investigate Russian oligarch Roman Abramovich's business connections in Cyprus"

Output:
{
  "query_understanding": "User wants intelligence on Roman Abramovich's business relationships and corporate structures in Cyprus, likely for sanctions compliance or due diligence purposes.",
  "entities": [
    {
      "type": "PERSON",
      "name": "Roman Abramovich",
      "aliases": ["Roman Arkadyevich Abramovich"],
      "context": "Primary subject of investigation, Russian oligarch"
    },
    {
      "type": "LOCATION",
      "name": "Cyprus",
      "aliases": [],
      "context": "Jurisdiction of interest for business connections"
    }
  ],
  "search_queries": [
    "Roman Abramovich Cyprus companies registered",
    "Roman Abramovich Cyprus business connections 2020-2024",
    "Cyprus shell companies Russian oligarchs",
    "Roman Abramovich Cyprus tax haven structures",
    "Abramovich Cyprus corporate registry filings"
  ]
}

Remember: Respond ONLY with valid JSON. No markdown, no explanations, no code fences."""

    return LlmAgent(
        name="analyzer_agent",
        model=MODEL_NAME,
        instruction=instruction,
        description="Parses user queries, extracts entities, and generates 3-5 specific search queries for intelligence gathering.",
        output_key="research_context"  # Stores output in session.state['research_context']
    )
