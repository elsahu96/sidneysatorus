"""
Source Grading System for Sidney.

Orchestrates the full grading pipeline: data lookups, LLM attribution
classification, cross-article corroboration, composite scoring, and
analyst signal generation.
"""

import logging
from typing import Any

logger = logging.getLogger(__name__)


def grade_articles(
    articles: list[dict],
    profile: str = "default",
) -> list[dict[str, Any]]:
    """
    Grade a list of articles and return enriched article dicts with grading data.

    This is the main entry point for the grading system. It orchestrates:
    1. LLM attribution classification (parallel, ~500ms per article)
    2. LLM cross-article corroboration (single call, ~1-2s)
    3. Six-factor composite scoring (instant)
    4. Penalties and bonuses (instant)
    5. LLM analyst signal generation (parallel, ~500ms per article)

    Args:
        articles: List of enriched article dicts. Each must have at minimum:
            - url: str
            - header: str
            - summary: str
            - countrycode: str
            Additional fields used if present: page_rank, reporting_voice,
            bias, provocative, authors, key_points, keywords, classification.
        profile: Grading weight profile name (default, sanctions, geopolitical,
            due_diligence, supply_chain, threat_intel, financial_crime).

    Returns:
        List of article dicts enriched with grading fields:
            - grade: str (A+, A, B+, B, C, D)
            - composite_score: int (0-100)
            - factor_scores: dict
            - penalties_applied: list[str]
            - analyst_signals: list[dict]
    """
    # Lazy imports to avoid loading model clients at module level
    from .attribution import classify_attributions_batch
    from .corroboration import analyze_corroboration
    from .grader import SourceGrader
    from .signals import generate_signals_batch

    if not articles:
        return []

    logger.info(
        "Grading %d articles with profile '%s'",
        len(articles),
        profile,
    )

    # Step 1: Attribution classification (parallel LLM calls)
    logger.info("Step 1/5: Classifying attribution quality...")
    attribution_scores = classify_attributions_batch(articles)

    # Step 2: Cross-article corroboration (single LLM call)
    logger.info("Step 2/5: Analysing cross-article corroboration...")
    corroboration_data = analyze_corroboration(articles)

    # Step 3-4: Composite scoring + penalties
    logger.info("Step 3/5: Computing composite scores...")
    grader = SourceGrader(profile=profile)
    grading_results: dict[str, dict[str, Any]] = {}

    for article in articles:
        url = article.get("url", "")
        attr_score = attribution_scores.get(url, 50)
        corr_data = corroboration_data.get(url, {})
        corr_score = corr_data.get("score", 30)

        result = grader.grade_article(
            article=article,
            attribution_score=attr_score,
            corroboration_score=corr_score,
            corroboration_data=corr_data,
        )
        grading_results[url] = result

    # Step 5: Analyst signal generation (parallel LLM calls)
    logger.info("Step 4/5: Generating analyst signals...")
    signals = generate_signals_batch(
        articles=articles,
        grading_results=grading_results,
        corroboration_data=corroboration_data,
    )

    # Merge grading data into article dicts
    logger.info("Step 5/5: Merging grading results...")
    graded_articles = []
    for article in articles:
        url = article.get("url", "")
        gr = grading_results.get(url, {})
        enriched = {
            **article,
            "grade": gr.get("grade", "C"),
            "composite_score": gr.get("composite_score", 0),
            "factor_scores": gr.get("factor_scores", {}),
            "penalties_applied": gr.get("penalties_applied", []),
            "analyst_signals": signals.get(url, []),
        }
        graded_articles.append(enriched)

    # Log grade distribution
    dist: dict[str, int] = {}
    for a in graded_articles:
        g = a["grade"]
        dist[g] = dist.get(g, 0) + 1
    logger.info("Grading complete. Distribution: %s", dist)

    return graded_articles
