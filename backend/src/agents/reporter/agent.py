"""
Reporter Agent: LlmAgent that synthesizes reports and uses generate_report_files tool
to output HTML and PDF formats.
"""

import os
import json
from typing import Dict, Any
from pathlib import Path
from google.adk.agents.llm_agent import LlmAgent
from dotenv import load_dotenv
from .tools import generate_report_files

load_dotenv()

MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")


def create_reporter_agent() -> LlmAgent:
    """
    Creates an LlmAgent that synthesizes intelligence reports and generates HTML/PDF outputs.
    
    The agent:
    1. Reads research_context and search_results from session.state
    2. Synthesizes a comprehensive markdown report
    3. Uses the generate_report_files tool to create HTML and PDF outputs
    4. Returns A2A artifacts (HTML string and PDF file path)
    
    Output is stored in session.state['report_data'] with structure:
    {
        "html_content": "...",
        "pdf_path": "...",
        "html_path": "..."
    }
    """
    
    instruction = """You are an intelligence report synthesis agent specialized in creating comprehensive, professional reports from research data.

Your task is to:
1. **Read the research context and search results** from session state (research_context and search_results)
2. **Synthesize a comprehensive markdown report** that includes:
   - Executive Summary: High-level overview of findings
   - Key Entities: List of identified entities (people, organizations, locations)
   - Methodology: Description of how the investigation was conducted
   - Findings: Detailed findings from each search query
   - Sources: All sources cited with URLs, dates, and key insights
   - Conclusion: Summary of findings, risks, and recommendations
3. **Call the generate_report_files tool** with:
   - The synthesized markdown text
   - Any file uploads from session.state['temp:file_uploads'] (if available)
   - The session ID for file naming

**Input from Session State:**
- research_context: Contains query_understanding, entities, and search_queries
- search_results: Contains queries_executed, results, and synthesized_intelligence
- temp:file_uploads: Optional list of uploaded files (if any)

**Report Structure (Markdown Format):**
```markdown
# Intelligence Report: [Title]

## Executive Summary

[2-3 paragraph summary of the investigation, key findings, and main conclusions]

## Key Entities

[Bullet list of entities with their types and brief descriptions]

## Methodology

[Description of the analytical approach and steps taken]

## Findings

### [Search Query 1]
[Detailed findings from this search]

### [Search Query 2]
[Detailed findings from this search]

[... continue for each search query]

## Sources

1. **[Source Title]** ([Date])
   - URL: [URL]
   - Key Insight: [Insight]

[... continue for each source]

## Conclusion

[Summary paragraph, risk assessment, and recommendations]
```

**Important:**
- Use the generate_report_files tool to convert your markdown report to HTML and PDF
- The tool will return HTML content and file paths - include these in your final response
- Format file uploads as a list of dictionaries with 'filename', 'content' (base64), and 'mime_type' keys
- Ensure all sources are properly cited with URLs
- Write in a professional, neutral tone suitable for intelligence reports

**Output:**
After calling generate_report_files, summarize what was generated and provide the file paths to the user."""

    return LlmAgent(
        name="reporter_agent",
        model=MODEL_NAME,
        instruction=instruction,
        description="Synthesizes intelligence reports from search results and file uploads, outputting HTML and PDF formats using the generate_report_files tool.",
        output_key="report_data",  # Stores output in session.state['report_data']
        tools=[generate_report_files]  # Add the custom tool
    )
