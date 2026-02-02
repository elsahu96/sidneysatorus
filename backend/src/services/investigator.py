"""
OSINT Investigation Orchestration Service
Uses Google Gemini to analyze queries and generate investigation plans
"""

import os
import json
import asyncio
from dotenv import load_dotenv
from typing import Dict, List, Any, Optional
from pydantic import BaseModel
from google import genai

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

    def __init__(self):
        """
        Initialize the OSINT Investigator with Gemini API
        """
        # Initialize the model
        self.client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

        # Load the system prompt
        self.system_prompt = self._load_system_prompt()

    def _load_system_prompt(self) -> str:
        """
        Load the OSINT investigator system prompt with news and geolocation capabilities.
        """
        return """You are an advanced OSINT (Open Source Intelligence) investigator AI system. 
    
Your role is to perform deep-dive analysis, identify geographic markers, and synthesize current events into actionable intelligence reports.

CORE RESPONSIBILITIES:

1. NEWS & SOURCE DISCOVERY:
- Actively search for and synthesize current news, press releases, and available digital footprints related to the query.
- For every claim or data point, you MUST provide a verifiable reference or URL.

2. GEOSPATIAL INTELLIGENCE:
- Identify every location mentioned or implied in the user query.
- Generate approximate decimal coordinates [latitude, longitude] for these geolocations to facilitate mapping.

3. STRUCTURED REPORTING:
- Produce a final "Formatted Investigation Report" that organizes findings logically, highlights risks, and lists all cited sources.

RESPONSE FORMAT (JSON):
{
  "query_understanding": "Concise summary of the user's intent and the scope of the investigation.",
  "entity_analysis": {
    "primary_entities": ["Major actors, organizations, or locations"],
    "secondary_entities": ["Related people, subsidiaries, or linked events"]
  },
  "investigation_type": "PERSON_INVESTIGATION | COMPANY_INVESTIGATION | GEOPOLITICAL_ANALYSIS | NETWORK_MAPPING",
  "geolocations": [
    {
      "entity": "Name of location/entity",
      "coordinates": [0.0000, 0.0000],
      "context": "Why this location is relevant"
    }
  ],
  "news_and_sources": [
    {
      "title": "Headline or source name",
      "url": "Link to source",
      "date": "YYYY-MM-DD",
      "key_insight": "Brief takeaway"
    }
  ],
  "formatted_report": {
    "summary": "Executive summary of findings",
    "detailed_analysis": "Narrative breakdown of the investigation",
    "risk_factors": ["Legal, safety, or verification risks"],
    "references": ["Numbered list of all sources cited"]
  }
}

RULES:
- Respond ONLY with valid JSON.
- If coordinates are unknown, provide the best estimate based on the city/region center.
- Ensure all "references" in the report correspond to items in "news_and_sources".
- Maintain a neutral, investigative tone."""

    async def investigation_report(
        self, query: str, context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze a user query and generate an investigation plan

        Args:
            query: User's investigation query
            context: Optional additional context

        Returns:
            InvestigationPlan with API calls and strategy
        """
        # Construct the prompt
        user_prompt = f"""Analyze this OSINT investigation query and generate a complete investigation report.

USER QUERY: {query}
"""

        if context:
            user_prompt += f"\nADDITIONAL CONTEXT: {context}\n"

        user_prompt += """
            Generate a comprehensive investigation report based on the user query.
            Include references to the data sources used and the sources used to generate the report.
            Respond with ONLY the investigation report in markdown format, no additional text."""

        # Generate response from Gemini
        response = await self.client.aio.models.generate_content(
            model="gemini-3-flash-preview",
            contents=user_prompt,
            config=genai.types.GenerateContentConfig(
                system_instruction=self.system_prompt,
                temperature=0.2,  # Optional: keep it focused for OSINT
            ),
        )

        # Extract JSON from response
        response_text = response.text.strip()

        # Remove markdown code blocks if present
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]

        response_text = response_text.strip()

        # Parse JSON
        plan_data = json.loads(response_text)

        # Generate a formatted markdown report from the plan_data
        report = plan_data.get("formatted_report", {})
        markdown_report = f"# Investigation Report: {plan_data.get('query_understanding', 'OSINT Analysis')}\n\n"

        if "summary" in report:
            markdown_report += f"## Executive Summary\n{report['summary']}\n\n"

        if "detailed_analysis" in report:
            markdown_report += (
                f"## Detailed Analysis\n{report['detailed_analysis']}\n\n"
            )

        if "risk_factors" in report:
            markdown_report += "## Risk Factors\n"
            for risk in report["risk_factors"]:
                markdown_report += f"- {risk}\n"
            markdown_report += "\n"

        if "references" in report:
            markdown_report += "## References\n"
            for ref in report["references"]:
                markdown_report += f"- {ref}\n"
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
