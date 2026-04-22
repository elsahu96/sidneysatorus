"""
Source Grading System for Sidney.

Orchestrates the full grading pipeline: data lookups, LLM attribution
classification, cross-article corroboration, composite scoring, and
analyst signal generation.
"""

import logging
from typing import Any

logger = logging.getLogger(__name__)


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def _to_letter_from_0_1(score_0_1: float) -> str:
    # Reuse the same thresholds as the legacy composite grade mapping.
    from .config import GRADE_THRESHOLDS

    score_100 = int(round(_clamp01(score_0_1) * 100))
    for threshold, grade in GRADE_THRESHOLDS:
        if score_100 >= threshold:
            return grade
    return "D"


def _timeliness_decay_factor(unix_timestamp: int | None, half_life_hours: int) -> tuple[float, float | None]:
    """
    Compute an exponential decay factor with a half-life (in hours).
    Returns (decay_factor, age_hours|None).
    """
    if not unix_timestamp or unix_timestamp <= 0:
        return 1.0, None
    try:
        import time

        now = int(time.time())
        age_seconds = max(0, now - int(unix_timestamp))
        age_hours = age_seconds / 3600.0
        if half_life_hours <= 0:
            return 1.0, age_hours
        decay = 0.5 ** (age_hours / float(half_life_hours))
        return float(decay), age_hours
    except Exception:
        return 1.0, None


def _detect_high_impact_single_source_flag(article: dict, corr_level: str) -> bool:
    """
    Phase-1 approximation for the PDF override:
    Single-source claim about battle outcomes / casualties / territorial control → flag.

    Without full article text/claim graph, we use keyword heuristics on header/summary/key_points.
    """
    if corr_level != "standalone":
        return False
    text = " ".join(
        [
            str(article.get("header", "") or ""),
            str(article.get("summary", "") or ""),
            " ".join(article.get("key_points", []) or []),
        ]
    ).lower()

    # Casualties / losses
    casualty_terms = (
        "killed",
        "dead",
        "deaths",
        "casualt",
        "wounded",
        "injur",
        "fatalit",
        "missing",
    )
    # Territory / battle outcomes
    territory_terms = (
        "captured",
        "seized",
        "took control",
        "retook",
        "liberat",
        "occupied",
        "advance",
        "withdraw",
        "front line",
        "territor",
    )
    # Battle result framing
    outcome_terms = (
        "defeated",
        "repelled",
        "destroyed",
        "shot down",
        "sank",
        "downed",
    )

    return any(t in text for t in casualty_terms + territory_terms + outcome_terms)


