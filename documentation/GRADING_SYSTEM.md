# Sidney Source Grading System

**Internal Technical Documentation — Satorus Group Ltd**

---

## Overview

Every news article surfaced in a Sidney investigation receives a reliability grade from **A+** (highest confidence) to **D** (lowest confidence). The grade is computed from a weighted composite of six scoring factors, each drawing on one or more of three independent data layers: an offline MBFC database, per-article metadata from the AskNews API, and live LLM analysis via Gemini.

The grading profile (factor weights) adapts automatically to the investigation type. A sanctions investigation prioritises attribution quality and cross-source corroboration. A geopolitical analysis prioritises editorial bias detection. The user sees a letter grade and plain-language analyst signals; the weighting mechanics are never exposed.

Graded source data is injected into the report JSON after the writer agent completes, enriching every `sources[]` entry with `grade`, `composite_score`, `factor_scores`, and `analyst_signals`.

---

## Codebase Location

```
backend/src/graph/grading/
├── __init__.py          # grade_articles() — main pipeline entry point
├── config.py            # Weight profiles, scoring maps, grade thresholds, penalties
├── grader.py            # SourceGrader — composite score + penalties/bonuses
├── data_loaders.py      # MBFC, RSF, specialist verticals, COI flags
├── attribution.py       # Gemini attribution quality classification
├── corroboration.py     # Gemini cross-article corroboration analysis
├── signals.py           # Gemini analyst signal generation
└── data/
    ├── mbfc.json                # 9,777 MBFC source ratings
    ├── rsf.json                 # RSF Press Freedom Index (132 countries)
    ├── coi_flags.json           # Conflict-of-interest flags (state-funded media)
    ├── specialist_verticals.json # Domain-to-vertical expertise tags
    └── media_type_fallback.json # Media type fallbacks for major outlets
```

---

## Data Layers

The grading system draws on three independent data sources.

### Layer 1: Offline Reference Databases

**Media Bias/Fact Check (MBFC)**
Stored locally as `data/mbfc.json` (9,777 entries). Keyed by normalised domain (protocol, `www`, trailing slashes stripped; lowercased). Fields used per source:

| Field               | Used for                                        |
| ------------------- | ----------------------------------------------- |
| `factual_reporting` | Factor 1: Factual reliability                   |
| `bias`              | Factor 3: Bias and objectivity (40% sub-weight) |
| `media_type`        | Factor 2: Source authority                      |
| `credibility`       | Supporting signal                               |
| `country`           | Cross-reference only                            |

If a domain is not in MBFC, default scores are applied (typically 50/100).

**RSF Press Freedom Index**
Stored as `data/rsf.json` (132 country entries). Keyed by ISO-2 country code. Values are scores 0 (worst) → 100 (best). Used directly as Factor 5 (press environment). Source country comes from the AskNews `country` field per article.

**Specialist Vertical Tags**
Stored as `data/specialist_verticals.json`. Maps domain → list of vertical keywords (e.g. `"ft.com": ["finance", "markets", "economy"]`). When a domain's verticals match the article's `keywords`, a +15 boost is added to Factor 2 (source authority).

**Conflict-of-Interest Flags**
Stored as `data/coi_flags.json`. Maps domain → sponsor country code. Used to apply the conflict-of-interest penalty (−15) when the article topic involves the sponsor country.

**Media Type Fallbacks**
Stored as `data/media_type_fallback.json`. Hardcoded media types for major outlets not cleanly matched by MBFC (e.g. `"bbc.com": "TV Station"`).

---

### Layer 2: AskNews Article Metadata

Per-article signals returned by the AskNews API at query time. The grading-relevant fields are captured in a module-level cache (`_grading_article_cache` in `asknews.py`) alongside each article — they are not passed to the Gemini writer prompt (avoids chunk-limit issues).

