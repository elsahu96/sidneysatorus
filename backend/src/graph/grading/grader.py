"""
SourceGrader: six-factor composite scoring, penalties/bonuses, and grade assignment.
"""

import logging
from typing import Any

from .config import (
    ARTICLE_BIAS_DEFAULT,
    ARTICLE_BIAS_SCORES,
    AUTHOR_BONUS,
    BIAS_DEFAULT,
    BIAS_SCORES,
    BONUS_INVESTIGATIVE_EXCLUSIVE,
    BONUS_PRIMARY_SOURCE,
    FACTUAL_REPORTING_DEFAULT,
    FACTUAL_REPORTING_SCORES,
    GRADE_THRESHOLDS,
    MEDIA_TYPE_DEFAULT,
    MEDIA_TYPE_SCORES,
    PAGE_RANK_DEFAULT,
    PAGE_RANK_TIERS,
    PENALTY_ANONYMOUS,
    PENALTY_COI,
    PENALTY_STATE_MEDIA,
    PRIMARY_SOURCE_PATTERNS,
    PROVOCATIVE_DEFAULT,
    PROVOCATIVE_SCORES,
    REPORTING_VOICE_DEFAULT,
    REPORTING_VOICE_SCORES,
    SPECIALIST_VERTICAL_BOOST,
    WEIGHT_PROFILES,
    WIRE_SERVICES,
)
from .data_loaders import (
    lookup_coi,
    lookup_mbfc,
    lookup_media_type_fallback,
    lookup_rsf,
    lookup_specialist,
    normalize_domain,
)

logger = logging.getLogger(__name__)


