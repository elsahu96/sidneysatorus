#!/usr/bin/env python3
"""
Download the MBFC dataset from the open-source browser extension repo
and build a normalised JSON cache for the grading system.

Source: https://github.com/drmikecrowe/mbfcext (MIT licensed)

Usage:
    python scripts/build_mbfc_cache.py

Output:
    backend/src/graph/grading/data/mbfc.json
"""

import json
import pathlib
import sys
import urllib.request
from urllib.parse import urlparse

_MBFC_URL = (
    "https://raw.githubusercontent.com/drmikecrowe/mbfcext/main/docs/v5/data/combined.json"
)
_OUTPUT = pathlib.Path(__file__).resolve().parents[1] / "src" / "graph" / "grading" / "data" / "mbfc.json"


def normalize_domain(url: str) -> str:
    if not url:
        return ""
    url = url.strip()
    if "://" not in url:
        url = "https://" + url
    try:
        domain = urlparse(url).netloc.lower()
    except Exception:
        domain = url.lower()
    domain = domain.split(":")[0]
    if domain.startswith("www."):
        domain = domain[4:]
    return domain.rstrip("/")


def _normalise_reporting(value: str) -> str:
    """Map MBFC reporting labels to standardised form."""
    mapping = {
        "very-high": "VERY HIGH",
        "high": "HIGH",
        "mostly-factual": "MOSTLY FACTUAL",
        "mixed": "MIXED",
        "low": "LOW",
        "very-low": "VERY LOW",
    }
    return mapping.get(value.lower().strip(), value.upper())


def _normalise_bias(value: str) -> str:
    """Map MBFC bias labels to standardised form."""
    mapping = {
        "left-center": "LEFT-CENTER",
        "right-center": "RIGHT-CENTER",
        "left": "LEFT",
        "right": "RIGHT",
        "least-biased": "LEAST BIASED",
        "far-left": "FAR LEFT",
        "far-right": "FAR RIGHT",
        "fake-news": "VERY LOW",
        "conspiracy-pseudoscience": "VERY LOW",
        "pro-science": "LEAST BIASED",
        "satire": "LEAST BIASED",
    }
    return mapping.get(value.lower().strip(), value.upper())


def _normalise_credibility(value: str) -> str:
    """Map MBFC credibility labels to standardised form."""
    mapping = {
        "high-credibility": "HIGH",
        "medium-credibility": "MEDIUM",
        "low-credibility": "LOW",
    }
    return mapping.get(value.lower().strip(), value.upper())


def build_cache() -> dict[str, dict]:
    """
    Download and parse MBFC combined.json (v5 format from drmikecrowe/mbfcext).

    The v5 format has: {sources: [{domain, bias, reporting, credibility, traffic, ...}]}
    Also includes an aliases dict mapping alternate domains to canonical domains.
    """
    print(f"Downloading MBFC data from {_MBFC_URL} ...")
    with urllib.request.urlopen(_MBFC_URL, timeout=30) as resp:
        raw = json.loads(resp.read().decode("utf-8"))

    cache: dict[str, dict] = {}
    sources = raw.get("sources", [])
    aliases = raw.get("aliases", {})

    for entry in sources:
        if not isinstance(entry, dict):
            continue
        domain = entry.get("domain", "").lower().strip()
        if not domain:
            continue

        record = {
            "factual_reporting": _normalise_reporting(entry.get("reporting") or ""),
            "credibility": _normalise_credibility(entry.get("credibility") or ""),
            "bias": _normalise_bias(entry.get("bias") or ""),
            "media_type": "",
            "country": "",
        }
        cache[domain] = record

    # Add aliases: alias -> canonical domain's data
    for alias, canonical in aliases.items():
        canonical = canonical.lower().strip()
        alias = alias.lower().strip()
        if canonical in cache and alias not in cache:
            cache[alias] = cache[canonical]

    return cache


def main():
    cache = build_cache()
    _OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with _OUTPUT.open("w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2, sort_keys=True)
    print(f"Wrote {len(cache)} entries to {_OUTPUT}")


if __name__ == "__main__":
    main()
