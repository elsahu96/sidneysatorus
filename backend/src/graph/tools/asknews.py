import os
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
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

# URLs that return these status codes are considered dead/non-existent.
_DEAD_STATUSES = {404, 410, 451}


def _to_unix(pub_date) -> int:
    """Convert pub_date to a unix timestamp int, handling datetime objects and raw ints."""
    if pub_date is None:
        return 0
    if isinstance(pub_date, (int, float)):
        return int(pub_date)
    return int(pub_date.timestamp())


def _url_is_live(url: str, timeout: int = 5) -> bool:
    """Return True if the URL resolves to a live page (not 404/410/connection error)."""
    if not url or not _REQUESTS_AVAILABLE:
        return True  # can't check → keep
    try:
        resp = _requests.head(
            url,
            timeout=timeout,
            allow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; Sidney/1.0)"},
        )
        if resp.status_code in _DEAD_STATUSES:
            return False
        # Fall back to GET if HEAD returns 405 Method Not Allowed
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
        # Connection error, timeout, DNS failure → treat as dead
        return False


# Gemini's content chunker splits on whitespace. A single "word" (run of
# non-whitespace chars) longer than ~32 k bytes causes "Separator is not found".
# Common sources: base64 images, minified JS/HTML, very long URLs in article bodies.
_MAX_WORD_BYTES = 8_000   # conservative — well below the 32 k limit
_MAX_CONTENT_CHARS = 2_000  # per-article content cap


def _sanitize_text(text: str) -> str:
    """
    Remove tokens that would cause Gemini's "Separator is not found" error.

    Specifically:
    - Truncate any whitespace-delimited token longer than _MAX_WORD_BYTES.
    - Applies to article content, summaries, headers — anything passed to the model.
    """
    if not text:
        return text
    tokens = text.split(" ")
    safe = []
    for tok in tokens:
        if len(tok.encode("utf-8")) > _MAX_WORD_BYTES:
            safe.append(tok[:_MAX_WORD_BYTES] + "…")
        else:
            safe.append(tok)
    return " ".join(safe)


def _filter_live_urls(articles: list, max_workers: int = 10) -> list:
    """Remove articles whose URLs are unreachable, using parallel HEAD requests."""
    if not articles:
        return articles

    urls = [a.get("url", "") for a in articles]
    results: dict[str, bool] = {}

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        future_to_url = {pool.submit(_url_is_live, url): url for url in urls if url}
        for future in as_completed(future_to_url):
            url = future_to_url[future]
            try:
                results[url] = future.result()
            except Exception:
                results[url] = True  # keep on unexpected error

    live = [a for a in articles if results.get(a.get("url", ""), True)]
    dead_count = len(articles) - len(live)
    if dead_count:
        logger.info("URL validation: removed %d dead link(s) from %d articles.", dead_count, len(articles))
    return live


class Article(TypedDict):
    id_article: str
    id_site: str
    header: str
    summary: str
    url: str
    unix_timestamp: int
    language: str
    countrycode: str
    site_rank_global: int
    content: str


@tool
def search_asknews(
    query: str,
    n_articles: int = 20,
    categories: list[str] = [],
    start_timestamp: int = None,
    end_timestamp: int = None,
) -> list[Article]:
    """Search AskNews for recent news articles relevant to a query.

    Args:
        query: The search query string.
        n_articles: Number of articles to return (default 20). Request more to
            compensate for dead links that will be filtered out.

    Returns:
        A list of Article objects with keys: header, summary, content, url,
        unix_timestamp, language, countrycode, site_rank_global.
        Dead or unreachable URLs are removed before returning.
    """
    # Request extra articles to absorb any that fail URL validation
    fetch_count = max(n_articles + 10, 30)
    response = _client.news.search_news(
        query=query,
        n_articles=fetch_count,
        return_type="both",  # returns both string and Article objects
    )

    raw: list[Article] = []
    for article in response.as_dicts:
        raw_content = str(
            getattr(article, "article_content", "") or getattr(article, "body", "") or ""
        )
        # Cap per-article content length and strip any unsafe long tokens
        truncated_content = _sanitize_text(raw_content[:_MAX_CONTENT_CHARS])
        raw.append(
            Article(
                id_article=str(getattr(article, "article_id", "") or ""),
                id_site=str(getattr(article, "source_id", "") or ""),
                header=_sanitize_text(str(getattr(article, "title", "") or "")),
                summary=_sanitize_text(str(getattr(article, "summary", "") or "")),
                content=truncated_content,
                url=str(getattr(article, "article_url", "") or ""),
                unix_timestamp=_to_unix(getattr(article, "pub_date", None)),
                language=str(getattr(article, "language", "") or ""),
                countrycode=str(getattr(article, "country", "") or ""),
                site_rank_global=int(getattr(article, "rank_score", 0) or 0),
            )
        )

    # Filter out articles whose URLs no longer resolve
    live = _filter_live_urls([dict(a) for a in raw])
    live_urls = {a["url"] for a in live}
    results = [a for a in raw if a["url"] in live_urls]

    # Return up to the requested count
    return results[:n_articles]
