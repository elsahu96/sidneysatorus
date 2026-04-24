# Product Requirements Document — Sidney

- **Product:** Sidney
- **Owner:** Satorus Group
- **Status:** Draft
- **Last Updated:** 07 April 2026

---

## 1. Executive Summary

### Product Vision

Sidney is an AI-powered OSINT (Open-Source Intelligence) investigation platform that enables intelligence analysts, security teams, and enterprise risk professionals to conduct structured, multi-source investigations and produce publication-ready reports in minutes rather than days.

**Target user:** Intelligence analysts and risk professionals at enterprise organisations (initial target: NorthQuay and comparable clients).

**Key differentiator:** A human-in-the-loop multi-agent pipeline that lets the analyst steer each stage of the investigation — planning, research, and report writing — before AI produces a graded, fully cited intelligence document.

**Success definition:** An analyst can go from a plain-language query to a structured, sourced, exportable report in under 10 minutes with no specialist tooling knowledge.

### Strategic Alignment

| Dimension             | Detail                                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Business objective    | Deliver a commercially viable SaaS intelligence product for the enterprise security and risk market                        |
| User problem          | OSINT investigation is slow, manual, and produces inconsistent output quality across analysts                              |
| Market opportunity    | Enterprise threat intelligence, corporate due diligence, NGO security — all underserved by consumer search tools           |
| Competitive advantage | Analyst-controlled pipeline with HITL review; structured graded output; geospatial context; multi-tenant SaaS from day one |

### Resource Requirements

- **Key milestones:** MVP delivery → NorthQuay beta (late April 2026) → general availability
- **Infrastructure:** Google Cloud Run (backend), GCS (report storage), Cloud SQL PostgreSQL, Firebase Auth

---

## 2. Problem Statement & Opportunity

### Problem Definition

Intelligence analysts conducting open-source investigations currently face three core problems:

1. **Speed** — Manual searches across news, social, corporate, and OSINT databases take hours per investigation. Source cross-referencing and citation tracking are done by hand.
2. **Consistency** — Report quality depends entirely on the individual analyst. There is no structured pipeline that enforces a standard output format, confidence grading, or source verification.
3. **Tooling fragmentation** — Analysts use a patchwork of standalone tools (news search, mapping, people search, dark web monitors) with no unified workflow or audit trail.

### Opportunity Analysis

- Enterprise intelligence, risk, and compliance teams need actionable investigation outputs on tight deadlines.
- No existing SaaS product combines AI research orchestration, analyst-controlled HITL review, source grading, and geospatial rendering in a single workflow.
- Sidney's pipeline model can be adapted to new data sources (DarkOwl, Pipl, social APIs) as plug-in integrations, expanding TAM without rebuilding core infrastructure.

### Success Criteria

| Metric                                           | Target                                            |
| ------------------------------------------------ | ------------------------------------------------- |
| Time from query to report                        | < 10 minutes (MVP)                                |
| Analyst approval of report quality (user survey) | ≥ 80% "good" or "excellent"                       |
| Source citation accuracy                         | 100% of inline citations resolve to a real source |
| NorthQuay beta retention after 30 days           | ≥ 70% of users run ≥ 2 investigations/week        |

---

## 3. User Requirements & Stories

### Primary User Personas

**Persona 1 — The Intelligence Analyst**

- Role: Produces investigation reports for clients or internal stakeholders
- Goal: Fast, sourced, consistent outputs that can be shared without editing
- Pain point: Spends 60–80% of investigation time on search and manual compilation, not analysis
- Success: Submits a query, reviews and steers the AI plan, approves sources, and exports a report that meets house style within one working session

**Persona 2 — The Security/Risk Manager**

- Role: Oversees investigations and approves reports before distribution
- Goal: Confidence that reports are accurate, graded, and auditable
- Pain point: No visibility into how reports were produced or which sources were used
- Success: Can inspect the source list, see confidence ratings, and export to PDF for distribution

**Persona 3 — The Platform Administrator (enterprise)**

