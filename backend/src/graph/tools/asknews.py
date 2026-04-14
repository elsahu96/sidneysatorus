import json
import os
import re
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse, urlunparse
from langchain_core.tools import tool
from dotenv import load_dotenv
from asknews_sdk import AskNewsSDK
from typing import TypedDict

try:
    import requests as _requests

    _REQUESTS_AVAILABLE = True
except ImportError:
    _REQUESTS_AVAILABLE = False

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
ASKNEWS_API_KEY = os.getenv("ASKNEWS_API_KEY")

logger = logging.getLogger(__name__)

_client = AskNewsSDK(api_key=ASKNEWS_API_KEY)

_DEAD_STATUSES = {404, 410, 451}

# ── Gemini chunk-limit protection ────────────────────────────────────────────
# The Gemini API splits HTTP request bodies on ASCII whitespace (0x20, 0x09, 0x0A,
# 0x0D).  Any contiguous non-whitespace token longer than its internal limit causes:
#   "Separator is not found, and chunk exceed the limit"  — no whitespace in body at all
#   "Separator is found, but chunk is longer than limit"  — whitespace present but a
#                                                           segment between whitespace
#                                                           runs is still too long
#
# Two critical facts that make this hard to fix naively:
#
#   1. langchain_google_genai._convert_tool_message_to_parts calls json.loads() on the
#      ToolMessage content, then re-serialises with FunctionResponse — any indent=2
#      formatting we apply in the tool is stripped, collapsing the JSON to a single line.
#
#   2. json.dumps() encodes Python "\n" as "\\n" in the output bytes — a two-character
#      backslash-n sequence, NOT ASCII 0x0A.  Embedded newlines in string values do NOT
#      produce whitespace separators in the HTTP body.
#
# Therefore the ONLY reliable whitespace separators in the HTTP body are:
#   - The literal space after ":" and "," in JSON structure (from SDK default separators)
#   - Literal ASCII spaces within string values (0x20 survives JSON encoding as-is)
#
# Root fix applied here:
#   a) Convert all \n \r \t in string values to ASCII space BEFORE json.dumps() so
#      they remain real whitespace in the HTTP bytes.
#   b) Truncate any space-delimited token > _MAX_TOKEN_BYTES (catches base64, minified
#      JS, long tracking paths, etc.).
#   c) Sanitize URLs separately: strip query-string / fragment (which add length with
#      no spaces) and hard-cap at _MAX_URL_BYTES.

_MAX_TOKEN_BYTES = 400  # conservative ceiling for any single space-delimited token
_MAX_URL_BYTES = 200  # URL cap — query params removed first, then hard truncate
_MAX_SUMMARY_CHARS = 300  # per-article summary cap (chars, applied before sanitize)
_MAX_HEADER_CHARS = 150  # per-article title cap


def _sanitize(text: str) -> str:
    """
    Make a string value safe to pass through Gemini API:

    1. Collapse embedded \\n / \\r / \\t to a single ASCII space.
       (json.dumps turns \\n into the two-byte sequence \\\\n which is NOT whitespace
       in the HTTP body; only ASCII 0x20 survives as a real separator.)
    2. Truncate any space-delimited token whose UTF-8 byte length exceeds
       _MAX_TOKEN_BYTES (catches base64 blobs, minified JS, long hashes, etc.).
    """
    if not text:
        return text
    # Step 1: normalise non-space whitespace → space
    text = re.sub(r"[\n\r\t\x0b\x0c]+", " ", text)
    # Step 2: truncate long space-delimited tokens
    parts = text.split(" ")
    out = []
    for part in parts:
        if not part:
            continue
        if len(part.encode("utf-8")) > _MAX_TOKEN_BYTES:
            encoded = part.encode("utf-8")[:_MAX_TOKEN_BYTES]
            out.append(encoded.decode("utf-8", errors="ignore") + "…")
        else:
            out.append(part)
    return " ".join(out)


def _sanitize_url(url: str) -> str:
    """
    Strip query-string and fragment from a URL (they add length with no internal
    spaces) then hard-cap at _MAX_URL_BYTES bytes.  URLs have NO internal spaces
    so the entire URL is a single non-whitespace token in the HTTP body.
    """
    if not url:
        return url
    try:
        p = urlparse(url)
        clean = urlunparse((p.scheme, p.netloc, p.path, "", "", ""))
    except Exception:
        clean = url
    # Hard byte cap
    if len(clean.encode("utf-8")) > _MAX_URL_BYTES:
        clean = clean.encode("utf-8")[:_MAX_URL_BYTES].decode("utf-8", errors="ignore")
    return clean


# Public alias used by flow.py to sanitise the research_summary before it is
# handed to the writer agent (same rules apply there).
_sanitize_text = _sanitize


class Article(TypedDict):
    header: str
    summary: str
    url: str
    unix_timestamp: int
    language: str
    countrycode: str


# ── Side-channel for full-field article data (used by grading system) ───────
# The Gemini-safe Article TypedDict above is kept minimal to avoid chunk-limit
# errors.  The grading system needs additional AskNews fields (page_rank,
# reporting_voice, key_points, etc.) which are stored here, keyed by URL.
# This mirrors the _last_write_result pattern in writer.py.
_last_raw_articles: dict[str, dict] = {}


def _to_unix(pub_date) -> int:
    if pub_date is None:
        return 0
    if isinstance(pub_date, (int, float)):
        return int(pub_date)
    return int(pub_date.timestamp())


