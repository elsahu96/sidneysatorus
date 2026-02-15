"""
OSINT Investigation Orchestration Service
Uses Google Gemini to analyze queries and generate investigation plans
Now integrates multi-agent workflow: Analyzer → Searcher → Reporter
"""

import logging
import os
import json
import re
import asyncio
import uuid
from unittest.mock import Mock
from dotenv import load_dotenv
from typing import Dict, List, Any, Optional
from pydantic import BaseModel
from google import genai

logger = logging.getLogger(__name__)

try:
    from google.adk.runner import InMemoryRunner
    from google.adk.core.sessions import InMemorySessionService
    from google.genai import types

    # Import multi-agent coordinator
    try:
        from ..agents.coordinator import create_coordinator_agent
    except ImportError:
        from src.agents.coordinator import create_coordinator_agent
    ADK_AVAILABLE = True
except ImportError as e:
    ADK_AVAILABLE = False
    create_coordinator_agent = None
    InMemoryRunner = None
    InMemorySessionService = None
    types = None
    logger.info(
        "Google ADK not available; multi-agent workflow disabled. "
        "Install with: pip install 'google-adk[a2a]>=1.0'. Error: %s",
        e,
    )

MODEL_NAME = "gemini-3-flash-preview"
load_dotenv()


class EntityModel(BaseModel):
    type: str
    name: str
    context: Optional[str] = None
    aliases: List[str] = []
    location: Optional[str] = None


class DataSourceQuery(BaseModel):
    api: str
    endpoint: str
    method: str
    payload: Dict[str, Any]
    priority: int
    reasoning: str


class InvestigationPlan(BaseModel):
    investigation_id: str
    query_understanding: str
    entity_analysis: Dict[str, Any]
    investigation_type: str
    investigation_plan: Dict[str, Any]
    api_calls: List[DataSourceQuery]
    follow_up_questions: List[str] = []
    risk_assessment: Dict[str, Any]


