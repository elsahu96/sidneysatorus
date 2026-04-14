"""
Claude-based attribution quality classification.

Analyses article key_points to determine the quality of source attribution
(named officials, documents, institutional, etc.) and returns a 0-100 score.
"""

import json
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

from langchain_anthropic import ChatAnthropic

from .config import ATTRIBUTION_SCORES, AUTHOR_BONUS, GRADING_LLM_MODEL

logger = logging.getLogger(__name__)

_claude = ChatAnthropic(model=GRADING_LLM_MODEL, temperature=0, max_tokens=512)

_CLASSIFICATION_PROMPT = """You are an attribution quality classifier for news intelligence analysis.

Analyse the following key points from a news article and classify the HIGHEST quality attribution type present.

Attribution types (from highest to lowest quality):
- named_official_source: A named person in an official capacity is quoted or cited (e.g. "John Smith, CEO of...", "Foreign Minister X said...")
- named_unofficial_source: A named person without official standing is cited (e.g. "analyst Jane Doe noted...")
- document_or_data_citation: A specific document, dataset, filing, or report is referenced (e.g. "according to SEC filings...", "the UN report states...")
- institutional_attribution: An organisation is cited without naming individuals (e.g. "the Pentagon confirmed...", "Reuters reported...")
- unnamed_official_source: An unnamed official is cited (e.g. "a senior official said...", "sources familiar with...")
- no_attribution: No discernible attribution; claims are stated as fact without sourcing

Key points to analyse:
{key_points}

Respond with ONLY a JSON object:
{{"attribution_type": "<type>", "reasoning": "<brief explanation>"}}"""


def classify_attribution(key_points: list[str], has_author: bool) -> int:
    """
    Classify attribution quality for a single article's key_points.

    Args:
        key_points: List of key point strings from AskNews.
        has_author: Whether the article has a named author.

    Returns:
        Attribution score 0-100.
    """
    if not key_points:
        base_score = ATTRIBUTION_SCORES["no_attribution"]
        return min(100, base_score + AUTHOR_BONUS) if has_author else base_score

    formatted_points = "\n".join(f"- {kp}" for kp in key_points)
    try:
        response = _claude.invoke(_CLASSIFICATION_PROMPT.format(key_points=formatted_points))
        content = response.content.strip()
        # Parse JSON from response
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        result = json.loads(content)
        attr_type = result.get("attribution_type", "no_attribution")
        base_score = ATTRIBUTION_SCORES.get(attr_type, ATTRIBUTION_SCORES["no_attribution"])
    except Exception as e:
        logger.warning("Attribution classification failed: %s — defaulting to 50", e)
        base_score = 50

    if has_author:
        base_score = min(100, base_score + AUTHOR_BONUS)

    return base_score


def classify_attributions_batch(
    articles: list[dict],
    max_workers: int = 8,
) -> dict[str, int]:
    """
    Classify attribution quality for multiple articles in parallel.

    Args:
        articles: List of enriched article dicts (must have 'url', 'key_points', 'authors').
        max_workers: Maximum parallel Claude calls.

    Returns:
        Dict mapping article URL to attribution score (0-100).
    """
    results: dict[str, int] = {}
    if not articles:
        return results

    def _classify_one(article: dict) -> tuple[str, int]:
        url = article.get("url", "")
        key_points = article.get("key_points", [])
        authors = article.get("authors", [])
        has_author = bool(authors and any(a.strip() for a in authors if a))
        score = classify_attribution(key_points, has_author)
        return url, score

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(_classify_one, a): a for a in articles}
        for future in as_completed(futures):
            try:
                url, score = future.result()
                results[url] = score
            except Exception as e:
                url = futures[future].get("url", "unknown")
                logger.warning("Attribution classification failed for %s: %s", url, e)
                results[url] = 50

    return results