def _url_is_live(url: str, timeout: int = 5) -> bool:
    if not url or not _REQUESTS_AVAILABLE:
        return True
    try:
        resp = _requests.head(
            url,
            timeout=timeout,
            allow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; Sidney/1.0)"},
        )
        if resp.status_code in _DEAD_STATUSES:
            return False
        if resp.status_code == 405:
            resp = _requests.get(
                url,
                timeout=timeout,
                allow_redirects=True,
                stream=True,
                headers={"User-Agent": "Mozilla/5.0 (compatible; Sidney/1.0)"},
            )
            resp.close()
            return resp.status_code not in _DEAD_STATUSES
        return True
    except Exception:
        return False


def _filter_live_urls(articles: list, max_workers: int = 10) -> list:
    if not articles:
        return articles
    results: dict[str, bool] = {}
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        future_to_url = {
            pool.submit(_url_is_live, a.get("url", "")): a.get("url", "")
            for a in articles
            if a.get("url")
        }
        for future in as_completed(future_to_url):
            url = future_to_url[future]
            try:
                results[url] = future.result()
            except Exception:
                results[url] = True
    live = [a for a in articles if results.get(a.get("url", ""), True)]
    removed = len(articles) - len(live)
    if removed:
        logger.info(
            "URL validation: removed %d dead link(s) from %d articles.",
            removed,
            len(articles),
        )
    return live


def _run_single_search(
    query: str,
    n_articles: int = 10,
    categories: list[str] = [],
    start_timestamp: int | None = None,
    end_timestamp: int | None = None,
) -> list[Article]:
    """Execute one AskNews search and return a list of live, sanitized Article dicts."""
    fetch_count = max(n_articles + 10, 15)
    response = _client.news.search_news(
        query=query,
        n_articles=fetch_count,
        return_type="both",
    )
    raw: list[Article] = []
    for article in response.as_dicts:
        header = _sanitize(str(getattr(article, "title", "") or "")[:_MAX_HEADER_CHARS])
        summary = _sanitize(str(getattr(article, "summary", "") or "")[:_MAX_SUMMARY_CHARS])
        url = _sanitize_url(str(getattr(article, "article_url", "") or ""))
        raw.append(Article(
            header=header,
            summary=summary,
            url=url,
            unix_timestamp=_to_unix(getattr(article, "pub_date", None)),
            language=_sanitize(str(getattr(article, "language", "") or "")),
            countrycode=_sanitize(str(getattr(article, "country", "") or "")),
        ))

        # Store full-field data in side-channel for the grading system.
        # These fields are NOT passed through Gemini to avoid chunk-limit issues.
        if url:
            _last_raw_articles[url] = {
                "page_rank": getattr(article, "page_rank", None),
                "reporting_voice": str(getattr(article, "reporting_voice", "") or ""),
                "bias": str(getattr(article, "bias", "") or ""),
                "provocative": str(getattr(article, "provocative", "") or ""),
                "authors": list(getattr(article, "authors", None) or []),
                "key_points": list(getattr(article, "key_points", None) or []),
                "keywords": list(getattr(article, "keywords", None) or []),
                "classification": str(getattr(article, "classification", "") or ""),
            }

    live = _filter_live_urls([dict(a) for a in raw])
    live_urls = {a["url"] for a in live}
    return [a for a in raw if a["url"] in live_urls][:n_articles]


@tool
def search_asknews(
    query: str,
    n_articles: int = 10,
    categories: list[str] = [],
    start_timestamp: int = None,
    end_timestamp: int = None,
) -> str:
    """Search AskNews for recent news articles relevant to a query.

    Args:
        query: The search query string.
        n_articles: Number of articles to return (default 10).

    Returns:
        A JSON string containing a list of article objects with keys:
        header, summary, url, unix_timestamp, language, countrycode.
        Dead or unreachable URLs are removed before returning.
        All string values are sanitized to prevent Gemini API chunk-limit errors.
    """
    return json.dumps(
        _run_single_search(query, n_articles, categories, start_timestamp, end_timestamp),
        ensure_ascii=False,
        indent=2,
    )


@tool
def parallel_search_asknews(
    queries: list[str],
    n_articles_per_query: int = 10,
) -> str:
    """Search AskNews for multiple queries in parallel and return deduplicated results.

    Use this instead of calling search_asknews multiple times. Pass all your planned
    queries at once; they run concurrently and results are merged and deduplicated by URL.

    Args:
        queries: List of search query strings to run simultaneously (7–10 recommended).
        n_articles_per_query: Articles to fetch per query (default 10).

    Returns:
        A JSON string containing a flat, deduplicated list of article objects with keys:
        header, summary, url, unix_timestamp, language, countrycode.
        Dead or unreachable URLs are already removed. Articles are ordered by query
        priority (first occurrence of each URL wins).
    """
    if not queries:
        return json.dumps([])

    all_results: list[list[Article]] = [[] for _ in queries]
    with ThreadPoolExecutor(max_workers=min(len(queries), 8)) as executor:
        future_to_index = {
            executor.submit(_run_single_search, q, n_articles_per_query): i
            for i, q in enumerate(queries)
        }
        for future in as_completed(future_to_index):
            idx = future_to_index[future]
            try:
                all_results[idx] = future.result()
            except Exception as exc:
                logger.warning("parallel_search_asknews: query %d failed: %s", idx, exc)

    # Cross-query URL deduplication — first occurrence wins (preserves query priority order)
    seen: set[str] = set()
    merged: list[Article] = []
    for per_query in all_results:
        for article in per_query:
            url = article["url"]
            if url and url not in seen:
                seen.add(url)
                merged.append(article)

    return json.dumps(merged, ensure_ascii=False, indent=2)
