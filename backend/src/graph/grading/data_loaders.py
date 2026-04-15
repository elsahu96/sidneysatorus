"""
Data loaders for MBFC, RSF, specialist verticals, and conflict-of-interest flags.

All loaders cache on first call via module-level singletons.
"""

import json
import logging
import pathlib
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

_DATA_DIR = pathlib.Path(__file__).parent / "data"

# ── Module-level caches ─────────────────────────────────────────────────────

_mbfc_cache: dict[str, dict] | None = None
_rsf_cache: dict[str, float] | None = None
_specialist_cache: dict[str, list[str]] | None = None
_coi_cache: dict[str, str] | None = None
_media_type_fallback_cache: dict[str, str] | None = None


def _load_json(filename: str) -> dict | list:
    path = _DATA_DIR / filename
    if not path.exists():
        logger.warning("Data file not found: %s — returning empty dict", path)
        return {}
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


# ── Domain normalisation ────────────────────────────────────────────────────


def normalize_domain(url: str) -> str:
    """
    Extract and normalise domain from a URL or bare domain string.

    Strips protocol, www prefix, trailing slashes, and lowercases.
    Examples:
        "https://www.reuters.com/article/123" -> "reuters.com"
        "bbc.co.uk" -> "bbc.co.uk"
        "HTTP://WWW.CNN.COM/" -> "cnn.com"
    """
    if not url:
        return ""
    url = url.strip()
    # Add scheme if missing so urlparse works
    if "://" not in url:
        url = "https://" + url
    try:
        domain = urlparse(url).netloc.lower()
    except Exception:
        domain = url.lower()
    # Strip port
    domain = domain.split(":")[0]
    # Strip www prefix
    if domain.startswith("www."):
        domain = domain[4:]
    return domain.rstrip("/")


# ── MBFC ────────────────────────────────────────────────────────────────────


def load_mbfc() -> dict[str, dict]:
    """
    Load MBFC ratings keyed by normalised domain.

    Each value dict contains:
        factual_reporting: str  (e.g. "HIGH", "MIXED")
        credibility: str
        bias: str               (e.g. "LEFT-CENTER", "LEAST BIASED")
        media_type: str         (e.g. "Newspaper", "Website")
        country: str            (ISO-2 country code)
    """
    global _mbfc_cache
    if _mbfc_cache is None:
        raw = _load_json("mbfc.json")
        if isinstance(raw, dict):
            _mbfc_cache = raw
        else:
            _mbfc_cache = {}
        logger.info("Loaded %d MBFC entries", len(_mbfc_cache))
    return _mbfc_cache


def lookup_mbfc(url: str) -> dict | None:
    """Look up MBFC data for a URL. Returns None if not found."""
    domain = normalize_domain(url)
    mbfc = load_mbfc()
    return mbfc.get(domain)


# ── RSF Press Freedom Index ────────────────────────────────────────────────


def load_rsf() -> dict[str, float]:
    """
    Load RSF Press Freedom Index keyed by ISO-2 country code.

    Values are scores from 0 (worst) to 100 (best).
    """
    global _rsf_cache
    if _rsf_cache is None:
        raw = _load_json("rsf.json")
        if isinstance(raw, dict):
            _rsf_cache = {k.upper(): float(v) for k, v in raw.items()}
        else:
            _rsf_cache = {}
        logger.info("Loaded %d RSF country entries", len(_rsf_cache))
    return _rsf_cache


def lookup_rsf(country_code: str) -> float | None:
    """Look up RSF press freedom score for a country code. Returns None if not found."""
    if not country_code:
        return None
    return load_rsf().get(country_code.upper())


# ── Specialist verticals ───────────────────────────────────────────────────


def load_specialist() -> dict[str, list[str]]:
    """
    Load specialist vertical tags keyed by normalised domain.

    Each value is a list of vertical tags, e.g. ["finance", "markets"].
    """
    global _specialist_cache
    if _specialist_cache is None:
        raw = _load_json("specialist_verticals.json")
        if isinstance(raw, dict):
            _specialist_cache = raw
        else:
            _specialist_cache = {}
        logger.info("Loaded %d specialist vertical entries", len(_specialist_cache))
    return _specialist_cache


def lookup_specialist(url: str) -> list[str]:
    """Get specialist vertical tags for a domain. Returns empty list if not found."""
    domain = normalize_domain(url)
    return load_specialist().get(domain, [])


# ── Conflict of interest flags ─────────────────────────────────────────────


def load_coi() -> dict[str, str]:
    """
    Load conflict-of-interest flags keyed by normalised domain.

    Values are sponsor country codes (ISO-2), e.g. "RU" for RT.
    """
    global _coi_cache
    if _coi_cache is None:
        raw = _load_json("coi_flags.json")
        if isinstance(raw, dict):
            _coi_cache = raw
        else:
            _coi_cache = {}
        logger.info("Loaded %d COI flag entries", len(_coi_cache))
    return _coi_cache


def lookup_coi(url: str) -> str | None:
    """Get sponsor country code for a domain. Returns None if not flagged."""
    domain = normalize_domain(url)
    return load_coi().get(domain)


# ── Media type fallback ────────────────────────────────────────────────────


def load_media_type_fallback() -> dict[str, str]:
    """
    Load hardcoded media type fallbacks for major outlets not in MBFC.
    """
    global _media_type_fallback_cache
    if _media_type_fallback_cache is None:
        raw = _load_json("media_type_fallback.json")
        if isinstance(raw, dict):
            _media_type_fallback_cache = raw
        else:
            _media_type_fallback_cache = {}
        logger.info("Loaded %d media type fallback entries", len(_media_type_fallback_cache))
    return _media_type_fallback_cache


def lookup_media_type_fallback(url: str) -> str | None:
    """Get fallback media type for a domain. Returns None if not in fallback list."""
    domain = normalize_domain(url)
    return load_media_type_fallback().get(domain) 
