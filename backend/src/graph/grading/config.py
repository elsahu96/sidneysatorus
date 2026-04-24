"""
Source grading constants: weight profiles, scoring maps, grade thresholds, penalties.
"""

import os

# ── Weight profiles ─────────────────────────────────────────────────────────
# Each profile maps six factor keys to floats summing to 1.0.

WEIGHT_PROFILES: dict[str, dict[str, float]] = {
    "default": {
        "factual_reliability": 0.25,
        "source_authority": 0.20,
        "bias_objectivity": 0.15,
        "attribution_quality": 0.15,
        "press_environment": 0.10,
        "corroboration": 0.15,
    },
    "sanctions": {
        "factual_reliability": 0.20,
        "source_authority": 0.15,
        "bias_objectivity": 0.05,
        "attribution_quality": 0.30,
        "press_environment": 0.05,
        "corroboration": 0.25,
    },
    "geopolitical": {
        "factual_reliability": 0.15,
        "source_authority": 0.15,
        "bias_objectivity": 0.25,
        "attribution_quality": 0.10,
        "press_environment": 0.15,
        "corroboration": 0.20,
    },
    "due_diligence": {
        "factual_reliability": 0.25,
        "source_authority": 0.10,
        "bias_objectivity": 0.15,
        "attribution_quality": 0.25,
        "press_environment": 0.05,
        "corroboration": 0.20,
    },
    "supply_chain": {
        "factual_reliability": 0.20,
        "source_authority": 0.20,
        "bias_objectivity": 0.05,
        "attribution_quality": 0.20,
        "press_environment": 0.10,
        "corroboration": 0.25,
    },
    "threat_intel": {
        "factual_reliability": 0.15,
        "source_authority": 0.15,
        "bias_objectivity": 0.20,
        "attribution_quality": 0.10,
        "press_environment": 0.20,
        "corroboration": 0.20,
    },
    "financial_crime": {
        "factual_reliability": 0.25,
        "source_authority": 0.15,
        "bias_objectivity": 0.05,
        "attribution_quality": 0.30,
        "press_environment": 0.05,
        "corroboration": 0.20,
    },
}

# ── Investigation type → profile mapping ────────────────────────────────────

INVESTIGATION_PROFILE_MAP: dict[str, str] = {
    "PERSON_INVESTIGATION": "due_diligence",
    "COMPANY_INVESTIGATION": "due_diligence",
    "GEOPOLITICAL_ANALYSIS": "geopolitical",
    "NETWORK_MAPPING": "default",
}

# ── MBFC factual reporting → score ──────────────────────────────────────────

FACTUAL_REPORTING_SCORES: dict[str, int] = {
    "VERY HIGH": 100,
    "HIGH": 85,
    "MOSTLY FACTUAL": 65,
    "MIXED": 40,
    "LOW": 20,
    "VERY LOW": 5,
}

FACTUAL_REPORTING_DEFAULT = 50

# ── Reporting voice → score ─────────────────────────────────────────────────

REPORTING_VOICE_SCORES: dict[str, int] = {
    "Investigative": 100,
    "Objective": 90,
    "Analytical": 75,
    "Opinion": 50,
    "Persuasive": 30,
    "Sensational": 15,
}

REPORTING_VOICE_DEFAULT = 50

# ── MBFC bias → distance-from-centre score ──────────────────────────────────
# Higher = less biased = better.

BIAS_SCORES: dict[str, int] = {
    "LEAST BIASED": 100,
    "CENTER": 100,
    "LEFT-CENTER": 75,
    "RIGHT-CENTER": 75,
    "LEFT": 40,
    "RIGHT": 40,
    "FAR LEFT": 15,
    "FAR RIGHT": 15,
    "EXTREME LEFT": 10,
    "EXTREME RIGHT": 10,
    "VERY LOW": 10,  # mapped from fake-news/conspiracy categories
}

BIAS_DEFAULT = 50

# ── AskNews article-level bias → score ──────────────────────────────────────