def _compute_pdf_layer_model(
    *,
    article: dict,
    factor_scores: dict[str, int],
    attribution_score: int,
    corroboration_data: dict[str, Any] | None,
    profile: str,
    penalties_applied: list[str],
) -> dict[str, Any]:
    """
    Phase-1 PDF-aligned layer model output.

    We compute layer_scores where we have signals today, keep placeholders for the
    layers that require URL enrichment / claim graphs, and compute an overall_score
    using the PDF's archetype weights (renormalized over assessed layers).

    Timeliness is applied as a decay multiplier (PDF: crisis half-life 72h).
    """
    from .config import PDF_LAYER_WEIGHTS, PDF_TIMELINESS_HALF_LIFE_HOURS
    from .data_loaders import lookup_mbfc, normalize_domain

    weights = PDF_LAYER_WEIGHTS.get(profile) or {}
    half_life = PDF_TIMELINESS_HALF_LIFE_HOURS.get(profile, 0)

    corr_level = (corroboration_data or {}).get("level", "standalone")
    confirming_sources = int((corroboration_data or {}).get("confirming_sources", 0) or 0)

    # Layer scores are 0-1 (None means not assessed in Phase 1).
    L2 = _clamp01(float(factor_scores.get("factual_reliability", 50)) / 100.0)
    L1 = _clamp01(float(factor_scores.get("source_authority", 50)) / 100.0)
    L9 = _clamp01(float(factor_scores.get("bias_objectivity", 50)) / 100.0)
    L6 = _clamp01(float(attribution_score) / 100.0)
    L3 = _clamp01(float(factor_scores.get("press_environment", 50)) / 100.0)
    L8 = _clamp01(float(factor_scores.get("corroboration", 30)) / 100.0)

    decay_factor, age_hours = _timeliness_decay_factor(article.get("unix_timestamp"), half_life)
    L7 = _clamp01(decay_factor)

    layer_scores: dict[str, Any] = {
        "L1": {"score": L1, "status": "assessed", "reason": "Authority/media-type proxy (AskNews page_rank + MBFC media_type)."},
        "L2": {"score": L2, "status": "assessed", "reason": "External credibility proxy (MBFC factual reporting)."},
        "L3": {"score": L3, "status": "assessed", "reason": "Press environment (RSF press freedom by countrycode)."},
        "L4": {"score": None, "status": "not_assessed", "reason": "Requires robust byline + author track record extraction (Phase 2+)."},
        "L5": {"score": None, "status": "not_assessed", "reason": "Requires content/claim-level factual assessment (Phase 2+)."},
        "L6": {"score": L6, "status": "assessed", "reason": "Attribution quality (LLM classification over AskNews key_points)."},
        "L7": {
            "score": L7,
            "status": "assessed",
            "reason": f"Timeliness decay factor (half-life {half_life}h).",
            "age_hours": age_hours,
        },
        "L8": {
            "score": L8,
            "status": "assessed",
            "reason": "Cross-source corroboration (LLM analysis across returned corpus).",
            "level": corr_level,
            "confirming_sources": confirming_sources,
        },
        "L9": {"score": L9, "status": "assessed", "reason": "Bias/framing proxy (MBFC bias + AskNews voice/bias/provocative)."},
        "L10": {"score": None, "status": "not_assessed", "reason": "Requires specialist-source provenance rules (Phase 3+)."},
        "L11": {"score": None, "status": "not_assessed", "reason": "Requires geo proximity modelling (publisher vs event location) (Phase 3+)."},
    }

    # Weighted overall score: renormalize over layers with numeric scores.
    weighted_sum = 0.0
    weights_sum = 0.0
    for layer, w in weights.items():
        entry = layer_scores.get(layer, {})
        s = entry.get("score", None)
        if isinstance(s, (int, float)):
            weighted_sum += (float(w) / 100.0) * float(s)
            weights_sum += float(w) / 100.0
    base_overall = (weighted_sum / weights_sum) if weights_sum > 0 else 0.5

    flags: list[str] = []

    # PDF override (Phase 1 approximation): single-source high-impact claim → flag
    if _detect_high_impact_single_source_flag(article, corr_level):
        flags.append("single_source_high_impact_claim_flag")

    # PDF override (approx): 3+ corroborating sources → reliability floor 0.75
    if corr_level == "strong" and confirming_sources >= 3:
        base_overall = max(base_overall, 0.75)
        flags.append("corroboration_floor_applied_0_75")

    # PDF override (approx): state-controlled media on involved-party topic → cap 0.35
    # We reuse the existing penalty condition as a proxy.
    if any("state_media_on_sponsor_topic" in p for p in penalties_applied):
        base_overall = min(base_overall, 0.35)
        flags.append("state_media_involved_party_cap_0_35")

    # Apply timeliness decay as a multiplier (PDF note: separate from weights)
    overall = _clamp01(base_overall * decay_factor)

    # Basic perspective tags (Phase 1): expose bias fields rather than treating as only penalty.
    mbfc = lookup_mbfc(article.get("url", ""))
    perspective_tags = {
        "mbfc_bias": (mbfc or {}).get("bias"),
        "asknews_bias": article.get("bias") or None,
        "reporting_voice": article.get("reporting_voice") or None,
        "provocative": article.get("provocative") or None,
    }

    domain = normalize_domain(article.get("url", ""))
    explanation = {
        "source": domain,
        "profile": profile,
        "base_overall": round(base_overall, 3),
        "timeliness_decay": round(float(decay_factor), 3),
        "overall_score": round(float(overall), 3),
        "assessed_layers": [k for k, v in layer_scores.items() if isinstance(v.get("score"), (int, float))],
        "notes": "Phase 1 layer model uses metadata + caches; some layers are placeholders until URL enrichment/claim-graph work.",
    }

    return {
        "layer_scores": layer_scores,
        "overall_score": float(overall),
        "letter_grade": _to_letter_from_0_1(overall),
        "flags": flags,
        "perspective_tags": perspective_tags,
        "explanation": explanation,
    }


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
        factor_scores = gr.get("factor_scores", {})
        penalties_applied = gr.get("penalties_applied", [])
        corr_data = corroboration_data.get(url, {})
        attr_score = attribution_scores.get(url, 50)

        layer_model = _compute_pdf_layer_model(
            article=article,
            factor_scores=factor_scores,
            attribution_score=attr_score,
            corroboration_data=corr_data,
            profile=profile,
            penalties_applied=penalties_applied,
        )
        enriched = {
            **article,
            "grade": gr.get("grade", "C"),
            "composite_score": gr.get("composite_score", 0),
            "factor_scores": factor_scores,
            "penalties_applied": penalties_applied,
            "analyst_signals": signals.get(url, []),
            # Phase 1 PDF-aligned layer model
            **layer_model,
        }
        graded_articles.append(enriched)

    # Log grade distribution
    dist: dict[str, int] = {}
    for a in graded_articles:
        g = a["grade"]
        dist[g] = dist.get(g, 0) + 1
    logger.info("Grading complete. Distribution: %s", dist)

    return graded_articles
