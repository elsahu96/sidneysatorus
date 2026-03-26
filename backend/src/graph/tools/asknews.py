import os
import asyncio
from langchain_core.messages import HumanMessage
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain.agents import create_agent
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.tools import tool, BaseTool
from dotenv import load_dotenv
from asknews_sdk import AskNewsSDK

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
ASKNEWS_API_KEY = os.getenv("ASKNEWS_API_KEY")


_client = AskNewsSDK(api_key=ASKNEWS_API_KEY)


@tool
def search_asknews(
    query: str,
    n_articles: int = 20,
    categories: list[str] = [],
    start_timestamp: int = None,
    end_timestamp: int = None,
) -> list[dict]:
    """Search AskNews for recent news articles relevant to a query.

    Args:
        query: The search query string.
        n_articles: Number of articles to return (default 10).

    Returns:
        A list of article dicts with keys: title, summary, url, source, published_at.
    """
    response = _client.news.search_news(
        query=query,
        n_articles=n_articles,
        return_type="both",  # returns both string and Article objects
    )

    results = []
    for article in response.as_dicts:
        results.append(
            {
                "title": article.title,
                "language": article.language,
                "url": article.article_url,
                "countrycode": article.country,
            }
        )

    return results
