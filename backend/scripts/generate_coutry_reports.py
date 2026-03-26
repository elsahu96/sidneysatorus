"""
Web Archiver & Scraper (Multithreaded)
"""

import json
import time
import re
import os
import random
import threading
import requests
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

# Rotate user agents to reduce chance of being blocked
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
]

# ─────────────────────────────────────────────
#  CONFIG
# ─────────────────────────────────────────────
MAX_WORKERS = 3  # ↓ reduced from 5 — fewer concurrent hits to archive.ph
REQUESTS_PER_SECOND = 0.4  # 1 request every ~2.5s across ALL threads
GEMINI_MODEL = "gemini-3-flash-preview"
MAX_RETRIES = 5  # ↑ increased from 3
RETRY_DELAY = 2  # base seconds, multiplied per attempt

BLOCKED_DOMAINS = {
    "archive",
    "instagram",
    "facebook",
    "twitter",
    "tiktok",
    "x.com",
    "youtu.be",
    "youtube",
}

# ─────────────────────────────────────────────
#  Thread-safe print
# ─────────────────────────────────────────────
_lock = Lock()


def tprint(*args, **kwargs):
    with _lock:
        print(*args, **kwargs)


# ─────────────────────────────────────────────
#  NEW: Global Rate Limiter
#  Shared across all threads — enforces a maximum
#  request rate regardless of how many threads are running.
# ─────────────────────────────────────────────
class RateLimiter:
    def __init__(self, calls_per_second: float):
        self.interval = 1.0 / calls_per_second
        self._lock = threading.Lock()
        self._last_call = 0.0

    def wait(self):
        with self._lock:
            now = time.monotonic()
            wait = self.interval - (now - self._last_call)
            if wait > 0:
                time.sleep(wait)
            self._last_call = time.monotonic()


# ─────────────────────────────────────────────
#  NEW: Global Backoff Event
#  When ANY thread hits a 429, ALL threads pause
#  until the backoff window expires.
# ─────────────────────────────────────────────
class GlobalBackoff:
    def __init__(self):
        self._lock = threading.Lock()
        self._backoff_until = 0.0

    def trigger(self, wait_seconds: float):
        with self._lock:
            self._backoff_until = time.monotonic() + wait_seconds
        tprint(
            f"  [429] Global backoff triggered — all threads pausing {wait_seconds:.1f}s"
        )

    def wait_if_needed(self):
        while True:
            with self._lock:
                remaining = self._backoff_until - time.monotonic()
            if remaining <= 0:
                break
            time.sleep(min(remaining, 0.5))  # re-check every 0.5s


# One shared instance for all threads
_rate_limiter = RateLimiter(calls_per_second=REQUESTS_PER_SECOND)
_global_backoff = GlobalBackoff()


# ─────────────────────────────────────────────
#  Shared Gemini client (thread-safe, one instance)
# ─────────────────────────────────────────────
_client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
_config = types.GenerateContentConfig(
    tools=[{"url_context": {}}],
    response_mime_type="application/json",
)


# ─────────────────────────────────────────────
#  Data model
# ─────────────────────────────────────────────
@dataclass
class SitemapEntry:
    url: str
    last_modified: datetime
    change_freq: str
    priority: float
    section: str
    date: str
    slug: str


# ─────────────────────────────────────────────
#  Sitemap parser
# ─────────────────────────────────────────────
def parse_bloomberg_sitemap(xml_url: str) -> list[SitemapEntry]:
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36",
        "Referer": "https://www.bloomberg.com/",
    }
    response = requests.get(xml_url, headers=headers, timeout=20)
    response.raise_for_status()

    namespace = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    root = ET.fromstring(response.content)
    entries = []

    for url_el in root.findall("sm:url", namespace):
        loc = url_el.findtext("sm:loc", default="", namespaces=namespace)
        lastmod = url_el.findtext("sm:lastmod", default="", namespaces=namespace)
        changefreq = url_el.findtext("sm:changefreq", default="", namespaces=namespace)
        priority = url_el.findtext("sm:priority", default="0", namespaces=namespace)

        try:
            last_modified = datetime.fromisoformat(lastmod.replace("Z", "+00:00"))
        except ValueError:
            last_modified = datetime.now()

        parts = urlparse(loc).path.strip("/").split("/")
        section = parts[1] if len(parts) > 1 else "unknown"
        date = parts[2] if len(parts) > 2 else ""
        slug = parts[3] if len(parts) > 3 else ""

        entries.append(
            SitemapEntry(
                url=loc,
                last_modified=last_modified,
                change_freq=changefreq,
                priority=float(priority),
                section=section,
                date=date,
                slug=slug,
            )
        )

    return entries


# ─────────────────────────────────────────────
#  Archive URL builder
# ─────────────────────────────────────────────
def get_archive_url(url: str) -> str | None:
    if any(domain in url for domain in BLOCKED_DOMAINS):
        return None
    match = re.search(r"https?://[^\s]+", url)
    if not match:
        return None
    return f"https://archive.today/newest/{match.group()}"


