"""
Tests for research_subagent configuration and the search_asknews tool.
"""
from unittest.mock import MagicMock, patch


# ── 1. Subagent configuration ─────────────────────────────────────────────────

def test_research_subagent_imports():
    """research_subagent can be imported without error."""
    from src.graph.agents import research_subagent
    assert research_subagent is not None


def test_research_subagent_name():
    from src.graph.agents import research_subagent
    assert research_subagent["name"] == "research-agent"


def test_research_subagent_has_exactly_one_tool():
    from src.graph.agents import research_subagent
    assert len(research_subagent["tools"]) == 1


def test_research_subagent_tool_is_search_asknews():
    from src.graph.agents import research_subagent
    tool = research_subagent["tools"][0]
    assert tool.name == "search_asknews"


def test_research_agent_prompt_references_correct_tool():
    from src.graph.prompts.prompts import RESEARCH_AGENT_PROMPT
    assert "search_asknews" in RESEARCH_AGENT_PROMPT
    assert "search_opoint" not in RESEARCH_AGENT_PROMPT


def test_research_subagent_model_set():
    from src.graph.agents import research_subagent
    assert research_subagent["model"], "model must not be empty"


# ── 2. search_asknews tool (unit, mocked SDK) ─────────────────────────────────

MOCK_ARTICLE = MagicMock()
MOCK_ARTICLE.article_id = 42
MOCK_ARTICLE.source_id = 7
MOCK_ARTICLE.title = "Test Article"
MOCK_ARTICLE.summary = "A summary."
MOCK_ARTICLE.article_content = "Full article body."
MOCK_ARTICLE.article_url = "https://example.com/article/1"
MOCK_ARTICLE.pub_date = 1700000000
MOCK_ARTICLE.language = "en"
MOCK_ARTICLE.country = "US"
MOCK_ARTICLE.rank_score = 500

MOCK_RESPONSE = MagicMock()
MOCK_RESPONSE.as_dicts = [MOCK_ARTICLE]


@patch("src.graph.tools.asknews._client")
def test_search_asknews_returns_articles(mock_client):
    mock_client.news.search_news.return_value = MOCK_RESPONSE

    from src.graph.tools.asknews import search_asknews

    results = search_asknews.invoke({"query": "test query", "n_articles": 5})

    assert isinstance(results, list)
    assert len(results) == 1
    article = results[0]
    assert article["header"] == "Test Article"
    assert article["summary"] == "A summary."
    assert article["content"] == "Full article body."
    assert article["url"] == "https://example.com/article/1"
    assert article["language"] == "en"
    assert article["countrycode"] == "US"
    assert article["unix_timestamp"] == 1700000000


@patch("src.graph.tools.asknews._client")
def test_search_asknews_empty_results(mock_client):
    empty_response = MagicMock()
    empty_response.as_dicts = []
    mock_client.news.search_news.return_value = empty_response

    from src.graph.tools.asknews import search_asknews

    results = search_asknews.invoke({"query": "noresults query"})
    assert results == []


@patch("src.graph.tools.asknews._client")
def test_search_asknews_passes_n_articles(mock_client):
    mock_client.news.search_news.return_value = MOCK_RESPONSE

    from src.graph.tools.asknews import search_asknews

    search_asknews.invoke({"query": "test", "n_articles": 15})

    mock_client.news.search_news.assert_called_once()
    call_kwargs = mock_client.news.search_news.call_args
    assert call_kwargs.kwargs.get("n_articles") == 15 or call_kwargs.args[1] == 15
