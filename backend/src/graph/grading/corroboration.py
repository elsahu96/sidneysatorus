"""
Cross-article corroboration analysis via Claude.

Extracts claims from all articles' key_points, groups them by semantic similarity,
and scores each article based on how many independent sources confirm its claims.
"""

import json
import logging
from typing import Any

from langchain_anthropic import ChatAnthropic

from .config import CORROBORATION_SCORES, GRADING_LLM_MODEL
from .data_loaders import normalize_domain

logger = logging.getLogger(__name__)

_claude = ChatAnthropic(model=GRADING_LLM_MODEL, temperature=0, max_tokens=4096)

_CORROBORATION_PROMPT = """You are a cross-source corroboration analyst for an intelligence platform.

Below are key claims from multiple news articles, grouped by source. Analyse which claims are corroborated across multiple INDEPENDENT sources (different domains).

IMPORTANT: Wire service syndication (the same article republished on multiple sites) does NOT count as independent corroboration. Only count genuinely independent reporting.

For each source, determine a corroboration level:
- "strong": 3+ independent sources confirm the source's key claims
- "moderate": 2 independent sources confirm
- "partial": Some overlap but not on primary claims
- "standalone": No corroboration found for key claims
- "contradicted": Other sources actively contradict the key claims

Sources and their claims:
{sources_block}

Respond with ONLY a JSON object mapping each source domain to its corroboration assessment:
{{
  "domain1.com": {{"level": "strong", "confirming_sources": 4, "reasoning": "..."}},
  "domain2.com": {{"level": "standalone", "confirming_sources": 0, "reasoning": "..."}},
  ...
}}"""


def analyze_corroboration(articles: list[dict]) -> dict[str, dict[str, Any]]:
    """
    Analyse corroboration across all articles in a query result set.

    Args:
        articles: List of enriched article dicts with 'url', 'key_points', 'header'.

    Returns:
        Dict mapping article URL to corroboration data:
            {"level": str, "score": int, "confirming_sources": int, "reasoning": str}
    """
    if not articles:
        return {}

    if len(articles) == 1:
        url = articles[0].get("url", "")
        return {
            url: {
                "level": "standalone",
                "score": CORROBORATION_SCORES["standalone"],
                "confirming_sources": 0,
                "reasoning": "Single source in query — no corroboration possible.",
            }
        }

    # Build the sources block for the prompt
    sources_block_parts = []
    url_to_domain: dict[str, str] = {}
    domain_to_urls: dict[str, list[str]] = {}

    for article in articles:
        url = article.get("url", "")
        domain = normalize_domain(url)
        url_to_domain[url] = domain

        if domain not in domain_to_urls:
            domain_to_urls[domain] = []
        domain_to_urls[domain].append(url)

        key_points = article.get("key_points", [])
        header = article.get("header", "")
        if key_points:
            points_str = "\n".join(f"  - {kp}" for kp in key_points)
        else:
            points_str = f"  - {article.get('summary', 'No key points available')}"

        sources_block_parts.append(f"Source: {domain} ({header})\n{points_str}")

    sources_block = "\n\n".join(sources_block_parts)

    try:
        response = _claude.invoke(_CORROBORATION_PROMPT.format(sources_block=sources_block))
        content = response.content.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        raw_result = json.loads(content)
    except Exception as e:
        logger.warning("Corroboration analysis failed: %s — defaulting all to 'standalone'", e)
        return {
            article.get("url", ""): {
                "level": "standalone",
                "score": CORROBORATION_SCORES["standalone"],
                "confirming_sources": 0,
                "reasoning": "Corroboration analysis unavailable.",
            }
            for article in articles
        }

    # Map Claude's domain-level results back to article URLs
    results: dict[str, dict[str, Any]] = {}
    for article in articles:
        url = article.get("url", "")
        domain = url_to_domain.get(url, "")
        domain_result = raw_result.get(domain, {})

        level = domain_result.get("level", "standalone")
        if level not in CORROBORATION_SCORES:
            level = "standalone"

        results[url] = {
            "level": level,
            "score": CORROBORATION_SCORES[level],
            "confirming_sources": domain_result.get("confirming_sources", 0),
            "reasoning": domain_result.get("reasoning", ""),
        }

    return results