# ─────────────────────────────────────────────
#  Single-URL scraper (runs inside each thread)
# ─────────────────────────────────────────────
def scrape_page(url: str) -> dict:
    """
    Scrape one URL via Gemini. Never raises — errors returned in dict.
    """
    archive_url = get_archive_url(url)
    if not archive_url:
        return {
            "url": url,
            "archive_url": None,
            "content": None,
            "error": "Blocked or unrecognised URL",
        }

    prompt = f"""
    Visit this URL and extract the main article text only.
    Return JSON with keys: "title" (string) and "body" (string).

    URL: {archive_url}
    """

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = _client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=_config,
            )
            content = response.text
            if not response.text:
                # use beautifulsoup to extract the text
                content = scrape_with_beautifulsoup(archive_url)
            if not content:
                tprint(f"  ✘ [{url}] no content found")
                return {
                    "url": url,
                    "archive_url": archive_url,
                    "content": None,
                    "error": "No content found",
                }
            tprint(f"  ✔ Done: {url} -> {archive_url}")
            tprint(f"  ✔ Content: {content}")
            return {
                "url": url,
                "archive_url": archive_url,
                "content": content,
                "error": None,
            }

        except Exception as e:
            tprint(f"  ✘ [{url}] attempt {attempt}/{MAX_RETRIES}: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY * attempt)
            else:
                return {
                    "url": url,
                    "archive_url": archive_url,
                    "content": None,
                    "error": "Max retries exceeded",
                }


def get_headers() -> dict:
    return {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Cache-Control": "max-age=0",
        "Referer": "https://www.google.com/",
    }


def fetch_with_retry(
    url: str, max_retries: int = MAX_RETRIES, backoff_base: float = 2.0
) -> requests.Response:
    """Fetch URL with exponential backoff retry on 429 / 5xx errors.
    Uses shared RateLimiter and GlobalBackoff so all threads coordinate.
    """
    session = requests.Session()

    for attempt in range(1, max_retries + 1):
        # 1. Wait out any active global backoff (triggered by another thread)
        _global_backoff.wait_if_needed()

        # 2. Throttle to the shared rate limit before sending the request
        _rate_limiter.wait()

        try:
            tprint(f"  [fetch] Attempt {attempt}/{max_retries}: {url}")
            response = session.get(
                url, headers=get_headers(), timeout=30, allow_redirects=True
            )

            if response.status_code == 429:
                # Respect Retry-After if present, else use exponential backoff
                retry_after = int(
                    response.headers.get("Retry-After", backoff_base**attempt)
                )
                wait = retry_after + random.uniform(2, 5)  # jitter
                # Pause ALL threads, not just this one
                _global_backoff.trigger(wait)
                continue

            response.raise_for_status()
            return response

        except requests.exceptions.HTTPError as e:
            if attempt == max_retries:
                raise
            wait = backoff_base**attempt + random.uniform(0, 2)
            tprint(f"  HTTP error ({e}) — retrying in {wait:.1f}s...")
            time.sleep(wait)

        except requests.exceptions.RequestException as e:
            if attempt == max_retries:
                raise
            wait = backoff_base**attempt
            tprint(f"  Request error ({e}) — retrying in {wait:.1f}s...")
            time.sleep(wait)

    raise RuntimeError(f"Failed to fetch {url} after {max_retries} attempts.")


def scrape_with_beautifulsoup(url: str) -> str:
    response = fetch_with_retry(url)
    soup = BeautifulSoup(response.text, "html.parser")

    # --- Title ---
    title = None
    for selector in ["h1", "title"]:
        tag = soup.find(selector)
        if tag:
            title = tag.get_text(strip=True)
            break

    # --- Remove noise ---
    for tag in soup(
        [
            "script",
            "style",
            "noscript",
            "nav",
            "footer",
            "header",
            "aside",
            "form",
            "iframe",
        ]
    ):
        tag.decompose()

    # --- Main body: try semantic containers first ---
    body_text = ""
    candidates = [
        soup.find("article"),
        soup.find(id="article-content"),
        soup.find(class_="article-body"),
        soup.find(class_="body-content"),
        soup.find(class_="post-content"),
        soup.find("main"),
    ]

    for candidate in candidates:
        if candidate:
            paragraphs = candidate.find_all("p")
            text = "\n\n".join(
                p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True)
            )
            if len(text) > 200:
                body_text = text
                break

    # --- Fallback: all <p> tags ---
    if not body_text:
        paragraphs = soup.find_all("p")
        body_text = "\n\n".join(
            p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True)
        )
    return body_text


# ─────────────────────────────────────────────
#  Multithreaded scraper
# ─────────────────────────────────────────────
def scrape_all(urls: list[str], max_workers: int = MAX_WORKERS) -> dict[str, dict]:
    results = {}
    total = len(urls)
    tprint(f"\n[Scrape] {total} URLs across {max_workers} threads\n")

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_url = {executor.submit(scrape_page, url): url for url in urls}

        for i, future in enumerate(as_completed(future_to_url), start=1):
            url = future_to_url[future]
            result = future.result()
            tprint(f"  [{i}/{total}] {'✔' if not result['error'] else '✘'} {url}")
            results[url] = result

    return results


# ─────────────────────────────────────────────
#  Main
# ─────────────────────────────────────────────
def main():
    # 1. Parse sitemap
    tprint("[Sitemap] Fetching Bloomberg March 2026...")
    sitemap_entries = parse_bloomberg_sitemap(
        "https://www.bloomberg.com/sitemaps/news/2026-3.xml"
    )
    articles = [e for e in sitemap_entries if "japan" in e.url.lower()]
    tprint(f"[Sitemap] Found {len(articles)} Japan articles\n")

    # 2. Scrape concurrently
    urls = [e.url for e in articles]
    results = scrape_all(urls, max_workers=MAX_WORKERS)

    # 3. Summary
    ok = sum(1 for r in results.values() if not r["error"])
    fail = len(results) - ok
    tprint(f"\n[Done] {ok} succeeded, {fail} failed out of {len(results)} total")

    return results


if __name__ == "__main__":
    results = main()
    with open("results.json", "w") as f:
        json.dump(results, f, indent=2, default=str)
    print("Saved → results.json")