- Role: Manages user access, teams, and usage budgets
- Goal: Multi-tenant isolation, usage tracking, onboarding control
- Pain point: Current tools have no enterprise access control or spend visibility
- Success: Can provision users, assign them to projects/teams, and monitor API usage

### Core User Stories

#### Epic 1 — Investigation Pipeline

| Story                                                                                                                                   | Acceptance Criteria                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| As an analyst, I want to enter a plain-language query and have the AI produce an investigation plan I can review before research begins | Plan is displayed inline in the chat interface; analyst can edit or approve before the next stage runs |
| As an analyst, I want to review and add to the sources found by the research agent before the report is written                         | Source list is shown with title, URL, and summary; analyst can add additional URLs                     |
| As an analyst, I want to confirm the report format before writing begins                                                                | Format confirmation step shows section structure and source count; analyst can approve or cancel       |
| As an analyst, I want the final report to use the original query as its title                                                           | Report title = original query string, not an LLM-generated summary                                     |

#### Epic 2 — Report Management

| Story                                                                                    | Acceptance Criteria                                                                                |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| As an analyst, I want every completed investigation saved automatically to my case files | Case file created with correct report ID, query as subject, and `isReport` flag for export routing |
| As an analyst, I want to export any report as a PDF                                      | PDF fetches the stored report from GCS; contains all sections, citations, and metadata             |
| As an analyst, I want to browse my case files and open any previous investigation        | Case files list shows subject, date, category; clicking opens the full report                      |

#### Epic 3 — Source Grading

| Story                                                                         | Acceptance Criteria                                                                   |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| As an analyst, I want each source rated by reliability                        | Rating draws on RSF press freedom index, site rank, language, and publication recency |
| As an analyst, I want to click through to the original source from the report | Every citation has a working hyperlink to the original article URL                    |

#### Epic 4 — Geospatial

| Story                                                                                             | Acceptance Criteria                                                                         |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| As an analyst, I want significant locations from the investigation rendered on an interactive map | Writer agent extracts geocoordinates; map renders via Mapbox with entity labels and context |

#### Epic 5 — Authentication & Multi-tenancy

| Story                                                          | Acceptance Criteria                                                                       |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| As a user, I want to sign up, log in, and log out securely     | Firebase Auth with email/password; JWT passed to backend for all protected routes         |
| As an admin, I want my team's data isolated from other tenants | All data (case files, reports) scoped to Firebase UID and team ID; no cross-tenant access |

---

## 4. Functional Requirements

### Must Have (MVP)

| Feature                            | Description                                                                                       | Acceptance Criteria                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Conversational query interface** | Chat UI where analysts enter investigation queries in natural language                            | Query submitted, SSE stream opens, stages shown in real time                                               |
| **Three-stage AI pipeline**        | Planning → Research → Writer, each with HITL review before proceeding                             | Each stage fires only after analyst approval; cancellation at any stage halts cleanly                      |
| **Inline HITL review**             | After each agent, the analyst sees output inline in the chat stream (not a modal)                 | Plan shown as editable text; sources shown as list with add-URL input; format confirmation as summary card |
| **AskNews research integration**   | Research agent queries AskNews for recent news articles relevant to the plan                      | Articles returned with title, URL, summary, publication date, country code                                 |
| **Structured JSON report**         | Writer agent produces a structured JSON file with sections, citations, geolocations, and metadata | `metadata`, `report`, `entities`, `geolocations`, `sources` all present and valid                          |
| **Report title = original query**  | Report title is the analyst's original query, not an LLM-generated string                         | `metadata.title` overwritten with task string after write                                                  |
| **GCS report storage**             | Reports stored in Google Cloud Storage at `{uid}/{report_id}.json`                                | Upload occurs post-write; path returned in SSE `completed` event                                           |
| **Case file management**           | Auto-save completed investigations to case files with correct report ID                           | `caseNumber` = actual GCS file stem; `isReport: true` in messages for correct export routing               |
| **PDF export**                     | Download any case file report as a PDF                                                            | Fetches JSON from GCS; renders all sections with citations; saves as file                                  |
| **Firebase authentication**        | Sign up / log in / log out                                                                        | JWT verified on all backend routes; team provisioning on first login                                       |
| **Geospatial map rendering**       | Locations extracted by writer agent rendered on interactive map                                   | Mapbox map displayed in report view with pins and context labels                                           |

