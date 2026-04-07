import os
from langchain_core.tools import tool
from dotenv import load_dotenv
from asknews_sdk import AskNewsSDK
from typing import TypedDict

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
ASKNEWS_API_KEY = os.getenv("ASKNEWS_API_KEY")


_client = AskNewsSDK(api_key=ASKNEWS_API_KEY)


def _to_unix(pub_date) -> int:
    """Convert pub_date to a unix timestamp int, handling datetime objects and raw ints."""
    if pub_date is None:
        return 0
    if isinstance(pub_date, (int, float)):
        return int(pub_date)
    return int(pub_date.timestamp())


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
    n_articles: int = 10,
    categories: list[str] = [],
    start_timestamp: int = None,
    end_timestamp: int = None,
) -> list[Article]:
    """Search AskNews for recent news articles relevant to a query.

    Args:
        query: The search query string.
        n_articles: Number of articles to return (default 20).

    Returns:
        A list of Article objects with keys: header, summary, content, url,
        unix_timestamp, language, countrycode, site_rank_global.
    """
    response = _client.news.search_news(
        query=query,
        n_articles=n_articles,
        return_type="both",  # returns both string and Article objects
    )

    results: list[Article] = []
    for article in response.as_dicts:
        results.append(
            Article(
                id_article=str(getattr(article, "article_id", "") or ""),
                id_site=str(getattr(article, "source_id", "") or ""),
                header=str(getattr(article, "title", "") or ""),
                summary=str(getattr(article, "summary", "") or ""),
                content=str(getattr(article, "article_content", "") or getattr(article, "body", "") or ""),
                url=str(getattr(article, "article_url", "") or ""),
                unix_timestamp=_to_unix(getattr(article, "pub_date", None)),
                language=str(getattr(article, "language", "") or ""),
                countrycode=str(getattr(article, "country", "") or ""),
                site_rank_global=int(getattr(article, "rank_score", 0) or 0),
            )
        )

    return results