| Field             | Used for                                                          |
| ----------------- | ----------------------------------------------------------------- |
| `page_rank`       | Factor 2: Source authority (prominence proxy)                     |
| `reporting_voice` | Factor 3: Bias/objectivity (35% sub-weight)                       |
| `bias`            | Factor 3: Bias/objectivity (article-level, 25% sub-weight)        |
| `provocative`     | Factor 3: Bias/objectivity (article-level, 25% sub-weight)        |
| `authors`         | Factor 4: Attribution quality (+10 named-author bonus)            |
| `key_points`      | Factor 4: Attribution quality (sent to Gemini for classification) |
| `keywords`        | Factor 2: Specialist vertical boost matching                      |
| `country`         | Factor 5: Press environment (joined to RSF index)                 |

---

### Layer 3: Gemini Runtime Analysis

Three LLM calls are made per grading run, using the model specified in `.env`.

**Attribution Classification** (`attribution.py`)
Each article's `key_points` are sent to Gemini with a classification prompt. The model identifies the highest-quality attribution type present:

| Attribution type          | Score |
| ------------------------- | ----- |
| Named official source     | 100   |
| Named unofficial source   | 85    |
| Document or data citation | 80    |
| Institutional attribution | 75    |
| Unnamed official source   | 55    |
| No attribution            | 20    |

A named-author bonus of +10 is applied if the AskNews `authors` field is populated. Classification calls are batched in parallel (up to 8 concurrent Gemini calls via `ThreadPoolExecutor`).

**Cross-Source Corroboration** (`corroboration.py`)
All articles' `key_points` are sent in a single Gemini call. The model groups claims by semantic similarity and scores each article based on how many independent sources confirm its claims. Wire-service syndication (same article on multiple domains) is explicitly excluded.

| Corroboration level | Score | Condition              |
| ------------------- | ----- | ---------------------- |
| Strong              | 100   | 3+ independent sources |
| Moderate            | 75    | 2 independent sources  |
| Partial             | 50    | Some overlap           |
| Standalone          | 30    | No corroboration found |
| Contradicted        | 10    | Actively contradicted  |

The result is a domain-level JSON object that maps back to individual article URLs.

**Analyst Signal Generation** (`signals.py`)
After scoring, Gemini generates 3–6 plain-language analyst bullets per article. Each signal is tagged `positive`, `negative`, or `neutral`. Calls are batched in parallel. These appear in the citation popover on the frontend.

---

## Scoring Model

### Six Factors

Each article receives six factor scores (0–100), each with a configurable weight. The default profile weights are:

| Factor               | Default weight | Primary data sources                                                                     |
| -------------------- | -------------- | ---------------------------------------------------------------------------------------- |
| Factual reliability  | 25%            | MBFC `factual_reporting`                                                                 |
| Source authority     | 20%            | AskNews `page_rank` + MBFC `media_type`                                                  |
| Bias and objectivity | 15%            | MBFC `bias` (40%) + AskNews `reporting_voice` (35%) + AskNews `bias`/`provocative` (25%) |
| Attribution quality  | 15%            | Gemini classification of `key_points`                                                    |
| Press environment    | 10%            | RSF index for source country                                                             |
| Corroboration        | 15%            | Gemini cross-article analysis                                                            |

#### Factor 1 — Factual Reliability

MBFC `factual_reporting` rating mapped to score:

| MBFC Rating    | Score        |
| -------------- | ------------ |
| Very High      | 100          |
| High           | 85           |
| Mostly Factual | 65           |
| Mixed          | 40           |
| Low            | 20           |
| Very Low       | 5            |
| Not in MBFC    | 50 (default) |

#### Factor 2 — Source Authority

Computed as the average of two sub-scores, with an optional specialist vertical boost:

- **Page rank sub-score**: AskNews `page_rank` mapped to tiers:
  - ≥80 → 100 (global leaders)
  - ≥60 → 80 (major national outlets)
  - ≥40 → 60 (established regional)
  - ≥20 → 40 (smaller outlets)
  - ≥0 → 20 (minimal reach)
  - Not present → 40 (default)

- **Media type sub-score** (MBFC or fallback):

  | Type        | Score        |
  | ----------- | ------------ |
  | News Agency | 95           |
  | Newspaper   | 90           |
  | TV Station  | 85           |
  | Research    | 85           |
  | Government  | 80           |
  | Magazine    | 75           |
  | Think Tank  | 70           |
  | Website     | 50           |
  | Blog        | 30           |
  | Satire      | 10           |
  | Not found   | 50 (default) |

