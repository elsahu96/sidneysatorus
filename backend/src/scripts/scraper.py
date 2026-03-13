#!/usr/bin/env python3
"""
geo_scraper.py — Fetch geo-restricted US websites from UK/EU.

Strategy (tried in order):
  1. ScraperAPI  (free tier: 1 000 req/month – sign up at scraperapi.com)
  2. Bright Data / Oxylabs / Smartproxy via HTTP proxy URL
  3. US Tor exit node (requires Tor running locally: `tor` or Docker)
  4. archive.org Wayback Machine (no auth required, always works)
  5. Google Cache (fallback, plain HTTP)

Usage:
  python scraper.py <url> [--mode text|screenshot] [--proxy PROXY_URL]

Examples:
  python scraper.py https://example.com
  python scraper.py https://example.com --mode screenshot
  python scraper.py https://example.com --proxy socks5h://127.0.0.1:9050   # Tor
  python scraper.py https://example.com --proxy http://user:pass@proxy.host:8080
"""

import argparse
import sys
import os
import time
import hashlib
import json
from pathlib import Path
from urllib.parse import urlencode, urlparse, quote_plus


# ── optional deps (installed on demand) ──────────────────────────────────────
def _pip(pkg):
    import subprocess

    subprocess.check_call(
        [sys.executable, "-m", "pip", "install", pkg, "-q", "--break-system-packages"]
    )


try:
    import requests
except ImportError:
    _pip("requests")
    import requests

try:
    from bs4 import BeautifulSoup
except ImportError:
    _pip("beautifulsoup4")
    from bs4 import BeautifulSoup


import socks  # noqa: F401

# ─────────────────────────────────────────────────────────────────────────────
# Config – fill in your keys here or export them as environment variables
# ─────────────────────────────────────────────────────────────────────────────
SCRAPERAPI_KEY = os.getenv("SCRAPERAPI_KEY", "")  # https://scraperapi.com
SCRAPEOPS_KEY = os.getenv("SCRAPEOPS_KEY", "")  # https://scrapeops.io
ZENROWS_KEY = os.getenv("ZENROWS_KEY", "")  # https://zenrows.com

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

TIMEOUT = 30


# ─────────────────────────────────────────────────────────────────────────────
# Helper utilities
# ─────────────────────────────────────────────────────────────────────────────


def _session(proxy_url: str | None = None) -> requests.Session:
    s = requests.Session()
    s.headers.update(HEADERS)
    if proxy_url:
        s.proxies = {"http": proxy_url, "https": proxy_url}
    return s


def _clean_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "header", "footer", "nav"]):
        tag.decompose()
    lines = [ln.strip() for ln in soup.get_text("\n").splitlines() if ln.strip()]
    return "\n".join(lines)


def _save(url: str, content: str | bytes, suffix: str) -> Path:
    slug = hashlib.md5(url.encode()).hexdigest()[:8]
    host = urlparse(url).netloc.replace(".", "_")
    fname = Path(f"{host}_{slug}{suffix}")
    mode = "wb" if isinstance(content, bytes) else "w"
    enc = None if isinstance(content, bytes) else "utf-8"
    with open(fname, mode, encoding=enc) as fh:
        fh.write(content)
    return fname


# ─────────────────────────────────────────────────────────────────────────────
# Fetch strategies – text / HTML body
# ─────────────────────────────────────────────────────────────────────────────


def fetch_direct(url: str, proxy_url: str | None) -> str | None:
    """Plain requests – works if no geo-block or if proxy routes via US."""
    try:
        r = _session(proxy_url).get(url, timeout=TIMEOUT)
        if r.status_code == 200:
            print(f"  [direct] ✓ {r.status_code}")
            return r.text
        print(f"  [direct] ✗ HTTP {r.status_code}")
    except Exception as e:
        print(f"  [direct] ✗ {e}")
    return None


def fetch_scraperapi(url: str) -> str | None:
    """ScraperAPI – rotates US residential proxies automatically."""
    if not SCRAPERAPI_KEY:
        print("  [scraperapi] skipped (no SCRAPERAPI_KEY)")
        return None
    api_url = f"http://api.scraperapi.com?api_key={SCRAPERAPI_KEY}&url={quote_plus(url)}&country_code=us"
    try:
        r = requests.get(api_url, timeout=60)
        if r.status_code == 200:
            print("  [scraperapi] ✓")
            return r.text
        print(f"  [scraperapi] ✗ HTTP {r.status_code}")
    except Exception as e:
        print(f"  [scraperapi] ✗ {e}")
    return None