ARTICLE_BIAS_SCORES: dict[str, int] = {
    "Center": 100,
    "Left-Center": 75,
    "Right-Center": 75,
    "Left": 40,
    "Right": 40,
    "Far Left": 15,
    "Far Right": 15,
}

ARTICLE_BIAS_DEFAULT = 50

# ── Provocative → penalty factor (inverted: high provocative = low score) ──

PROVOCATIVE_SCORES: dict[str, int] = {
    "Low": 100,
    "Medium": 60,
    "High": 20,
    "Very High": 5,
}

PROVOCATIVE_DEFAULT = 60

# ── AskNews page_rank → tier score ──────────────────────────────────────────

PAGE_RANK_TIERS: list[tuple[float, int]] = [
    # (min_page_rank, score) — thresholds checked from highest to lowest
    (80, 100),  # Tier 1: global leaders
    (60, 80),  # Tier 2: major national outlets
    (40, 60),  # Tier 3: established regional
    (20, 40),  # Tier 4: smaller outlets
    (0, 20),  # Tier 5: minimal reach
]

PAGE_RANK_DEFAULT = 40

# ── MBFC media type → score ─────────────────────────────────────────────────

MEDIA_TYPE_SCORES: dict[str, int] = {
    "Newspaper": 90,
    "TV Station": 85,
    "News Agency": 95,
    "Magazine": 75,
    "Website": 50,
    "Blog": 30,
    "Government": 80,
    "Think Tank": 70,
    "Research": 85,
    "Satire": 10,
}

MEDIA_TYPE_DEFAULT = 50

# ── Attribution type → score (Claude classification) ────────────────────────

ATTRIBUTION_SCORES: dict[str, int] = {
    "named_official_source": 100,
    "named_unofficial_source": 85,
    "document_or_data_citation": 80,
    "institutional_attribution": 75,
    "unnamed_official_source": 55,
    "no_attribution": 20,
}

AUTHOR_BONUS = 10

# ── Corroboration levels ────────────────────────────────────────────────────

CORROBORATION_SCORES: dict[str, int] = {
    "strong": 100,  # 3+ independent sources
    "moderate": 75,  # 2 independent sources
    "partial": 50,  # partial overlap
    "standalone": 30,  # no corroboration
    "contradicted": 10,  # actively contradicted
}

# ── Penalties and bonuses ───────────────────────────────────────────────────

PENALTY_COI = -15  # Source in COI list AND topic involves sponsor country
PENALTY_STATE_MEDIA = -20  # State-funded AND reporting on own government
BONUS_PRIMARY_SOURCE = 10  # .gov, court filing, or regulatory body
BONUS_INVESTIGATIVE_EXCLUSIVE = 5  # Sole reporter + Investigative voice
PENALTY_ANONYMOUS = -5  # No author AND not a wire service

WIRE_SERVICES = frozenset(
    {
        "reuters.com",
        "apnews.com",
        "afp.com",
        "upi.com",
        "xinhua.net",
        "tass.com",
        "efe.com",
        "ansa.it",
        "kyodonews.net",
        "pap.pl",
        "bta.bg",
    }
)

PRIMARY_SOURCE_PATTERNS = frozenset(
    {
        ".gov",
        ".gov.",
        ".mil",
        ".judiciary.",
        "courts.",
        "sec.gov",
        "ofac.treasury.gov",
        "fca.org.uk",
        "europa.eu",
        "un.org",
        "who.int",
        "imf.org",
        "worldbank.org",
        "icj-cij.org",
    }
)

# ── Grade thresholds ────────────────────────────────────────────────────────
# Checked from highest to lowest; first match wins.

GRADE_THRESHOLDS: list[tuple[int, str]] = [
    (90, "A+"),
    (80, "A"),
    (70, "B+"),
    (60, "B"),
    (45, "C"),
    (0, "D"),
]

# ── Specialist vertical boost ──────────────────────────────────────────────

SPECIALIST_VERTICAL_BOOST = 15

# ── LLM model for grading calls ─────────────────────────────────────────────

GRADING_LLM_MODEL = os.environ.get(
    "GEMINI_3_1_PRO_PREVIEW", "google_genai:gemini-3-flash-preview"
)