- **Specialist vertical boost**: +15 applied to the averaged base score if the source domain has a registered vertical expertise tag that matches any keyword in the article's `keywords` field. Capped at 100.

#### Factor 3 — Bias and Objectivity

Composite of three sub-signals:

```
bias_score = (mbfc_bias_score × 0.40)
           + (reporting_voice_score × 0.35)
           + (article_bias_signal × 0.25)
```

- **MBFC bias distance from centre**:

  | MBFC Bias                    | Score        |
  | ---------------------------- | ------------ |
  | Least Biased / Center        | 100          |
  | Left-Center / Right-Center   | 75           |
  | Left / Right                 | 40           |
  | Far Left / Far Right         | 15           |
  | Extreme Left / Extreme Right | 10           |
  | Not in MBFC                  | 50 (default) |

- **AskNews `reporting_voice`**:

  | Voice         | Score        |
  | ------------- | ------------ |
  | Investigative | 100          |
  | Objective     | 90           |
  | Analytical    | 75           |
  | Opinion       | 50           |
  | Persuasive    | 30           |
  | Sensational   | 15           |
  | Not present   | 50 (default) |

- **Article-level bias + provocative** (averaged): AskNews `bias` mapped analogously to MBFC bias, and `provocative` (Low/Medium/High/Very High → 100/60/20/5). The two are averaged to form the 25% article signal.

Result is clamped to 0–100.

#### Factor 4 — Attribution Quality

Gemini classification score (see Layer 3 above), plus +10 named-author bonus. Clamped at 100.

#### Factor 5 — Press Environment

RSF Press Freedom Index score for the article's source country (0–100). Defaults to 50 if the country is not in the RSF dataset.

#### Factor 6 — Corroboration

Gemini cross-source corroboration score for this article's claims (see Layer 3 above).

---

### Composite Score Calculation

```
composite = Σ (factor_score[i] × weight[i])
```

Weights sum to 1.0. The composite is a float in the range 0–100.

---

### Penalties and Bonuses

Applied **additively** to the composite after weighting, then the result is **clamped to 0–100**:

| Adjustment                   | Value | Trigger condition                                                                                                          |
| ---------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------- |
| Conflict of interest         | −15   | Domain is in `coi_flags.json` AND article topic involves the sponsor country (matched via `countrycode` or keywords)       |
| State media on sponsor topic | −20   | Domain is state-funded AND `countrycode` matches the sponsor country                                                       |
| Primary source bonus         | +10   | Domain contains `.gov`, `.mil`, `.judiciary.`, `courts.`, `sec.gov`, `un.org`, `who.int`, `imf.org`, `worldbank.org`, etc. |
| Investigative exclusive      | +5    | `reporting_voice` = Investigative AND corroboration level = `standalone` (sole reporter)                                   |
| Anonymous / no author        | −5    | `authors` field is null/empty AND domain is not a known wire service                                                       |

Wire services exempt from the anonymous penalty: `reuters.com`, `apnews.com`, `afp.com`, `upi.com`, `xinhua.net`, `tass.com`, `efe.com`, `ansa.it`, `kyodonews.net`, `pap.pl`, `bta.bg`.

---

### Grade Thresholds

| Grade | Score range | Meaning                                                                          |
| ----- | ----------- | -------------------------------------------------------------------------------- |
| A+    | 90–100      | Highly reliable. Primary sources, strong corroboration, established reliability. |
| A     | 80–89       | Reliable. Well-known outlets with strong factual track records.                  |
| B+    | 70–79       | Generally reliable. Reputable sources with minor caveats.                        |
| B     | 60–69       | Mostly reliable. Decent sources but with notable limitations.                    |
| C     | 45–59       | Use with caution. Unknown source, limited track record, or bias concerns.        |
| D     | 0–44        | Unreliable. Highly biased, unverified, or actively contradicted.                 |

---

## Dynamic Weighting Profiles

