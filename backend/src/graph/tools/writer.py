import json
import os
import pathlib
from datetime import datetime
from langchain_core.tools import tool

# Project root is 4 levels up from this file:
# tools/ -> graph/ -> src/ -> backend/ -> <project_root>
_PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[4]
_DEFAULT_REPORT_DIR = _PROJECT_ROOT / "reports"

# Side-channel storage: populated when write_report runs so callers
# higher up the stack (e.g. run_with_hitl) can retrieve the paths
# without having to parse LLM-generated text.
_last_write_result: dict = {}


@tool
def write_report(
    title: str,
    query_understanding: str,
    investigation_type: str,
    primary_entities: list[dict],  # [{"name": ..., "role": ...}]
    secondary_entities: list[dict],
    geolocations: list[dict],  # [{"entity", "coordinates", "type", "context"}]
    report_summary: str,
    report_methodology: str,
    report_detailed_analysis: str,
    risk_factors: list[str],
    sources: list[dict],  # [{"title", "url", "date", "key_insight"}]
    filename: str = "",
) -> str:
    """
    Write the complete investigation report as a single structured JSON file.
    The JSON contains both the formatted report content (in markdown strings)
    and all metadata/geolocations needed to render a map on the frontend.

    Args:
        title:                      Short descriptive report title.
        query_understanding:        Summary of user intent and investigation scope.
        investigation_type:         PERSON_INVESTIGATION | COMPANY_INVESTIGATION |
                                    GEOPOLITICAL_ANALYSIS | NETWORK_MAPPING
        primary_entities:           List of dicts {name, role} for major actors.
        secondary_entities:         List of dicts {name, role} for related actors.
        geolocations:               List of dicts:
                                      - entity (str)
                                      - coordinates ([lat, lon])
                                      - type (str): e.g. "hq", "incident", "registration"
                                      - context (str): why this location is relevant
                                    Only include locations you can confidently geocode.
        report_summary:             Executive summary in markdown (5-7 sentences).
        report_methodology:         Analytical steps taken and data limitations.
        report_detailed_analysis:   Full narrative analysis in markdown with inline
                                    citations as [1], [2] matching sources list.
        risk_factors:               List of risk statements.
        sources:                    List of dicts {title, url, date (YYYY-MM-DD), key_insight}.
        filename:                   Optional filename stem. Defaults to timestamped name.

    Returns:
        JSON string with keys: json_path, reference_count, geolocation_count.
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    if filename:
        stem = f"{filename.removesuffix('.json')}_{timestamp}"
    else:
        stem = f"report_{timestamp}"
    env_dir = os.environ.get("REPORT_OUTPUT_DIR")
    output_dir = pathlib.Path(env_dir).resolve() if env_dir else _DEFAULT_REPORT_DIR
    output_dir.mkdir(parents=True, exist_ok=True)

    json_path = output_dir / f"{stem}.json"

    # Index sources for inline citation matching
    indexed_sources = [{"index": i + 1, **source} for i, source in enumerate(sources)]

    payload = {
        "metadata": {
            "title": title,
            "written_at": datetime.now().isoformat(),
            "investigation_type": investigation_type,
            "query_understanding": query_understanding,
            "stats": {
                "reference_count": len(sources),
                "geolocation_count": len(geolocations),
                "primary_entity_count": len(primary_entities),
                "risk_factor_count": len(risk_factors),
            },
        },
        "entities": {
            "primary": primary_entities,
            "secondary": secondary_entities,
        },
        "geolocations": geolocations,
        "report": {
            "summary": report_summary,
            "methodology": report_methodology,
            "detailed_analysis": report_detailed_analysis,
            "risk_factors": risk_factors,
            "sources": indexed_sources,
        },
    }

    with json_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    _last_write_result.update({"json_path": str(json_path)})
    return str(json_path)
