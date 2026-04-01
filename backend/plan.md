Build a multi-agent investigative research system in Python. Keep it simple and clean.
No unnecessary abstractions. But make the system design scalable and flexible for future agents and architecture changes. Every agent is just a function that takes input and returns output.

---

## ARCHITECTURE OVERVIEW

Four agents run in sequence:
1. Planning Agent     → takes a user query, returns structured search queries
2. Investigation Agent → takes search queries, calls external API, returns raw JSON
3. Verification Agent  → takes raw articles, scores credibility, returns enriched articles
4. Formatter Agent    → takes enriched articles, returns a final markdown report

Entry point: investigator.py
review the existing agents in /agents directory and make necessary changes
Shared types in types.py.
Config (API keys, etc.) in config.py loaded from .env.

---

## FILE STRUCTURE
.env
main.py
agents/
├── config.py
├── types.py
├── agents/
│   ├── planning_agent.py
│   ├── investigation_agent.py
│   ├── verification_agent.py
│   └── formatter_agent.py
├── skills/
│   ├── news_api.py
│   ├── darkweb_api.py
├────── entity_api.py


---

## TYPES (types.py)

Define these TypedDicts:

SearchQuery:
  - query: str
  - entity_type: str        # e.g. "person", "org", "location", "event"
  - rationale: str          # why this query was generated


RawArticle:
  - id_article: int
  - id_site: int
  - header: str
  - summary: str
  - url: str
  - unix_timestamp: int
  - word_count: int
  - language: str
  - countrycode: str
  - site_rank_global: int   # from site_rank.rank_global
  - mediatype: str          # from mediatype.text
  - content_protected: int

EnrichedArticle(RawArticle):
  - credibility_score: float  # 0.0 to 1.0
  - credibility_reason: str
Report:
  - title: str
  - summary: str
  - sections: list[str]
  - citations: list[str]
  - generated_at: str

---

## AGENT 1: PLANNING AGENT (agents/planning_agent.py)

Function signature:
  def run(user_query: str) -> list[SearchQuery]

Logic:
- Call gemini API with the user query.
- System prompt: You are a research planning assistant. 
  Your job is to extract named entities from the user's query 
  and generate targeted search queries to maximise document recall.
  Return JSON only: a list of objects with keys: query, entity_type, rationale.
- Parse the JSON response and return list[SearchQuery].
- If Claude returns malformed JSON, log the error and return empty list.

Keep it simple — one API call, parse JSON, return typed list.

---

## AGENT 2: INVESTIGATION AGENT (agents/investigation_agent.py)

Function signature:
  def run(queries: list[SearchQuery]) -> list[RawArticle]