class SourceGrader:
    """
    Computes a reliability grade (A+ to D) for a news article using a
    weighted composite of six factors plus post-composite penalties/bonuses.
    """

    def __init__(self, profile: str = "default"):
        if profile not in WEIGHT_PROFILES:
            logger.warning("Unknown grading profile '%s', falling back to 'default'", profile)
            profile = "default"
        self.profile = profile
        self.weights = WEIGHT_PROFILES[profile]

    # ── Factor 1: Factual reliability (MBFC) ────────────────────────────────

    def _score_factual(self, article: dict) -> int:
        mbfc = lookup_mbfc(article.get("url", ""))
        if mbfc is None:
            return FACTUAL_REPORTING_DEFAULT
        rating = mbfc.get("factual_reporting", "").upper().strip()
        return FACTUAL_REPORTING_SCORES.get(rating, FACTUAL_REPORTING_DEFAULT)

    # ── Factor 2: Source authority ───────────────────────────────────────────

    def _score_authority(self, article: dict) -> int:
        # Page rank component
        page_rank = article.get("page_rank")
        if page_rank is not None:
            pr_score = PAGE_RANK_DEFAULT
            try:
                pr_val = float(page_rank)
                for threshold, score in PAGE_RANK_TIERS:
                    if pr_val >= threshold:
                        pr_score = score
                        break
            except (ValueError, TypeError):
                pass
        else:
            pr_score = PAGE_RANK_DEFAULT

        # Media type component (MBFC or fallback)
        url = article.get("url", "")
        mbfc = lookup_mbfc(url)
        if mbfc and mbfc.get("media_type"):
            media_type = mbfc["media_type"]
        else:
            media_type = lookup_media_type_fallback(url) or ""
        mt_score = MEDIA_TYPE_SCORES.get(media_type, MEDIA_TYPE_DEFAULT)

        # Average of page_rank and media_type
        base_score = (pr_score + mt_score) // 2

        # Specialist vertical boost
        domain = normalize_domain(url)
        verticals = lookup_specialist(url)
        if verticals:
            keywords = [k.lower() for k in article.get("keywords", [])]
            if any(v.lower() in keywords for v in verticals):
                base_score = min(100, base_score + SPECIALIST_VERTICAL_BOOST)

        return base_score

    # ── Factor 3: Bias and objectivity ──────────────────────────────────────

    def _score_bias(self, article: dict) -> int:
        # MBFC bias distance from centre (40%)
        mbfc = lookup_mbfc(article.get("url", ""))
        if mbfc:
            mbfc_bias = mbfc.get("bias", "").upper().strip()
            mbfc_score = BIAS_SCORES.get(mbfc_bias, BIAS_DEFAULT)
        else:
            mbfc_score = BIAS_DEFAULT

        # AskNews reporting_voice (35%)
        voice = article.get("reporting_voice", "")
        voice_score = REPORTING_VOICE_SCORES.get(voice, REPORTING_VOICE_DEFAULT)

        # AskNews article bias + provocative (25%)
        article_bias = article.get("bias", "")
        bias_score = ARTICLE_BIAS_SCORES.get(article_bias, ARTICLE_BIAS_DEFAULT)
        provocative = article.get("provocative", "")
        prov_score = PROVOCATIVE_SCORES.get(provocative, PROVOCATIVE_DEFAULT)
        article_signal = (bias_score + prov_score) // 2

        composite = int(mbfc_score * 0.40 + voice_score * 0.35 + article_signal * 0.25)
        return max(0, min(100, composite))

    # ── Factor 5: Press environment ─────────────────────────────────────────

    def _score_press_freedom(self, article: dict) -> int:
        country = article.get("countrycode", "")
        rsf_score = lookup_rsf(country)
        if rsf_score is not None:
            return max(0, min(100, int(rsf_score)))
        return 50  # default

    # ── Penalties and bonuses ───────────────────────────────────────────────

    def _apply_penalties_bonuses(
        self,
        composite: float,
        article: dict,
        corroboration_data: dict | None = None,
    ) -> tuple[float, list[str]]:
        """Apply penalties and bonuses, return (adjusted_score, list_of_applied)."""
        applied: list[str] = []
        url = article.get("url", "")
        domain = normalize_domain(url)

        # Conflict of interest: -15
        sponsor_country = lookup_coi(url)
        if sponsor_country:
            country = article.get("countrycode", "").upper()
            keywords = [k.lower() for k in article.get("keywords", [])]
            if country == sponsor_country or sponsor_country.lower() in " ".join(keywords):
                composite += PENALTY_COI
                applied.append(f"conflict_of_interest ({PENALTY_COI})")

        # State media on sponsor topic: -20
        mbfc = lookup_mbfc(url)
        if sponsor_country and mbfc:
            media_type = mbfc.get("media_type", "").lower()
            if "state" in media_type or domain in {
                "rt.com", "cgtn.com", "presstv.ir", "tass.com",
                "xinhua.net", "sputniknews.com",
            }:
                country = article.get("countrycode", "").upper()
                if country == sponsor_country:
                    composite += PENALTY_STATE_MEDIA
                    applied.append(f"state_media_on_sponsor_topic ({PENALTY_STATE_MEDIA})")

        # Primary source bonus: +10
        if any(pattern in domain for pattern in PRIMARY_SOURCE_PATTERNS):
            composite += BONUS_PRIMARY_SOURCE
            applied.append(f"primary_source_bonus (+{BONUS_PRIMARY_SOURCE})")

        # Investigative exclusive: +5
        voice = article.get("reporting_voice", "")
        if voice == "Investigative" and corroboration_data:
            corr_level = corroboration_data.get("level", "")
            if corr_level == "standalone":
                composite += BONUS_INVESTIGATIVE_EXCLUSIVE
                applied.append(f"investigative_exclusive (+{BONUS_INVESTIGATIVE_EXCLUSIVE})")

        # Anonymous / no author: -5
        authors = article.get("authors", [])
        has_author = bool(authors and any(a.strip() for a in authors if a))
        if not has_author and domain not in WIRE_SERVICES:
            composite += PENALTY_ANONYMOUS
            applied.append(f"anonymous_no_author ({PENALTY_ANONYMOUS})")

        return composite, applied

    # ── Grade mapping ───────────────────────────────────────────────────────

    @staticmethod
    def _to_letter(score: float) -> str:
        for threshold, grade in GRADE_THRESHOLDS:
            if score >= threshold:
                return grade
        return "D"

    # ── Main grading method ─────────────────────────────────────────────────

    def grade_article(
        self,
        article: dict,
        attribution_score: int,
        corroboration_score: int,
        corroboration_data: dict | None = None,
    ) -> dict[str, Any]:
        """
        Compute the full grading result for a single article.

        Args:
            article: Enriched article dict with AskNews fields.
            attribution_score: 0-100 from LLM attribution classification.
            corroboration_score: 0-100 from cross-article corroboration.
            corroboration_data: Optional dict with corroboration metadata.

        Returns:
            Dict with grade, composite_score, factor_scores, penalties_applied.
        """
        factor_scores = {
            "factual_reliability": self._score_factual(article),
            "source_authority": self._score_authority(article),
            "bias_objectivity": self._score_bias(article),
            "attribution_quality": min(100, attribution_score),
            "press_environment": self._score_press_freedom(article),
            "corroboration": min(100, corroboration_score),
        }

        composite = sum(
            factor_scores[factor] * self.weights[factor]
            for factor in factor_scores
        )

        composite, penalties_applied = self._apply_penalties_bonuses(
            composite, article, corroboration_data
        )

        composite = max(0, min(100, int(composite)))
        grade = self._to_letter(composite)

        return {
            "grade": grade,
            "composite_score": composite,
            "factor_scores": factor_scores,
            "penalties_applied": penalties_applied,
            "profile": self.profile,
        }