### Should Have

| Feature                       | Description                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| **DarkOwl integration**       | Dark web monitoring data as an additional research source (trial begins April 2026)     |
| **Pipl integration**          | People search API for person-of-interest investigations                                 |
| **Word export**               | Download report as a `.docx` file in addition to PDF                                    |
| **Custom report templates**   | Analysts can upload a house-style template that the writer agent formats output against |
| **Source confidence grading** | Per-source rating shown in the report, derived from RSF index, site rank, and recency   |
| **Social media data**         | X, Telegram, Bluesky posts surfaced chronologically in relevant investigations          |
| **Usage logging**             | Per-user API call and hosting spend tracked for billing and capacity planning           |

### Could Have

| Feature                           | Description                                                                                         |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Prompt injection defence**      | Input sanitisation and monitoring to prevent adversarial queries manipulating the pipeline          |
| **Agent observability dashboard** | LangSmith or equivalent tracing visible to platform admins                                          |
| **Follow-up questions**           | Analyst can ask follow-up questions against an existing report without re-running the full pipeline |
| **Multi-language queries**        | Pipeline accepts queries in any language; reports produced in English                               |

### Won't Have (this version)

- Real-time collaborative editing of reports
- Automated report distribution / email delivery
- Mobile application

---

## 5. Technical Requirements

### Architecture

```
User (browser)
  └── React/TypeScript SPA (Vite, port 4567)
        └── FastAPI backend (Python, port 8080, Cloud Run)
              ├── Firebase Admin SDK — auth token verification
              ├── asyncio subprocess → investigate_runner.py
              │     └── LangGraph pipeline (flow.py)
              │           ├── planning-agent  (create_react_agent + Gemini)
              │           ├── research-agent  (create_react_agent + AskNews tool)
              │           └── writer-agent    (create_react_agent + write_report tool)
              ├── SSE stream → frontend event queue
              ├── PostgreSQL (Cloud SQL, Prisma ORM) — users, teams, case files
              └── GCS — report JSON storage ({uid}/{report_id}.json)
```

### API Endpoints

| Method                | Path                                      | Description                                                                    |
| --------------------- | ----------------------------------------- | ------------------------------------------------------------------------------ |
| `POST`                | `/investigate`                            | Start an investigation subprocess; returns `thread_id`                         |
| `GET`                 | `/investigate/{thread_id}/stream`         | SSE stream of progress, HITL, completed, error events                          |
| `POST`                | `/investigate/{thread_id}/decision`       | Submit analyst HITL decision (`approved`, `edited_content`, `additional_urls`) |
| `DELETE`              | `/investigate/{thread_id}`                | Cancel (SIGKILL) an active investigation                                       |
| `GET`                 | `/reports/{report_id}`                    | Fetch parsed report from GCS or local filesystem                               |
| `GET`                 | `/reports/`                               | List all reports for the authenticated user                                    |
| `GET/POST/PUT/DELETE` | `/case-files/`, `/folders/`, `/projects/` | Case file and workspace management                                             |

### SSE Event Protocol

```
PROGRESS:{agent_name}       → { type: "progress", agent: string }
HITL:{json}                 → { type: "hitl", agent, content_type, content, sources?, editable }
RESULT:{json_path}          → (internal; triggers completed event)
COMPLETED                   → { type: "completed", report_id, storage_path }
ERROR:{message}             → { type: "error", detail: string }
```

### HITL Decision Schema

```json
{
  "approved": true,
  "edited_content": "Optional analyst-edited plan text",
  "additional_urls": ["https://..."]
}
```

### Data Model (Prisma)

```
User         — firebaseUid, email, team
Team         — id, name
CaseFile     — id, teamId, caseNumber (= GCS file stem), subject, messages, category, createdAt
Folder       — id, teamId, name
Project      — id, teamId, name, description
```

### Performance Requirements