Factor weights shift automatically based on the investigation type. The `investigation_type` written by the LLM writer agent into the report JSON is used to select the profile.

| Profile         | Factual | Authority | Bias    | Attribution | Press   | Corroboration |
| --------------- | ------- | --------- | ------- | ----------- | ------- | ------------- |
| Default         | 25%     | 20%       | 15%     | 15%         | 10%     | 15%           |
| Sanctions       | 20%     | 15%       | 5%      | **30%**     | 5%      | **25%**       |
| Geopolitical    | 15%     | 15%       | **25%** | 10%         | 15%     | 20%           |
| Due diligence   | 25%     | 10%       | 15%     | **25%**     | 5%      | 20%           |
| Supply chain    | 20%     | 20%       | 5%      | 20%         | 10%     | **25%**       |
| Threat intel    | 15%     | 15%       | 20%     | 10%         | **20%** | 20%           |
| Financial crime | 25%     | 15%       | 5%      | **30%**     | 5%      | 20%           |

**Profile selection mapping** (from `config.py`):

| Investigation type (LLM-generated) | Profile         |
| ---------------------------------- | --------------- |
| `PERSON_INVESTIGATION`             | `due_diligence` |
| `COMPANY_INVESTIGATION`            | `due_diligence` |
| `GEOPOLITICAL_ANALYSIS`            | `geopolitical`  |
| `NETWORK_MAPPING`                  | `default`       |

If the investigation type is unrecognised, `default` is used.

---

## Pipeline Execution

`grade_articles(articles, profile)` in `__init__.py` orchestrates five steps:

```
Step 1  Attribution classification    ~500ms/article   Parallel Gemini calls
Step 2  Cross-article corroboration   ~1–2s total      Single Gemini call
Step 3  Composite score calculation   Instant          Pure arithmetic
Step 4  Penalties and bonuses         Instant          Rule-based
Step 5  Analyst signal generation     ~500ms/article   Parallel Gemini calls
```

Steps 1 and 5 use `ThreadPoolExecutor(max_workers=8)` for parallel Gemini calls. All Gemini calls use `temperature=0`.

The pipeline is triggered in `flow.py` at the end of `run_pipeline_stages`, after the writer agent has saved the report JSON. The `investigation_type` written into the report is read back to select the grading profile. The graded results are then patched into `report.sources[]` for every matched source (exact URL match first, domain fallback second). Sources with no URL match receive a stub entry (`grade="C"`, `composite_score=0`).

---

## Output Shape

After grading, each entry in `report.sources[]` carries these additional fields:

```json
{
  "index": 1,
  "title": "...",
  "url": "https://reuters.com/...",
  "date": "2026-04-14",
  "key_insight": "...",
  "grade": "A",
  "composite_score": 87,
  "factor_scores": {
    "factual_reliability": 100,
    "source_authority": 95,
    "bias_objectivity": 88,
    "attribution_quality": 75,
    "press_environment": 78,
    "corroboration": 75
  },
  "analyst_signals": [
    {
      "text": "Reuters is a globally recognised wire service with a very high factual reporting track record.",
      "sentiment": "positive"
    },
    {
      "text": "Article carries named official attribution, strengthening credibility.",
      "sentiment": "positive"
    },
    {
      "text": "No named author listed, though wire services are exempt from the anonymous-source penalty.",
      "sentiment": "neutral"
    }
  ]
}
```

---

## Known Limitations and Not-Yet-Built

| Component                                     | Status    | Notes                                                                                                                               |
| --------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Investigation-level confidence rating         | Not built | A finding supported by multiple A-grade sources would receive a higher confidence band. Designed but not yet implemented.           |
| Profile comparison (side-by-side)             | Not built | Planned for demo and analyst review purposes.                                                                                       |
| Grading for quick-search reports              | Not run   | Quick-search pipeline uses model knowledge only, no AskNews articles, so there is nothing to grade.                                 |
| Re-grading with correct profile at write time | Partial   | Profile is selected from the LLM-written `investigation_type`. If the type is not one of the four mapped values, `default` is used. |
