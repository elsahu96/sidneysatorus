"""
Search the Opoint API for articles matching a search term.
"""

from typing import TypedDict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
import requests
from bs4 import BeautifulSoup

from langchain_core.tools import tool

_OPOINT_API_URL = "https://api.opoint.com/search/"
_OPOINT_TOKEN = "3019bf82475212e483d0016d90230cac09451612"

_REQUEST_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)",
}


class Article(TypedDict):
    id_article: int
    id_site: int
    header: str
    summary: str
    url: str
    unix_timestamp: int
    language: str
    countrycode: str
    site_rank_global: int
    content: str


@tool
def search_opoint(queries: list[str], days_back: int = 90) -> list[Article]:
    """
    Search the Opoint API for each query and return a list of Article objects.

    Args:
        queries:   List of search term strings.
        days_back: Only return articles published within this many days.
                   Defaults to 90. Use a smaller value (e.g. 7 or 30) for
                   breaking news; use 0 to disable the time filter.

    Returns:
        List of Article objects with content fetched from each article's URL.
    """
    oldest_ts = (
        int((datetime.now() - timedelta(days=days_back)).timestamp())
        if days_back > 0
        else None
    )
    return _run_search_opoint(queries, oldest_ts=oldest_ts)


def _fetch_article_content(
    article_url: str, session: requests.Session | None = None
) -> str:
    """Fetch and extract clean text from an article URL using BeautifulSoup."""
    getter = session or requests
    response = getter.get(article_url, timeout=15, headers=_REQUEST_HEADERS)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    return soup.get_text(separator="\n", strip=True)


def _build_article(doc: dict, session: requests.Session) -> Article:
    summary_text = (doc.get("summary") or {}).get("text", "") or ""
    article_url = doc.get("orig_url") or ""
    try:
        content = _fetch_article_content(article_url, session) if article_url else ""
    except Exception:
        content = summary_text
    return Article(
        id_article=doc["id_article"],
        id_site=doc["id_site"],
        header=(doc.get("header") or {}).get("text", "") or "",
        summary=summary_text,
        url=article_url,
        unix_timestamp=doc.get("unix_timestamp", 0),
        language=(doc.get("language") or {}).get("text", "") or "",
        countrycode=doc.get("countrycode", "") or "",
        site_rank_global=(doc.get("site_rank") or {}).get("rank_global") or 0,
        content=content,
    )


def _fetch_query_documents(
    search_term: str, session: requests.Session, oldest_ts: int | None = None
) -> list[dict]:
    """POST one query to the Opoint API and return valid documents."""
    params: dict = {
        "requestedarticles": 20,
        "main": {"header": 1, "summary": 1, "text": 1},
    }
    if oldest_ts is not None:
        params["oldest"] = oldest_ts

    data = {"searchterm": search_term, "params": params}
    try:
        response = session.post(_OPOINT_API_URL, json=data, timeout=30)
        if response.status_code != 200:
            print(f"Opoint API returned {response.status_code} for '{search_term}'")
            return []
        documents = response.json().get("searchresult", {}).get("document", [])
        if not isinstance(documents, list):
            return []
        return [
            d
            for d in documents
            if d.get("id_site") is not None and d.get("id_article") is not None
        ]
    except Exception as e:
        print(f"Opoint search error for '{search_term}': {e}")
        return []


def _run_search_opoint(
    queries: list[str], oldest_ts: int | None = None
) -> list[Article]:
    """Call the Opoint API for each query and return Article objects with full content."""
    cutoff = (
        datetime.fromtimestamp(oldest_ts).strftime("%Y-%m-%d") if oldest_ts else "all time"
    )
    print(f"[opoint] Searching {len(queries)} query/queries | cutoff: {cutoff}")
    session = requests.Session()
    session.headers.update(
        {
            "Authorization": f"Token {_OPOINT_TOKEN}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
    )

    # Stage 1: fetch all queries in parallel
    all_docs: list[dict] = []
    with ThreadPoolExecutor(max_workers=len(queries)) as executor:
        query_futures = [
            executor.submit(_fetch_query_documents, q, session, oldest_ts) for q in queries
        ]
        for future in as_completed(query_futures):
            all_docs.extend(future.result())

    print(f"[opoint] Retrieved {len(all_docs)} raw documents across all queries.")

    # Stage 2: fetch all article content in parallel across all docs at once
    articles: list[Article] = []
    with ThreadPoolExecutor(max_workers=20) as executor:
        content_futures = [
            executor.submit(_build_article, doc, session) for doc in all_docs
        ]
        for future in as_completed(content_futures):
            try:
                articles.append(future.result())
            except Exception as e:
                print(f"Article fetch error: {e}")

    print(f"[opoint] Returning {len(articles)} articles with content.")
    return articles


if __name__ == "__main__":
    """Which Iranian provinces are experiencing the most unrest?

    What targets were hit during the first wave of U.S / Israel attacks on Iran?

    What intelligence justified the pre-emptive strikes on Iran?

    How many Iranian officials were killed in the opening phase of Operation Epic Fury?
    """

    result_articles = _run_search_opoint(["Iran oil sanctions 2026"])
    print(f"Found {len(result_articles)} articles.\n")
    for a in result_articles[:3]:
        print(f"[{a['id_article']}] {a['header']}")
        print(f"  URL     : {a['url']}")
        print(
            f"  Country : {a['countrycode']} | Lang: {a['language']} | Rank: {a['site_rank_global']}"
        )
        print(f"  Summary : {a['summary'].strip()[:120]}")
        print(f"  Content : {len(a['content'])} chars — {a['content'][:150]!r}")
        print()