class OSINTInvestigatorService:
    """
    Service to orchestrate OSINT investigations using Gemini AI
    """

    def __init__(self, use_multi_agent: bool = True):
        """
        Initialize the OSINT Investigator with Gemini API
        
        Args:
            use_multi_agent: If True, use the multi-agent workflow (Analyzer → Searcher → Reporter).
                            If False, use the legacy single-agent approach.
        """
        # Initialize the model
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable is required")
        self.client = genai.Client(api_key=api_key)

        # Load the system prompt
        self.system_prompt = self._load_system_prompt()
        
        # Initialize multi-agent coordinator if enabled
        self.use_multi_agent = use_multi_agent and ADK_AVAILABLE
        if self.use_multi_agent and create_coordinator_agent is not None:
            try:
                self.coordinator_agent = create_coordinator_agent()
                self.session_service = InMemorySessionService()
                # InMemoryRunner can be initialized with agent and app_name, or agent and session_service
                # Try both approaches for compatibility
                try:
                    self.runner = InMemoryRunner(
                        agent=self.coordinator_agent,
                        app_name="osint_investigator",
                        session_service=self.session_service
                    )
                except TypeError:
                    # Fallback: try without session_service parameter
                    try:
                        self.runner = InMemoryRunner(
                            agent=self.coordinator_agent,
                            app_name="osint_investigator"
                        )
                    except TypeError:
                        # Last fallback: try with just agent
                        self.runner = InMemoryRunner(agent=self.coordinator_agent)
            except Exception as e:
                import traceback
                print(f"Warning: Failed to initialize multi-agent workflow: {e}")
                print(traceback.format_exc())
                self.use_multi_agent = False
                self.coordinator_agent = None
                self.session_service = None
                self.runner = None
        else:
            self.coordinator_agent = None
            self.session_service = None
            self.runner = None

    def _load_system_prompt(self) -> str:
        """
        Load the OSINT investigator system prompt with news and geolocation capabilities.
        """
        return """You are an advanced OSINT (Open Source Intelligence) investigator AI system.

Your role is to perform deep-dive analysis, identify geographic markers, and synthesize current events into actionable intelligence reports. You must produce thorough, well-sourced outputs that support due diligence, sanctions compliance, and risk assessment.

CORE RESPONSIBILITIES:

1. NEWS & SOURCE DISCOVERY:
   - Actively search for and synthesize current news, press releases, official designations, court filings, and available digital footprints related to the query. Do not limit yourself to a single region or language where relevant.
   - For every claim, assertion, or data point in your report, you MUST provide a verifiable reference or URL. Unsupported claims must be clearly flagged as unverified or indicative.
   - Prioritise primary sources (government notices, regulatory filings, vessel registries) over secondary or tertiary reporting. Where only secondary sources exist, state that clearly and cite them.
   - Include publication dates and, where possible, the type of source (e.g. OFAC designation, court document, industry report) so readers can assess recency and reliability.

2. GEOSPATIAL INTELLIGENCE:
   - Identify every location mentioned or implied in the user query: headquarters, operational sites, ports, transit corridors, jurisdictions of incorporation, and any other geographically relevant points.
   - Generate approximate decimal coordinates [latitude, longitude] for each of these geolocations so that findings can be visualised on a map. Use WGS84 where possible.
   - Where a location is a region or corridor (e.g. a strait or trade route), provide a representative point and briefly explain in the context field why that point was chosen and what area it represents.
   - If coordinates cannot be determined with confidence, provide the best estimate (e.g. city or region centre) and note the uncertainty in the context field.

3. STRUCTURED REPORTING:
   - Produce a final "Formatted Investigation Report" that organises findings logically, highlights risks and intelligence gaps, and lists all cited sources in a consistent, numbered format.
   - The report should be usable for compliance, legal, or operational decision-making: clear section headings, concise summaries, and explicit links between evidence and conclusions.
   - Maintain a neutral, investigative tone. Distinguish between established facts, reported allegations, and your own assessment or inference.

RESPONSE FORMAT (JSON):
Your response MUST be valid JSON with the following structure. Expand each section with substantive content; do not leave sections as placeholders.

{
  "query_understanding": "A concise but complete summary of the user's intent, the scope of the investigation, and any assumptions about time frame or geography.",
  "entity_analysis": {
    "primary_entities": ["Major actors, organisations, or locations with a short explanation of their role and significance"],
    "secondary_entities": ["Related people, subsidiaries, aliases, or linked events that support the analysis"]
  },
  "investigation_type": "PERSON_INVESTIGATION | COMPANY_INVESTIGATION | GEOPOLITICAL_ANALYSIS | NETWORK_MAPPING",
  "geolocations": [
    {
      "entity": "Full name of location or entity with a geographic footprint",
      "coordinates": [0.0000, 0.0000],
      "context": "Why this location is relevant to the query, what activity or evidence is associated with it, and any uncertainty in the coordinates."
    }
  ],
  "news_and_sources": [
    {
      "title": "Headline or official source name",
      "url": "Full link to source",
      "date": "YYYY-MM-DD",
      "key_insight": "Brief, specific takeaway from this source and how it supports the report."
    }
  ],
  "formatted_report": {
    "summary": "Executive summary of findings: main conclusions, key risks, and critical evidence in several full sentences.",
    "methodology": "Description of the analytical steps taken (e.g. entity extraction, official records review, maritime or trade data, media and network mapping) and any limitations.",
    "detailed_analysis": "Narrative breakdown of the investigation with subsections as needed. Weave in references to news_and_sources; keep the narrative substantive and evidence-based.",
    "risk_factors": ["Explicit list of legal, sanctions, reputational, or verification risks; each item should be a clear, actionable risk statement."],
    "references": ["Numbered list of all sources cited, matching the order and content used in the report."]
  }
}

RULES:
- Respond ONLY with valid JSON. No commentary, no markdown outside the JSON, no trailing commas.
- All coordinates must be decimal [latitude, longitude]. Use negative values for southern and western hemispheres.
- Every reference in the report narrative must correspond to an entry in "news_and_sources"; keep numbering consistent.
- If coordinates are unknown, provide the best estimate (e.g. city centre) and state the uncertainty in the geolocation context.
- Maintain a neutral, investigative tone and clearly separate fact from inference or assessment.
"""

    async def investigation_report(
        self, query: str, context: Optional[str] = None, file_uploads: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Analyze a user query and generate an investigation report using multi-agent workflow.

        Args:
            query: User's investigation query
            context: Optional additional context
            file_uploads: Optional list of uploaded files with structure:
                [
                    {
                        "filename": "file.pdf",
                        "content": "base64_encoded_content",
                        "mime_type": "application/pdf"
                    }
                ]

        Returns:
            Dict containing investigation report with formatted_report (markdown), 
            geolocations, news_and_sources, and report artifacts (HTML/PDF paths)
        """
        # Use multi-agent workflow if enabled and properly initialized
        if self.use_multi_agent and self.coordinator_agent is not None and self.runner is not None:
            return await self._investigation_report_multi_agent(query, context, file_uploads)
        else:
            return await self._investigation_report_legacy(query, context)
    
    async def _investigation_report_multi_agent(
        self, query: str, context: Optional[str] = None, file_uploads: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Generate investigation report using multi-agent workflow: Analyzer → Searcher → Reporter
        
        Args:
            query: User's investigation query
            context: Optional additional context
            file_uploads: Optional list of uploaded files
        
        Returns:
            Dict containing investigation report data
        """
        try:
            # Create a session for this investigation
            user_id = "investigator_user"
            try:
                # Try async create_session
                if asyncio.iscoroutinefunction(self.session_service.create_session):
                    session = await self.session_service.create_session(
                        app_name="osint_investigator",
                        user_id=user_id
                    )
                else:
                    # Sync create_session
                    session = self.session_service.create_session(
                        app_name="osint_investigator",
                        user_id=user_id
                    )
            except TypeError:
                # Try with different parameter names
                try:
                    session = await self.session_service.create_session(
                        app_name="osint_investigator",
                        user_id=user_id
                    )
                except Exception:
                    # Last fallback: create minimal session object
                    session = Mock()
                    session.id = f"session_{uuid.uuid4().hex[:8]}"
                    session.state = {}
            
            session_id = session.id if hasattr(session, 'id') else getattr(session, 'session_id', f"session_{uuid.uuid4().hex[:8]}")
            
            # Store file uploads in session state if provided
            if file_uploads:
                # Ensure session.state exists and is a dict
                if not hasattr(session, 'state'):
                    session.state = {}
                elif not isinstance(session.state, dict):
                    # Convert to dict if it's not already
                    try:
                        session.state = dict(session.state)
                    except Exception:
                        session.state = {}
                session.state["temp:file_uploads"] = file_uploads
            
            # Add context to query if provided
            full_query = query
            if context:
                full_query = f"{query}\n\nAdditional Context: {context}"
            
            # Create user message - try different formats for compatibility
            try:
                # Try with types.Content
                user_message = types.Content(
                    role="user",
                    parts=[types.Part(text=full_query)]
                )
            except Exception:
                # Fallback: use string directly
                user_message = full_query
            
            # Run the coordinator agent workflow
            # This will execute: Analyzer → Searcher → Reporter
            events = []
            try:
                # Try with new_message parameter
                async for event in self.runner.run_async(
                    user_id=user_id,
                    session_id=session_id,
                    new_message=user_message
                ):
                    events.append(event)
            except TypeError:
                # Fallback: try with different parameter names
                try:
                    async for event in self.runner.run_async(
                        user_id=user_id,
                        session_id=session_id,
                        message=user_message
                    ):
                        events.append(event)
                except TypeError:
                    # Last fallback: try with just user_id and message
                    async for event in self.runner.run_async(
                        user_id=user_id,
                        session_id=session_id,
                        content=full_query
                    ):
                        events.append(event)
            
            # Extract results from session state
            # Session state might be accessed differently - try multiple approaches
            state = {}
            if hasattr(session, 'state'):
                if isinstance(session.state, dict):
                    state = session.state
                elif hasattr(session.state, 'get'):
                    # It's a dict-like object
                    state = session.state
                else:
                    # Try accessing as attribute or method
                    try:
                        state = dict(session.state) if hasattr(session.state, '__iter__') else {}
                    except Exception:
                        state = {}
            
            # If state is still empty, try to get it from session service
            if not state:
                try:
                    if hasattr(self.session_service, 'get_session_state'):
                        retrieved_state = self.session_service.get_session_state(session_id)
                        if retrieved_state:
                            state = retrieved_state if isinstance(retrieved_state, dict) else {}
                except Exception:
                    pass
            
            research_context = state.get("research_context", {}) if isinstance(state, dict) else {}
            search_results = state.get("search_results", {}) if isinstance(state, dict) else {}
            report_data = state.get("report_data", {}) if isinstance(state, dict) else {}
            
            # Build the response in the expected format
            result = {
                "query_understanding": research_context.get("query_understanding", query),
                "entity_analysis": {
                    "primary_entities": [],
                    "secondary_entities": []
                },
                "investigation_type": "COMPANY_INVESTIGATION",  # Default, can be extracted from research_context
                "geolocations": [],
                "news_and_sources": [],
                "formatted_report": "",
                "report_artifacts": {
                    "html_content": report_data.get("html_content"),
                    "pdf_path": report_data.get("pdf_path"),
                    "html_path": report_data.get("html_path")
                }
            }
            
            # Extract entities from research_context
            entities = research_context.get("entities", [])
            for entity in entities:
                entity_type = entity.get("type", "").upper()
                entity_data = {
                    "name": entity.get("name", ""),
                    "aliases": entity.get("aliases", []),
                    "context": entity.get("context", ""),
                    "location": entity.get("location")
                }
                
                if entity_type == "PERSON" or entity_type == "ORGANIZATION":
                    result["entity_analysis"]["primary_entities"].append(entity_data)
                else:
                    result["entity_analysis"]["secondary_entities"].append(entity_data)
            
            # Extract geolocations (if available in research_context or search_results)
            # Note: The analyzer might not extract geolocations directly, so we'll need to
            # infer from entities or search results
            for entity in entities:
                if entity.get("location"):
                    result["geolocations"].append({
                        "entity": entity.get("name", ""),
                        "coordinates": [0.0, 0.0],  # Would need geocoding
                        "context": entity.get("location")
                    })
            
            # Extract sources from search_results
            results = search_results.get("results", [])
            for result_item in results:
                sources = result_item.get("sources", [])
                for source in sources:
                    result["news_and_sources"].append({
                        "title": source.get("title", ""),
                        "url": source.get("url", ""),
                        "date": source.get("date", "unknown"),
                        "key_insight": source.get("key_insight", "")
                    })
            
            # Build markdown report from search results and research context
            markdown_report = self._build_markdown_from_agent_results(
                research_context, search_results, report_data
            )
            result["formatted_report"] = markdown_report
            
            return result
            
        except Exception as e:
            # Fallback to legacy method on error
            import traceback
            error_msg = f"Multi-agent workflow error: {e}\n{traceback.format_exc()}"
            print(error_msg)
            # Try legacy method
            try:
                return await self._investigation_report_legacy(query, context)
            except Exception as legacy_error:
                # If legacy also fails, return error response
                return {
                    "query_understanding": query,
                    "entity_analysis": {"primary_entities": [], "secondary_entities": []},
                    "investigation_type": "ERROR",
                    "geolocations": [],
                    "news_and_sources": [],
                    "formatted_report": f"# Error\n\nFailed to generate report: {str(e)}",
                    "report_artifacts": {},
                    "error": str(e)
                }
    
    def _build_markdown_from_agent_results(
        self,
        research_context: Dict[str, Any],
        search_results: Dict[str, Any],
        report_data: Dict[str, Any]
    ) -> str:
        """
        Build markdown report from multi-agent workflow results.
        
        Args:
            research_context: Output from Analyzer agent
            search_results: Output from Searcher agent
            report_data: Output from Reporter agent
        
        Returns:
            Markdown formatted report string
        """
        query_understanding = research_context.get("query_understanding", "")
        entities = research_context.get("entities", [])
        synthesized_intelligence = search_results.get("synthesized_intelligence", "")
        results = search_results.get("results", [])
        
        # Build markdown report
        markdown = f"# Intelligence Report\n\n## Executive Summary\n\n{query_understanding}\n\n"
        
        if synthesized_intelligence:
            markdown += f"**Key Intelligence:**\n\n{synthesized_intelligence}\n\n"
        
        # Key Entities
        if entities:
            markdown += "## Key Entities\n\n"
            for entity in entities:
                entity_type = entity.get("type", "")
                name = entity.get("name", "")
                context = entity.get("context", "")
                markdown += f"- **{name}** ({entity_type}): {context}\n"
            markdown += "\n"
        
        # Methodology
        markdown += "## Methodology\n\n"
        markdown += "This report was generated through automated intelligence gathering:\n"
        markdown += "1. Query analysis and entity extraction\n"
        markdown += "2. Web search execution across multiple queries\n"
        markdown += "3. Intelligence synthesis and cross-referencing\n"
        markdown += "4. Report generation and formatting\n\n"
        
        # Findings
        if results:
            markdown += "## Findings\n\n"
            for idx, result_item in enumerate(results, 1):
                query = result_item.get("query", "")
                findings = result_item.get("key_findings", "")
                markdown += f"### {idx}. {query}\n\n{findings}\n\n"
        
        # Sources
        sources_list = []
        for result_item in results:
            sources = result_item.get("sources", [])
            sources_list.extend(sources)
        
        if sources_list:
            markdown += "## Sources\n\n"
            for idx, source in enumerate(sources_list, 1):
                title = source.get("title", "")
                url = source.get("url", "")
                date = source.get("date", "unknown")
                insight = source.get("key_insight", "")
                markdown += f"{idx}. **{title}** ({date})\n"
                markdown += f"   - URL: {url}\n"
                markdown += f"   - Key Insight: {insight}\n\n"
        
        # Conclusion
        markdown += "## Conclusion\n\n"
        markdown += f"Based on comprehensive intelligence gathering, this report analyzed {len(entities)} key entities. "
        markdown += "The findings indicate significant intelligence value for due diligence and compliance purposes.\n\n"
        markdown += "**Recommendations:**\n"
        markdown += "- Continue monitoring for updates on identified entities\n"
        markdown += "- Verify findings through additional primary sources where possible\n"
        markdown += "- Consider follow-up investigations on specific relationships or transactions identified\n"
        
        return markdown
    
    async def _investigation_report_legacy(
        self, query: str, context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Legacy investigation report method using single Gemini call.
        
        Args:
            query: User's investigation query
            context: Optional additional context

        Returns:
            InvestigationPlan with API calls and strategy
        """
        # Construct the prompt
        user_prompt = f"""Analyse this OSINT investigation query and generate a complete, evidence-based investigation report.

USER QUERY: {query}
"""

        if context:
            user_prompt += f"\nADDITIONAL CONTEXT: {context}\n"

        user_prompt += """
Generate a comprehensive investigation report based on the user query. Every section of your response must be substantive: include multiple paragraphs where appropriate, cite specific sources for key claims, and ensure that the formatted report is suitable for use in due diligence or compliance review.

CORE INVESTIGATIVE METHODOLOGY (apply as relevant to the query):

1. ENTITY EXTRACTION:
   Identify and explain the significance of all entities mentioned or implied in the query: persons, companies, vessels, jurisdictions, and key locations. For each primary entity, provide full names, known aliases, registration or identifier details where applicable, and a clear explanation of their role in the subject matter. Secondary entities (subsidiaries, related persons, linked vessels) should be listed with brief context on how they connect to the primary entities.

2. OFFICIAL RECORDS AND DESIGNATIONS:
   Search and cite official sources such as OFAC and Treasury designations, EU and UK sanctions lists, maritime advisories, court filings, and regulatory notices. For each relevant designation or notice, state the date, authority, and the specific finding or restriction. Note any discrepancies between different jurisdictions or list versions.

3. MARITIME AND TRADE EVIDENCE:
   Where the query involves shipping, trade routes, or supply chains, analyse vessel identities (IMO, name, flag), voyage patterns, AIS gaps or anomalies, and ship-to-ship (STS) or port activity. Reference tools or data sources (e.g. TankerTrackers, MarineTraffic, Lloyd's List) where appropriate. Describe the flow of goods or funds where it can be inferred from available evidence.

4. MEDIA AND OPEN-SOURCE REPORTING:
   Gather and synthesise reporting from reputable news and industry sources (e.g. Reuters, S&P Global, Lloyd's List, specialist newsletters). For each source used, state the headline, date, and the specific insight or fact that supports your report. Distinguish between confirmed facts and reported allegations.

5. NETWORK MAPPING:
   Reconstruct relationships and flows where possible: e.g. Seller -> Intermediary -> Vessel -> STS Location -> Terminal -> Buyer. Name specific entities at each step where identified, and note where the chain is incomplete or uncertain. This section should give a clear picture of how the subject fits into broader networks.

6. ANALYST ASSESSMENT:
   Summarise the strength of the evidence, highlight intelligence gaps, and list concrete risk factors (sanctions exposure, reputational risk, legal or regulatory risk). End with a clear conclusion that ties together the main findings and recommends any follow-up actions or monitoring.

RESPONSE FORMAT (JSON):
Respond with ONLY valid JSON in the following structure. Populate every field with detailed content; do not use placeholder text. The formatted_report structure matches a professional intelligence report layout with clear sections.

{
  "query_understanding": "A full paragraph summarising the user's intent, the scope of the investigation (e.g. time frame, geography, entities in scope), and any key assumptions.",
  "entity_analysis": {
    "primary_entities": ["List of major actors, organisations, or locations, each with a sentence explaining their role and significance in the investigation."],
    "secondary_entities": ["Related persons, subsidiaries, aliases, or linked events that support the analysis, with brief context for each."]
  },
  "investigation_type": "PERSON_INVESTIGATION | COMPANY_INVESTIGATION | GEOPOLITICAL_ANALYSIS | NETWORK_MAPPING",
  "geolocations": [
    {
      "entity": "Full name of the location or entity with a geographic footprint",
      "coordinates": [0.0000, 0.0000],
      "context": "Several sentences explaining why this location is relevant, what activity or evidence is associated with it, and any uncertainty in the coordinates or scope."
    }
  ],
  "news_and_sources": [
    {
      "title": "Full headline or official source name",
      "url": "Complete URL to the source",
      "date": "YYYY-MM-DD",
      "key_insight": "Two to three sentences on the specific takeaway from this source and how it supports the report."
    }
  ],
  "formatted_report": {
    "title": "Main title of the investigation report (e.g. 'Iranian Petrochemicals Sanctions-Evasion Network')",
    "subtitle": "Brief subtitle or intelligence assessment type (e.g. 'Intelligence Assessment — Maritime Concealment & Broker Networks')",
    "executive_summary": {
      "finding": "Multiple sentences (3-5) describing the main finding, key entities identified, and core evidence. Reference specific designations, dates, and entities.",
      "risk": "Multiple sentences (3-5) describing the primary risks: sanctions exposure, legal liability, reputational risk, or operational disruption. Be specific about who is at risk and why.",
      "impact": "Multiple sentences (3-5) describing the material impact, disruption potential, enforcement trends, and consequences for stakeholders."
    },
    "methodology": {
      "overview": "Brief paragraph (2-3 sentences) describing the analytical approach, data sources used, and any limitations.",
      "steps": [
        {
          "number": 1,
          "title": "Step title (e.g. 'Entity Extraction' or 'Official Records Review')",
          "description": "Detailed paragraph describing what was done in this step, specific tools or sources used (e.g. OFAC lists, TankerTrackers, Lloyd's List), and key findings or data points discovered."
        }
      ]
    },
    "company_identifiers": [
      {
        "name": "Company or entity name (e.g. 'PGPIC' or 'Triliance Petrochemical Co. Ltd.')",
        "description": "Full paragraph including registration details, aliases, designation dates, sanctions history, and significance in the investigation. Include specific dates and designating authorities."
      }
    ],
    "findings_and_analysis": [
      {
        "section_number": 1,
        "title": "Section title (e.g. 'PGPIC and its subsidiaries anchor the upstream supply chain')",
        "content": "Extended narrative (3-5 paragraphs) with evidence, specific references to news_and_sources by index (e.g. 'According to source [1]...'), analysis, and supporting details. Use multiple paragraphs for complex findings, include bullet points or lists where helpful."
      }
    ],
    "supply_chain_flow": [
      {
        "step": 1,
        "description": "Description of this step in the supply chain (e.g. 'PGPIC / Triliance (Iran)' or 'Sale to front trading entities (multiple jurisdictions)')"
      }
    ],
    "conclusion": "Extended conclusion (4-6 paragraphs) summarizing findings, evidence strength, intelligence gaps, actionable recommendations, and clear takeaway statements. End with a bold, actionable statement for stakeholders."
  }
}

RULES:
- Respond ONLY with valid JSON. No markdown code fences, no explanatory text before or after the JSON.
- All coordinates must be decimal [latitude, longitude]. Use negative values for southern and western hemispheres.
- Every claim in the report narrative must be traceable to an entry in "news_and_sources"; keep numbering and citations consistent.
- Each section of formatted_report must contain substantial, multi-sentence content where the schema allows."""

        # Generate response from Gemini
        try:
            response = await self.client.aio.models.generate_content(
                model="gemini-3-flash-preview",
                contents=user_prompt,
                config=genai.types.GenerateContentConfig(
                    system_instruction=self.system_prompt,
                    temperature=0.2,  # Optional: keep it focused for OSINT
                ),
            )
        except Exception as e:
            # Handle API errors gracefully
            import traceback
            error_msg = f"Gemini API error: {e}\n{traceback.format_exc()}"
            print(error_msg)
            # Return a basic error response instead of crashing
            return {
                "query_understanding": query,
                "entity_analysis": {"primary_entities": [], "secondary_entities": []},
                "investigation_type": "ERROR",
                "geolocations": [],
                "news_and_sources": [],
                "formatted_report": f"# Error\n\nFailed to generate investigation report due to API error: {str(e)}\n\nPlease check your API key and try again.",
                "error": str(e)
            }

        # Extract JSON from response
        if not hasattr(response, 'text') or not response.text:
            return {
                "query_understanding": query,
                "entity_analysis": {"primary_entities": [], "secondary_entities": []},
                "investigation_type": "ERROR",
                "geolocations": [],
                "news_and_sources": [],
                "formatted_report": "# Error\n\nNo response received from Gemini API.",
                "error": "Empty response from API"
            }
        
        response_text = response.text.strip()

        # Remove markdown code blocks if present (handle multiple formats)
        # Remove ```json at start
        if response_text.startswith("```json"):
            response_text = response_text[7:].strip()
        elif response_text.startswith("```"):
            response_text = response_text[3:].strip()
        
        # Remove ``` at end (handle both single and triple backticks)
        if response_text.endswith("```"):
            response_text = response_text[:-3].strip()
        
        response_text = response_text.strip()

        # Try to extract JSON if there's text before/after
        # Find the first { and try to parse from there
        json_start = response_text.find('{')
        if json_start > 0:
            # There's text before the JSON, try to extract just the JSON
            response_text = response_text[json_start:]
        
        # Try to find the matching closing brace
        # Count braces to find where JSON ends
        brace_count = 0
        json_end = len(response_text)
        for i, char in enumerate(response_text):
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0:
                    json_end = i + 1
                    break
        
        # Extract just the JSON portion
        if json_end < len(response_text):
            response_text = response_text[:json_end]

        response_text = response_text.strip()

        # Parse JSON with error handling
        try:
            plan_data = json.loads(response_text)
        except json.JSONDecodeError as e:
            # If JSON parsing fails, try to fix common issues
            # 1. Try removing trailing commas before closing braces/brackets
            fixed_text = re.sub(r',(\s*[}\]])', r'\1', response_text)
            
            try:
                plan_data = json.loads(fixed_text)
            except json.JSONDecodeError as e2:
                # Still failed, try to extract partial JSON for better error message
                import traceback
                original_response_length = len(response.text) if hasattr(response, 'text') else 0
                error_msg = f"Failed to parse JSON response: {e}\n"
                error_msg += f"Error position: line {e.lineno}, column {e.colno}\n"
                error_msg += f"Original response length: {original_response_length}\n"
                error_msg += f"Extracted text length: {len(response_text)}\n"
                error_msg += f"Response text (first 1000 chars): {response_text[:1000]}\n"
                if len(response_text) > 1000:
                    error_msg += f"... (truncated, total length: {len(response_text)})\n"
                # Also log the original response for debugging
                if hasattr(response, 'text'):
                    error_msg += f"\nOriginal response (first 500 chars): {response.text[:500]}\n"
                print(error_msg)
                traceback.print_exc()
                
                # Try to provide more helpful error message
                error_detail = str(e)
                if hasattr(e, 'pos') and e.pos:
                    error_detail += f" at position {e.pos}"
                if hasattr(e, 'lineno') and e.lineno:
                    error_detail += f" (line {e.lineno}, column {e.colno})"
                
                # Show more context around the error
                error_context = ""
                if hasattr(e, 'pos') and e.pos:
                    start = max(0, e.pos - 50)
                    end = min(len(response_text), e.pos + 50)
                    error_context = f"\n\n**Context around error:**\n```\n{response_text[start:end]}\n```\n"
                    if e.pos < len(response_text):
                        error_context += f"Error is at position {e.pos - start} in the context above.\n"
                
                return {
                    "query_understanding": query,
                    "entity_analysis": {"primary_entities": [], "secondary_entities": []},
                    "investigation_type": "ERROR",
                    "geolocations": [],
                    "news_and_sources": [],
                    "formatted_report": f"# Error\n\nFailed to parse response from Gemini API. The response was not valid JSON.\n\n**Error:** {error_detail}\n\n**Response preview:**\n```\n{response_text[:500]}...\n```{error_context}",
                    "error": f"JSON parsing error: {error_detail}"
                }

        # Generate a formatted markdown report from the plan_data matching IranianPetrochemicalsReport structure
        report = plan_data.get("formatted_report", {})
        title = report.get("title", plan_data.get("query_understanding", "OSINT Analysis"))
        subtitle = report.get("subtitle", "Intelligence Assessment")
        
        markdown_report = f"# {title}\n\n{subtitle}\n\n"

        # Executive Summary (BLUF) with Finding, Risk, Impact
        exec_summary = report.get("executive_summary", {})
        if exec_summary:
            markdown_report += "## Executive Summary (BLUF)\n\n"
            if exec_summary.get("finding"):
                markdown_report += f"### Finding\n\n{exec_summary['finding']}\n\n"
            if exec_summary.get("risk"):
                markdown_report += f"### Risk\n\n{exec_summary['risk']}\n\n"
            if exec_summary.get("impact"):
                markdown_report += f"### Impact\n\n{exec_summary['impact']}\n\n"

        # Methodology
        methodology = report.get("methodology", {})
        if methodology:
            markdown_report += "## Methodology\n\n"
            if isinstance(methodology, str):
                markdown_report += f"{methodology}\n\n"
            else:
                if methodology.get("overview"):
                    markdown_report += f"{methodology['overview']}\n\n"
                steps = methodology.get("steps", [])
                if steps:
                    for step in steps:
                        step_num = step.get("number", "")
                        step_title = step.get("title", "")
                        step_desc = step.get("description", "")
                        markdown_report += f"### {step_num}. {step_title}\n\n{step_desc}\n\n"

        # Company Identifiers
        company_ids = report.get("company_identifiers", [])
        if company_ids:
            markdown_report += "## Company Identifiers (for screening & drafting)\n\n"
            for company in company_ids:
                name = company.get("name", "")
                desc = company.get("description", "")
                markdown_report += f"### {name}\n\n{desc}\n\n"

        # Findings & Analysis
        findings = report.get("findings_and_analysis", [])
        if findings:
            markdown_report += "## Findings & Analysis\n\n"
            for finding in findings:
                section_num = finding.get("section_number", "")
                section_title = finding.get("title", "")
                content = finding.get("content", "")
                markdown_report += f"### {section_num}. {section_title}\n\n{content}\n\n"
        elif report.get("detailed_analysis"):
            # Fallback to old format
            markdown_report += f"## Findings & Analysis\n\n{report['detailed_analysis']}\n\n"

        # Supply Chain Flow
        supply_chain = report.get("supply_chain_flow", [])
        if supply_chain:
            markdown_report += "## Illustrative supply-chain flow (simplified)\n\n"
            for item in supply_chain:
                step_num = item.get("step", "")
                step_desc = item.get("description", "")
                markdown_report += f"{step_num}. {step_desc}\n"
            markdown_report += "\n"

        # Conclusion
        conclusion = report.get("conclusion", "")
        if conclusion:
            markdown_report += f"## Conclusion\n\n{conclusion}\n\n"

        # Risk Factors (if present in old format)
        if report.get("risk_factors"):
            markdown_report += "## Risk Factors\n\n"
            for risk in report["risk_factors"]:
                markdown_report += f"- {risk}\n"
            markdown_report += "\n"

        plan_data["formatted_report"] = markdown_report
        return plan_data

    def extract_entities(self, plan: InvestigationPlan) -> List[EntityModel]:
        """
        Extract all entities from the investigation plan

        Args:
            plan: Investigation plan

        Returns:
            List of EntityModel objects
        """
        entities = []

        # Extract primary entities
        for entity_data in plan.entity_analysis.get("primary_entities", []):
            entities.append(EntityModel(**entity_data))

        # Extract secondary entities
        for entity_data in plan.entity_analysis.get("secondary_entities", []):
            entities.append(EntityModel(**entity_data))

        return entities

    def get_priority_api_calls(
        self, plan: InvestigationPlan, max_priority: int = 3
    ) -> List[DataSourceQuery]:
        """
        Get high-priority API calls from the plan

        Args:
            plan: Investigation plan
            max_priority: Maximum priority level to include (1 = highest)

        Returns:
            List of high-priority API calls
        """
        return [call for call in plan.api_calls if call.priority <= max_priority]


#     async def refine_investigation(
#         self,
#         original_query: str,
#         initial_results: Dict[str, Any],
#         user_feedback: Optional[str] = None,
#     ) -> InvestigationPlan:
#         """
#         Refine investigation based on initial results

#         Args:
#             original_query: Original user query
#             initial_results: Results from initial API calls
#             user_feedback: Optional user feedback or clarification

#         Returns:
#             Refined investigation plan
#         """
#         refinement_prompt = f"""Original Query: {original_query}

# Initial Results Summary:
# {json.dumps(initial_results, indent=2)}

# {f"User Feedback: {user_feedback}" if user_feedback else ""}

# Based on the initial results, refine the investigation plan:
# 1. Identify gaps in information
# 2. Suggest follow-up API calls
# 3. Propose deeper analysis areas
# 4. Generate new queries based on findings

# Respond with updated investigation plan JSON."""

#         # Generate refined plan
#         response = await asyncio.to_thread(
#             self.client.models.generate_content,
#         MODEL_NAME,
#         contents=user_prompt,
#         config={"system_instruction": self.system_prompt}
#         )

#         response_text = response.text.strip()
#         if response_text.startswith("```json"):
#             response_text = response_text[7:-3].strip()

#         plan_data = json.loads(response_text)
#         return InvestigationPlan(**plan_data)


# Example usage
async def example_usage():
    """
    Example of how to use the OSINT Investigator service
    """
    # Initialize service
    investigator = OSINTInvestigatorService()

    # # Example 1: Person investigation
    # query1 = """I am investigating Russell Cherry, help me find his X account.
    # He has worked previously as a councillor. Please analyse his profile with a
    # focus on his political views and affiliations, as well as anything which
    # could be deemed as controversial."""

    # plan1 = await investigator.analyze_query(query1)

    # print("=== Investigation Plan ===")
    # print(f"Type: {plan1.investigation_type}")
    # print(f"Understanding: {plan1.query_understanding}")
    # print(f"\nAPI Calls to make:")
    # for api_call in plan1.api_calls:
    #     print(f"\n{api_call.priority}. {api_call.api} - {api_call.endpoint}")
    #     print(f"   Reasoning: {api_call.reasoning}")
    #     print(f"   Payload: {json.dumps(api_call.payload, indent=6)}")

    # Example 2: Geopolitical investigation
    query2 = """Investigate the current sanctions-evasion ecosystem for Iranian petrochemicals, detailing producer and broker networks and maritime concealment patterns"""

    plan2 = await investigator.investigation_report(query2)

    print("\n\n=== Geopolitical Investigation Plan ===")
    print(f"Report: {plan2['formatted_report']}")
    print(f"Geolocations: {plan2['geolocations']}")
    print(f"News and Sources: {plan2['news_and_sources']}")


if __name__ == "__main__":

    asyncio.run(example_usage())
