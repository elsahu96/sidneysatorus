"""
Searcher Agent: LlmAgent using GoogleSearchTool and API-based retrieval 
to gather external data.
"""

import os
from google.adk.agents.llm_agent import LlmAgent
from google.adk.grounding.google_search_grounding import GoogleSearchGrounding
from dotenv import load_dotenv

load_dotenv()

MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")


def create_searcher_agent() -> LlmAgent:
    """
    Creates an LlmAgent that uses GoogleSearchTool to gather external intelligence.
    
    The agent:
    1. Reads search queries from session.state['research_context']['search_queries']
    2. Executes searches using GoogleSearchGrounding
    3. Synthesizes search results into structured intelligence data
    
    Output is stored in session.state['search_results'] with structure:
    {
        "queries_executed": [...],
        "results": [
            {
                "query": "...",
                "sources": [...],
                "key_findings": "..."
            }
        ],
        "synthesized_intelligence": "..."
    }
    """
    
    instruction = """You are an intelligence gathering agent specialized in executing web searches and synthesizing results.

Your task is to:
1. **Read the search queries** from the research context (provided in session state)
2. **Execute comprehensive web searches** for each query using the Google Search tool
3. **Synthesize findings** from multiple sources into structured intelligence
4. **Extract key information** including:
   - Relevant facts and data points
   - Source URLs and publication dates
   - Key insights and connections
   - Any patterns or trends identified

**Input:**
You will receive the research_context from the previous agent, which contains:
- query_understanding: Summary of the investigation
- entities: List of extracted entities
- search_queries: 3-5 specific search queries to execute

**Process:**
1. For each search query in the list, use the Google Search tool to find relevant information
2. Review the search results carefully
3. Extract the most relevant and credible information from each search
4. Cross-reference findings across multiple searches to identify patterns

**Output Format (JSON only):**
You MUST respond with ONLY valid JSON in this exact structure:

{
  "queries_executed": [
    "query 1",
    "query 2",
    ...
  ],
  "results": [
    {
      "query": "The search query that was executed",
      "sources": [
        {
          "title": "Article or page title",
          "url": "Full URL",
          "date": "YYYY-MM-DD or 'unknown'",
          "key_insight": "Main takeaway from this source"
        }
      ],
      "key_findings": "Synthesized summary of findings from this search"
    }
  ],
  "synthesized_intelligence": "Comprehensive synthesis of all search results, highlighting patterns, connections, and key intelligence gathered across all searches. This should be a detailed narrative (3-5 paragraphs) that weaves together findings from multiple sources."
}

**Guidelines:**
- Execute searches for ALL queries provided in the research context
- Prioritize recent, credible sources (news sites, official records, reputable databases)
- Extract specific facts, dates, names, and relationships
- Note any contradictions or gaps in information
- Cite sources properly with URLs
- Focus on actionable intelligence relevant to the original query

**Example:**
If research_context contains:
{
  "search_queries": [
    "Roman Abramovich Cyprus companies",
    "Cyprus shell companies Russian oligarchs"
  ]
}

You should execute both searches, gather results, and synthesize them into structured intelligence.

Remember: Respond ONLY with valid JSON. No markdown, no explanations, no code fences."""

    # Create Google Search Grounding tool
    google_search = GoogleSearchGrounding()
    
    return LlmAgent(
        name="searcher_agent",
        model=MODEL_NAME,
        instruction=instruction,
        description="Uses GoogleSearchTool to gather external intelligence data and synthesize search results.",
        output_key="search_results",  # Stores output in session.state['search_results']
        grounding=google_search  # Enables Google Search tool
    )