def fetch_scrapeops(url: str) -> str | None:
    """ScrapeOps proxy – free tier 1 000 req/month."""
    if not SCRAPEOPS_KEY:
        print("  [scrapeops] skipped (no SCRAPEOPS_KEY)")
        return None
    api_url = f"https://proxy.scrapeops.io/v1/?api_key={SCRAPEOPS_KEY}&url={quote_plus(url)}&country=us"
    try:
        r = requests.get(api_url, timeout=60)
        if r.status_code == 200:
            print("  [scrapeops] ✓")
            return r.text
        print(f"  [scrapeops] ✗ HTTP {r.status_code}")
    except Exception as e:
        print(f"  [scrapeops] ✗ {e}")
    return None


def fetch_zenrows(url: str) -> str | None:
    """ZenRows – handles JS rendering and geo-blocks."""
    if not ZENROWS_KEY:
        print("  [zenrows] skipped (no ZENROWS_KEY)")
        return None
    params = {"apikey": ZENROWS_KEY, "url": url, "js_render": "false"}
    try:
        r = requests.get("https://api.zenrows.com/v1/", params=params, timeout=60)
        if r.status_code == 200:
            print("  [zenrows] ✓")
            return r.text
        print(f"  [zenrows] ✗ HTTP {r.status_code}")
    except Exception as e:
        print(f"  [zenrows] ✗ {e}")
    return None


def fetch_wayback(url: str) -> str | None:
    """Wayback Machine – no auth, returns latest snapshot."""
    api = f"https://archive.org/wayback/available?url={quote_plus(url)}"
    try:
        meta = requests.get(api, timeout=15).json()
        snap = meta.get("archived_snapshots", {}).get("closest", {})
        snap_url = snap.get("url")
        if not snap_url:
            print("  [wayback] ✗ no snapshot found")
            return None
        r = requests.get(snap_url, timeout=TIMEOUT, headers=HEADERS)
        if r.status_code == 200:
            print(f"  [wayback] ✓ snapshot: {snap_url}")
            return r.text
    except Exception as e:
        print(f"  [wayback] ✗ {e}")
    return None


def fetch_google_cache(url: str) -> str | None:
    """Google Cache – sometimes bypasses geo-blocks (best-effort)."""
    cache_url = (
        f"https://webcache.googleusercontent.com/search?q=cache:{quote_plus(url)}"
    )
    try:
        r = _session(None).get(cache_url, timeout=TIMEOUT)
        if r.status_code == 200 and "googleusercontent" in r.url:
            print("  [google_cache] ✓")
            return r.text
        print(f"  [google_cache] ✗ HTTP {r.status_code}")
    except Exception as e:
        print(f"  [google_cache] ✗ {e}")
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Screenshot strategy (Playwright headless browser)
# ─────────────────────────────────────────────────────────────────────────────