| Requirement                             | Target                              |
| --------------------------------------- | ----------------------------------- |
| End-to-end investigation (simple query) | < 3 minutes                         |
| SSE heartbeat interval                  | 15 seconds                          |
| HITL decision timeout                   | 5 minutes (auto-approve on timeout) |
| Report JSON size                        | < 500 KB                            |
| Research summary passed to writer       | Capped at 80,000 characters         |
| Concurrent investigations per instance  | ≥ 10 (subprocess-isolated)          |

### Security Requirements

- All API routew protected by Firebase JWT verification (`verify_token` dependency)
- Reports scoped to authenticated UID; no cross-tenant GCS path access
- Subprocess isolation: each investigation runs in a separate OS process killable by `SIGKILL`
- No raw SQL; all DB access via Prisma ORM
- Environment secrets via Cloud Run secret manager (never committed)
- Prompt injection defence: planned for post-MVP (Harry & Elsa)

---

## 6. User Experience Requirements

### Design Principles

- **Analyst-first:** Every interaction should feel like augmenting the analyst's judgment, not replacing it. The HITL steps are features, not friction.
- **Progressive disclosure:** The investigation progress is shown in real time with human-readable stage labels. Technical details (model names, API calls) are hidden.
- **Inline, not modal:** Review steps appear in the chat stream, preserving conversational context. No overlay pop-ups that interrupt flow.
- **Dark, focused UI:** Low-contrast dark theme (midnight/navy palette) appropriate for high-focus analytical work.

### Interface Requirements

| Component                | Requirement                                                                      |
| ------------------------ | -------------------------------------------------------------------------------- |
| Chat interface           | Single-column, streaming message list; query input pinned at bottom              |
| HITL plan review         | Editable textarea pre-filled with AI plan; Approve / Edit buttons                |
| HITL source review       | Scrollable source list (title + URL + 200-char summary); text input to add URLs  |
| HITL format confirmation | Summary card showing section list and source count; Confirm / Cancel             |
| Loading states           | Stage-specific cycling text labels (e.g. "Geocoding identified locations…")      |
| Report view              | Sections rendered as markdown; inline citation numbers; Mapbox map; source table |
| Case files list          | Sortable table with subject, date, category, case number; open / delete actions  |
| PDF export               | Triggers immediately; no preview required; saved to Downloads                    |

### Accessibility

- All interactive elements keyboard-navigable
- Sufficient colour contrast (WCAG AA minimum) on all text
- Loading states announce progress to screen readers via `aria-live`

---

## 7. Non-Functional Requirements

### Reliability

| Requirement                    | Target                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------- |
| Service uptime                 | 99.5% (Cloud Run auto-restart)                                                  |
| Investigation subprocess crash | Parent process detects via non-zero exit code; SSE `error` event sent to client |
| GCS upload failure             | Logged; case file still created in DB; analyst notified via toast               |
| HITL queue timeout             | Auto-approve after 5 minutes; logged as warning                                 |

### Scalability

- Cloud Run scales to zero when idle; scales horizontally under load
- Each investigation is stateless within its subprocess; no shared in-process state between users
- GCS report storage scales without capacity planning
- PostgreSQL connection pooling required before exceeding ~50 concurrent users

### Compliance & Data

- User data (Firebase UID, email, case file content) stored in EU/UK region where required by customers
- Reports are user-generated content; platform does not claim ownership
- GDPR readiness: user data deletion path via `DELETE /case-files/{id}` and GCS lifecycle rules
- Audit trail: `createdAt` timestamps on all DB records; GCS object metadata records upload time

---

## 8. Success Metrics & Analytics

### Key Performance Indicators

| KPI                                  | Definition                                                   | Target (3 months post-launch) |
| ------------------------------------ | ------------------------------------------------------------ | ----------------------------- |
| Investigations completed             | Count of SSE `completed` events                              | 500/month                     |
| HITL approval rate                   | % of stages approved (not cancelled)                         | ≥ 85%                         |
| Report export rate                   | % of completed investigations exported as PDF                | ≥ 40%                         |
| Time-to-report                       | Median minutes from POST `/investigate` to `completed` event | < 8 min                       |
| API error rate                       | % of investigations ending in SSE `error`                    | < 5%                          |
| Weekly active users (NorthQuay beta) | Users running ≥ 1 investigation in rolling 7 days            | ≥ 70% of provisioned seats    |

