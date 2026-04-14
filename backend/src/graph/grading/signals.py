"""
Claude-powered analyst signal generation.

Produces 3-6 tagged plain-language bullet points per source, written in the
voice of an experienced intelligence analyst.
"""

import json
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from langchain_anthropic import ChatAnthropic

from .config import GRADING_LLM_MODEL

logger = logging.getLogger(__name__)

_claude = ChatAnthropic(model=GRADING_LLM_MODEL, temperature=0, max_tokens=1024)

_SIGNAL_PROMPT = """You are an experienced intelligence analyst writing a source assessment.

Generate 3-6 concise plain-language signals explaining why this source received its grade.
Each signal should reference specific characteristics of the source, not algorithmic factors.
Write as an analyst would brief a colleague — direct, factual, no hedging.

Source: {source_name} ({domain})
Grade: {grade} ({composite_score}/100)
Article title: {header}

Factor breakdown:
- Factual reliability: {factual}/100
- Source authority: {authority}/100
- Bias and objectivity: {bias}/100
- Attribution quality: {attribution}/100
- Press environment: {press}/100
- Corroboration: {corroboration}/100

Penalties/bonuses applied: {penalties}
Corroboration detail: {corroboration_reasoning}

Respond with ONLY a JSON array of signal objects:
[
  {{"text": "signal text here", "sentiment": "positive"}},
  {{"text": "signal text here", "sentiment": "negative"}},
  {{"text": "signal text here", "sentiment": "neutral"}}
]

Sentiment must be one of: positive, negative, neutral."""


def generate_signals(
    article: dict,
    grading_result: dict[str, Any],
    corroboration_data: dict[str, Any] | None = None,
) -> list[dict[str, str]]:
    """
    Generate analyst signals for a single graded article.

    Args:
        article: Enriched article dict.
        grading_result: Output from SourceGrader.grade_article().
        corroboration_data: Corroboration metadata for this article.

    Returns:
        List of {"text": str, "sentiment": "positive"|"negative"|"neutral"}.
    """
    from .data_loaders import normalize_domain

    factor_scores = grading_result.get("factor_scores", {})
    penalties = grading_result.get("penalties_applied", [])
    corr_reasoning = (corroboration_data or {}).get("reasoning", "No corroboration data")

    domain = normalize_domain(article.get("url", ""))
    prompt = _SIGNAL_PROMPT.format(
        source_name=article.get("source_name", domain),
        domain=domain,
        grade=grading_result.get("grade", "?"),
        composite_score=grading_result.get("composite_score", 0),
        header=article.get("header", ""),
        factual=factor_scores.get("factual_reliability", 0),
        authority=factor_scores.get("source_authority", 0),
        bias=factor_scores.get("bias_objectivity", 0),
        attribution=factor_scores.get("attribution_quality", 0),
        press=factor_scores.get("press_environment", 0),
        corroboration=factor_scores.get("corroboration", 0),
        penalties=", ".join(penalties) if penalties else "None",
        corroboration_reasoning=corr_reasoning,
    )

    try:
        response = _claude.invoke(prompt)
        content = response.content.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        signals = json.loads(content)
        # Validate structure
        valid_sentiments = {"positive", "negative", "neutral"}
        validated = []
        for s in signals:
            if isinstance(s, dict) and "text" in s:
                sentiment = s.get("sentiment", "neutral")
                if sentiment not in valid_sentiments:
                    sentiment = "neutral"
                validated.append({"text": s["text"], "sentiment": sentiment})
        # Enforce 3-6 signals
        if len(validated) < 3:
            validated.extend([{"text": "Assessment details limited.", "sentiment": "neutral"}] * (3 - len(validated)))
        return validated[:6]
    except Exception as e:
        logger.warning("Signal generation failed for %s: %s", domain, e)
        return [
            {"text": f"Source graded {grading_result.get('grade', '?')} ({grading_result.get('composite_score', 0)}/100).", "sentiment": "neutral"},
            {"text": "Automated signal generation unavailable for this source.", "sentiment": "neutral"},
            {"text": "Review factor scores for detailed assessment.", "sentiment": "neutral"},
        ]


def generate_signals_batch(
    articles: list[dict],
    grading_results: dict[str, dict[str, Any]],
    corroboration_data: dict[str, dict[str, Any]],
    max_workers: int = 8,
) -> dict[str, list[dict[str, str]]]:
    """
    Generate analyst signals for multiple articles in parallel.

    Args:
        articles: List of enriched article dicts.
        grading_results: Dict mapping URL to grading result.
        corroboration_data: Dict mapping URL to corroboration data.
        max_workers: Maximum parallel Claude calls.

    Returns:
        Dict mapping article URL to list of signal dicts.
    """
    results: dict[str, list[dict[str, str]]] = {}
    if not articles:
        return results

    def _gen_one(article: dict) -> tuple[str, list[dict[str, str]]]:
        url = article.get("url", "")
        gr = grading_results.get(url, {})
        cd = corroboration_data.get(url)
        signals = generate_signals(article, gr, cd)
        return url, signals

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(_gen_one, a): a for a in articles}
        for future in as_completed(futures):
            try:
                url, signals = future.result()
                results[url] = signals
            except Exception as e:
                url = futures[future].get("url", "unknown")
                logger.warning("Signal generation failed for %s: %s", url, e)
                results[url] = [
                    {"text": "Signal generation failed.", "sentiment": "neutral"},
                    {"text": "Review factor scores manually.", "sentiment": "neutral"},
                    {"text": "Contact support if issue persists.", "sentiment": "neutral"},
                ]

    return results