Logic:
- For each SearchQuery, make an HTTP GET request to the Opoint API.
- Create the skill and call it to get the API response from Opoint API:  API base URL(https://api.opoint.com/search/) and API key(OPOINT_API_KEY) come from config.py (loaded from .env).
- API search query: {
  "searchterm": {searchterm},
  "params": {
      "requestedarticles": {numberofarticles},
      "main": {
          "header": 1,
          "summary": 1
      }
  }
}
- The external API returns JSON shaped like the example below.
{
    "searchresult": {
        "documents": 1,
        "first_timestamp": 1772631758,
        "last_timestamp": 1772631758,
        "generated_timestamp": 1772632071,
        "search_start": 2147483647,
        "context": "374851889:1:0;TOTDOC=1",
        "count": 1,
        "range_count": 850,
        "range_start": 1772027271,
        "range_end": 0,
        "range_id": "d-7",
        "cacheage": -1,
        "cputime": 129,
        "host": "abel1.opoint.com",
        "compiledate": "Mar  3 2026 00:00:00",
        "branch": "NOT ACTIVE",
        "notimeout": true,
        "currency": "",
        "netsprintindextimer": 116,
        "document": [
            {
                "id_site": 157440,
                "id_article": 415288,
                "hidden": false,
                "position": 1,
                "timezone": "Asia/Kolkata",
                "countrycode": "IN",
                "countryname": "India",
                "similarweb": {
                    "domain": "webdunia.com"
                },
                "site_rank": {
                    "rank_global": 1052,
                    "rank_country": 67
                },
                "unix_timestamp": 1772631758,
                "mediatype": {
                    "timemap": false,
                    "clip": false,
                    "hastext": true,
                    "haslogo": false,
                    "paywall": false,
                    "fulltext": true,
                    "text": "WEB"
                },
                "internal_search_reply": {
                    "id_site": 157440,
                    "id_article": 415288,
                    "text": ""
                },
                "stimestamp": 374851889,
                "stimestamp_index": 374851889,
                "local_time": {
                    "GMT": 1,
                    "text": "20260304T14:42:38+0100"
                },
                "local_rcf822_time": {
                    "text": "Wed, 04 Mar 2026 14:42:38 +0100"
                },
                "distribute_conditions": "",
                "content_protected": 0,
                "language": {
                    "encoding": "iso-639",
                    "text": "en"
                },
                "word_count": 1363,
                "first_source": {
                    "id": 4375327,
                    "name": "वेबदुनिया",
                    "sitename": "वेबदुनिया",
                    "url": "http://webdunia.com",
                    "siteurl": "http://webdunia.com"
                },
                "header": {
                    "matches": false,
                    "text": "Did the US-Israel strikes on Iran break international law?"
                },
                "summary": {
                    "matches": false,
                    "text": "  UN Secretary General Antonio Guterres has condemned the ongoing offensive against Iran launched by the United States and Israel on February 28."
                },
                "articleimages": {
                    "count": 2,
                    "articleimage": [
                        {
                            "url": "https://wd-image.webdunia.com/processimg/1200x628/webp/_media/en/img/article/2026-03/03/full/1772520819-2017.jpg"
                        },
                        {
                            "url": "https://nonprod-media.webdunia.com/public_html/_media/en/img/article/2026-03/03/full/1772520819-2017.jpg"
                        }
                    ]
                },
                "caption": {
                    "text": " "
                },
                "quotes": [],
                "url": "https://p-english.webdunia.com/article/deutsche-welle-news/did-the-us-israel-strikes-on-iran-break-international-law-126030400014_1.html",
                "orig_url": "https://p-english.webdunia.com/article/deutsche-welle-news/did-the-us-israel-strikes-on-iran-break-international-law-126030400014_1.html",
                "url_common": "webdunia.com",
                "screenshots": [],
                "author": "DW",
                "exist_in_basket": "",
                "tags": []
            }
        ]
    }
}
- Use necessary open source library to extract the content from the urls in the response JSON
- Deduplicate by content before returning.
- If an API call fails, log the error and continue to the next query.

---

## AGENT 3: VERIFICATION AGENT (agents/verification_agent.py)

Function signature:
  def run(articles: list[RawArticle]) -> list[EnrichedArticle]

- For each source, get a credibility_score.  
Logic — write real scoring, not a hardcoded list:

Score each article 0.0 to 1.0 using these signals:

1. RANK SCORE (0.0–0.3):
   - site_rank_global <= 1000:    0.3
   - site_rank_global <= 10000:   0.2
   - site_rank_global <= 100000:  0.1
   - else:                        0.0

2. WORD COUNT SCORE (0.0–0.2):
   - word_count >= 500:  0.2
   - word_count >= 200:  0.1
   - else:               0.0

3. LANGUAGE SCORE (0.0–0.1):
   - language == "en":  0.1
   - else:              0.05

4. PAYWALLED CONTENT SCORE (0.0–0.1):
   - content_protected == 1:  0.1  # paywalled = higher credibility signal
   - else:                    0.0

5. CORROBORATION SCORE (0.0–0.3):
   Count how many other articles in the corpus share the same id_site.
   - Appears in 3+ articles from same site: -0.1 (over-represented, bias risk)
   - Appears in 2 articles from same site:   0.0
   - Unique source (1 article):              0.1
   Then count how many articles share similar header keywords (simple word overlap):
   - Corroborated by 3+ other sources:  +0.2
   - Corroborated by 1-2 others:        +0.1
   - No corroboration:                   0.0

6. MEDIA TYPE SCORE (0.0–0.1):
   - mediatype == "WEB": 0.05
   - else:               0.0

Sum all signals. Clamp to [0.0, 1.0].

Build a human-readable reason string summarising the key factors that drove the score.
Example: "High-ranked source (global rank 2228), long-form content (784 words), 
corroborated by 4 other articles, paywalled (credibility signal)."

Return list[EnrichedArticle], sorted by credibility_score descending.

---

## AGENT 4: FORMATTER AGENT (agents/formatter_agent.py)

Function signature:
  def run(articles: list[EnrichedArticle], user_query: str, style: str = "default") -> Report

Logic:
- Call gemini API with the enriched articles and user query.
- System prompt: You are a research report writer. 
  You will be given a list of articles with credibility scores.
  Synthesise the findings into a structured investigative report.
  Only cite articles with credibility_score >= 0.4.
  Every claim must reference the article URL as a citation.
  Style guide: {style}
  Return JSON only with keys: title, summary, sections (list of strings), citations (list of URLs).
- Pass articles as a condensed JSON payload: title, summary, url, credibility_score only.
- Parse the JSON response and return a Report.
- Add generated_at as ISO timestamp.

---

## MAIN (main.py)

def main(user_query: str, style: str = "default"):
    print(f"[1/4] Planning...")
    queries = planning_agent.run(user_query)
    
    print(f"[2/4] Investigating ({len(queries)} queries)...")
    articles = investigation_agent.run(queries)
    
    print(f"[3/4] Verifying ({len(articles)} articles)...")
    enriched = verification_agent.run(articles)
    
    print(f"[4/4] Formatting report...")
    report = formatter_agent.run(enriched, user_query, style)
    
    # Print report to stdout as markdown
    print(f"\n# {report['title']}\n")
    print(f"{report['summary']}\n")
    for section in report['sections']:
        print(f"{section}\n")
    print("## Citations")
    for i, url in enumerate(report['citations'], 1):
        print(f"{i}. {url}")

if __name__ == "__main__":
    import sys
    query = sys.argv[1] if len(sys.argv) > 1 else "Iran Israel conflict"
    main(query)

---

## CONFIG (config.py)

Load from .env:
  OPOINT_API_KEY
  OPOINT_API_BASE_URL
  GEMINI_API_KEY

Use python-dotenv. Raise a clear error if any key is missing.


---

## RULES

- Use the google  SDK (not raw HTTP)
- Use the requests library for the external search API.
- All Gemini calls use model: gemini-3-flash-light
- All JSON parsing wrapped in try/except with clear error logging.
- No retry logic for now — log failures and continue.
- Type hints on all functions.
- Keep each agent file under 300 lines.

Build this now.