import json
import os
import pathlib
import re
from datetime import datetime
from langchain_core.tools import tool

# Must match the limit in asknews.py.
# Gemini raises two related errors:
#   "Separator is not found, and chunk exceed the limit"  → no whitespace in a long block
#   "Separator is found, but chunk is longer than limit"  → whitespace present but segment
#       between two whitespace runs is still too long
# Fix: split on ALL whitespace and truncate any non-whitespace segment > _MAX_WORD_BYTES.
_MAX_WORD_BYTES = 500  # conservative — matches asknews.py _MAX_TOKEN_BYTES


def _strip_markdown(text: str) -> str:
    """Remove markdown formatting characters from a string, leaving plain text.

    Handles: headings, bold, italic, inline code, links, images, horizontal
    rules, blockquotes, and leading list markers.
    """
    if not text:
        return text
    # Headings: ## Title → Title
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    # Bold/italic: ***x***, **x**, *x*, __x__, _x_
    text = re.sub(r'\*{1,3}(.+?)\*{1,3}', r'\1', text)
    text = re.sub(r'_{1,3}(.+?)_{1,3}', r'\1', text)
    # Inline code: `code`
    text = re.sub(r'`(.+?)`', r'\1', text)
    # Links: [text](url) → text
    text = re.sub(r'\[([^\]]*)\]\([^\)]*\)', r'\1', text)
    # Images: ![alt](url) → alt
    text = re.sub(r'!\[([^\]]*)\]\([^\)]*\)', r'\1', text)
    # Blockquotes: > text → text
    text = re.sub(r'^>\s?', '', text, flags=re.MULTILINE)
    # Horizontal rules
    text = re.sub(r'^[-*_]{3,}\s*$', '', text, flags=re.MULTILINE)
    # List markers: - item, * item, + item, 1. item → item
    text = re.sub(r'^[\-\*\+]\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'^\d+\.\s+', '', text, flags=re.MULTILINE)
    # Collapse multiple blank lines to one
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def _sanitize(text: str) -> str:
    """
    Make a string value safe to pass through Gemini API:

    1. Collapse embedded \\n / \\r / \\t to a single ASCII space.
       (json.dumps encodes \\n as the two-byte sequence \\\\n — NOT whitespace in
       the HTTP body.  Only ASCII 0x20 survives as a real separator.)
    2. Truncate any space-delimited token whose UTF-8 byte length exceeds
       _MAX_WORD_BYTES (catches base64 blobs, minified JS, long hashes, etc.).
    """
    if not text:
        return text
    # Step 1: normalise non-space whitespace → space
    text = re.sub(r'[\n\r\t\x0b\x0c]+', ' ', text)
    # Step 2: truncate long space-delimited tokens
    parts = text.split(' ')
    result = []
    for part in parts:
        if not part:
            continue
        if len(part.encode("utf-8")) > _MAX_WORD_BYTES:
            encoded = part.encode("utf-8")[:_MAX_WORD_BYTES]
            result.append(encoded.decode("utf-8", errors="ignore") + "…")
        else:
            result.append(part)
    return ' '.join(result)

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
        report_summary:             Executive summary as plain text (5-7 sentences).
        report_methodology:         Analytical steps taken and data limitations, plain text.
        report_detailed_analysis:   Full narrative analysis as plain text with inline
                                    citations as [1], [2] matching sources list.
        risk_factors:               List of risk statements.
        sources:                    List of dicts {title, url, date (YYYY-MM-DD), key_insight}.
                                    Preserve source URLs exactly as provided — grading is
                                    matched by URL after writing.
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

    # Strip markdown formatting so the JSON stores plain text.
    report_summary = _strip_markdown(report_summary)
    report_methodology = _strip_markdown(report_methodology)
    report_detailed_analysis = _strip_markdown(report_detailed_analysis)
    query_understanding = _strip_markdown(query_understanding)
    risk_factors = [_strip_markdown(r) for r in risk_factors]

    # Sanitize long-text fields so no whitespace-delimited token exceeds
    # Gemini's internal chunk limit (raises "Separator is not found").
    report_summary = _sanitize(report_summary)
    report_methodology = _sanitize(report_methodology)
    report_detailed_analysis = _sanitize(report_detailed_analysis)
    query_understanding = _sanitize(query_understanding)

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