def screenshot_playwright(url: str, proxy_url: str | None) -> bytes | None:
    """
    Headless Chromium screenshot via Playwright.
    Install once:  pip install playwright && playwright install chromium
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        _pip("playwright")
        import subprocess

        subprocess.run(
            [sys.executable, "-m", "playwright", "install", "chromium", "--with-deps"],
            check=True,
        )
        from playwright.sync_api import sync_playwright

    proxy_cfg = {"server": proxy_url} if proxy_url else None
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                headless=True,
                proxy=proxy_cfg,
                args=["--no-sandbox", "--disable-setuid-sandbox"],
            )
            ctx = browser.new_context(
                locale="en-US",
                timezone_id="America/New_York",
                user_agent=HEADERS["User-Agent"],
                viewport={"width": 1280, "height": 900},
            )
            page = ctx.new_page()
            page.goto(url, timeout=60_000, wait_until="networkidle")
            time.sleep(2)
            png = page.screenshot(full_page=True)
            browser.close()
            print("  [playwright] ✓ screenshot captured")
            return png
    except Exception as e:
        print(f"  [playwright] ✗ {e}")
        return None


def screenshot_scraperapi(url: str) -> bytes | None:
    """ScraperAPI screenshot endpoint."""
    if not SCRAPERAPI_KEY:
        print("  [scraperapi_ss] skipped (no SCRAPERAPI_KEY)")
        return None
    api_url = (
        f"https://api.scraperapi.com/screenshot"
        f"?api_key={SCRAPERAPI_KEY}&url={quote_plus(url)}&country_code=us&fullpage=true"
    )
    try:
        r = requests.get(api_url, timeout=90)
        if r.status_code == 200 and r.headers.get("content-type", "").startswith(
            "image"
        ):
            print("  [scraperapi_ss] ✓")
            return r.content
        print(f"  [scraperapi_ss] ✗ HTTP {r.status_code}")
    except Exception as e:
        print(f"  [scraperapi_ss] ✗ {e}")
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Orchestration
# ─────────────────────────────────────────────────────────────────────────────

TEXT_STRATEGIES = [
    ("direct", lambda url, proxy: fetch_direct(url, proxy)),
    ("scraperapi", lambda url, proxy: fetch_scraperapi(url)),
    ("scrapeops", lambda url, proxy: fetch_scrapeops(url)),
    ("zenrows", lambda url, proxy: fetch_zenrows(url)),
    ("wayback", lambda url, proxy: fetch_wayback(url)),
    ("google_cache", lambda url, proxy: fetch_google_cache(url)),
]

SCREENSHOT_STRATEGIES = [
    ("playwright_proxy", lambda url, proxy: screenshot_playwright(url, proxy)),
    ("scraperapi_ss", lambda url, proxy: screenshot_scraperapi(url)),
    ("playwright_direct", lambda url, _: screenshot_playwright(url, None)),
]


def scrape(url: str, mode: str = "text", proxy_url: str | None = None) -> dict:
    print(f"\n{'='*60}")
    print(f"URL  : {url}")
    print(f"Mode : {mode}")
    print(f"Proxy: {proxy_url or '(none – will try API services)'}")
    print(f"{'='*60}\n")

    result = {"url": url, "mode": mode, "success": False}

    if mode == "text":
        for name, fn in TEXT_STRATEGIES:
            print(f"→ Trying [{name}] …")
            html = fn(url, proxy_url)
            if html:
                text = _clean_text(html)
                path = _save(url, text, ".txt")
                result.update(
                    {
                        "success": True,
                        "strategy": name,
                        "file": str(path),
                        "preview": text[:500],
                    }
                )
                print(f"\n✅  Saved to: {path}")
                print(f"\n── Content preview ({'─'*40})\n{text[:800]}\n{'─'*50}")
                return result
        print("\n❌  All text strategies failed.")

    elif mode == "screenshot":
        for name, fn in SCREENSHOT_STRATEGIES:
            print(f"→ Trying [{name}] …")
            png = fn(url, proxy_url)
            if png:
                path = _save(url, png, ".png")
                result.update({"success": True, "strategy": name, "file": str(path)})
                print(f"\n✅  Screenshot saved to: {path}")
                return result
        print("\n❌  All screenshot strategies failed.")

    return result


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────


def main():
    # parser = argparse.ArgumentParser(
    #     description="Fetch geo-restricted US websites from UK/EU.",
    #     formatter_class=argparse.RawDescriptionHelpFormatter,
    #     epilog=__doc__,
    # )
    # parser.add_argument("url", help="Target URL to scrape")
    # parser.add_argument(
    #     "--mode",
    #     choices=["text", "screenshot"],
    #     default="text",
    #     help="Output mode: 'text' (default) extracts body text, 'screenshot' saves PNG",
    # )
    # parser.add_argument(
    #     "--proxy",
    #     help=(
    #         "Optional proxy URL, e.g.:\n"
    #         "  socks5h://127.0.0.1:9050   (Tor)\n"
    #         "  http://user:pass@host:port  (commercial proxy)"
    #     ),
    #     default=None,
    # )
    # args = parser.parse_args()
    url = "https://www.newswest9.com/article/news/nation-world/attack-on-iran/iran-names-former-supreme-leaders-son-to-as-new-leader/507-6d083d85-7c66-4393-afee-02cad3bdc099%22"
    # result = scrape(args.url, mode=args.mode, proxy_url=args.proxy)
    result = scrape(url, mode="text", proxy_url="socks5h://127.0.0.1:9050")
    # machine-readable summary
    print("\n── Result JSON ──────────────────────────────────────────")
    out = {k: v for k, v in result.items() if k != "preview"}
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
