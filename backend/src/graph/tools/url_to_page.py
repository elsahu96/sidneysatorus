"""Fetch and extract text content from a URL using BeautifulSoup."""


import requests
from bs4 import BeautifulSoup

from langchain_core.tools import tool

@tool
def url_to_page(url: str) -> str:
    """
    Fetch a URL and return its main text content.

    Args:
        url: The URL to fetch (e.g. https://example.com).

    Returns:
        Extracted text content from the page.

    Raises:
        requests.RequestException: If the request fails.
        ValueError: If the response is not valid HTML or content cannot be extracted.
    """
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    response.encoding = response.encoding or "utf-8"

    soup = BeautifulSoup(response.text, "html.parser")

    # Remove script and style elements
    for element in soup(["script", "style"]):
        element.decompose()

    text = soup.get_text(separator="\n", strip=True)
    return text


if __name__ == "__main__":
    example_url = "https://www.google.com"
    print(f"Fetching content from: {example_url}\n")
    content = url_to_page(example_url)
    print(content)
    print(f"\n--- Total length: {len(content)} characters ---")