### Analytics Implementation

- All SSE event types logged server-side with `thread_id`, `uid`, `timestamp`
- LangSmith tracing for agent observability (optional, `LANGSMITH_API_KEY`)
- Usage logging for API spend tracking (AskNews, Gemini, GCS) — built in early per roadmap
- No third-party analytics on the frontend in MVP (privacy-first default)

---

## 9. Implementation Plan

### Phase 1 — MVP (current / April 2026)

| Item                                                    | Owner        | Status      |
| ------------------------------------------------------- | ------------ | ----------- |
| Three-stage pipeline with HITL                          | Elsa         | Done        |
| AskNews research integration                            | Harry/Elsa   | Done        |
| GCS report storage                                      | Elsa         | Done        |
| Case file DB (Cloud SQL + Prisma)                       | Elsa         | Done        |
| PDF export from GCS                                     | Elsa         | In progress |
| DevOps pipeline (build–test–deploy)                     | Qasim & Elsa | In progress |
| Multi-tenant data segregation                           | Qasim & Elsa | In progress |
| Report output quality — consistent geopolitical reports | Team         | In progress |
| RAG pipeline — custom report formatting                 | Elsa         | In progress |

### Phase 2 — Beta (April–May 2026)

- NorthQuay beta onboarding
- DarkOwl integration (trial kick-off early April)
- Pipl people-search integration
- Authentication & access control hardening (Keycloak / Auth0 / GCP IAP)
- Integration & stress testing
- Prompt injection defence

### Phase 3 — General Availability

- Word export
- Custom report templates
- Social media data (X, Telegram, Bluesky)
- Source confidence grading
- Security & penetration testing sign-off
- Customer onboarding workflow

---

## 10. Risk Assessment & Mitigation

| Risk                                                             | Probability | Impact   | Mitigation                                                                                                                                                                       |
| ---------------------------------------------------------------- | ----------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LLM output quality inconsistency (garbled or incomplete reports) | High        | High     | HITL review at every stage lets analysts catch and re-run; research summary capped at 80k chars to avoid Gemini API errors; continuous test suite against representative queries |
| AskNews returning zero/poor results for niche queries            | Medium      | High     | Research agent instructed to widen queries and retry; HITL source review lets analysts add URLs manually                                                                         |
| Gemini API rate limits or cost overrun                           | Medium      | Medium   | `n_articles` capped at 10 per search call; research summary truncated; monitor spend via usage logging                                                                           |
| GCS report not found on PDF export                               | Low (fixed) | High     | `caseNumber` now stores real GCS file stem; `isReport: true` flag routes export to GCS fetch path                                                                                |
| Prompt injection via malicious queries                           | Medium      | High     | Currently mitigated by subprocess isolation; dedicated defence research planned (Harry & Elsa, Phase 2)                                                                          |
| Multi-tenant data leak                                           | Low         | Critical | Reports stored under `{uid}/` prefix; backend verifies UID from JWT on every request; no cross-UID path construction                                                             |
| NorthQuay beta dissatisfaction with report style                 | Medium      | High     | RAG pipeline for custom templates in progress; early demo with stakeholders before beta cut-off                                                                                  |
| Cloud Run cold starts causing timeout on first investigation     | Low         | Medium   | Minimum instance count = 1 in production; subprocess spawned from warm process                                                                                                   |

---

## Quality Checklist

- [x] Problem is clearly defined with evidence
- [x] Solution aligns with user needs and business goals
- [x] Requirements are specific and measurable
- [x] Acceptance criteria are testable
- [x] Technical feasibility validated (system is already running)
- [x] Success metrics are defined and trackable
- [x] Risks are identified with mitigation plans
- [ ] Stakeholder alignment confirmed (pending NorthQuay review)
