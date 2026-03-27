# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sidney is an OSINT (Open-Source Intelligence) investigation platform with a multi-agent AI backend (FastAPI + LangGraph) and a React/TypeScript frontend.

## Commands

### Backend

```bash
cd backend
uv sync --extra dev          # Install dependencies (uses uv, not pip)
uv run python run.py         # Start dev server (port 8080, auto-reload)
pytest                       # Run all tests
pytest tests/test_foo.py     # Run a single test file
ruff check .                 # Lint
ruff check --fix .           # Lint and auto-fix
```

### Frontend

```bash
cd frontend
npm install
npm run dev                  # Start dev server (port 4567)
npm run build                # Production build
npm run lint                 # ESLint
npm run test                 # Run Vitest once
npm run test:watch           # Vitest watch mode
```

### Local Full Stack

```bash
docker-compose up --build    # Runs backend (:8080) + frontend (:4567)
```

## Architecture

### Request Flow

1. User submits query via `ChatInterface.tsx`
2. Frontend POSTs to `/investigate` (proxied to backend:8080 in dev)
3. Backend spawns a subprocess to run `investigate_service.py` asynchronously
4. `investigate_service.py` invokes the **DeepAgent** orchestrator (`graph/flow.py`)
5. DeepAgent runs 4 LangGraph sub-agents in sequence:
   - **planning-agent**: breaks the query into search strategies
   - **research-agent**: searches via AskNews + OPoint tools
   - **asknews-agent**: fetches news articles
   - **writer-agent**: structures a Markdown report via `tools/writer.py`
6. Report is stored in GCS (prod) or local filesystem (dev) via `config.py` storage factory
7. Frontend polls `/report` endpoints and renders the result

### Key Backend Files

| File | Role |
|------|------|
| `src/api/main.py` | FastAPI app, CORS, router registration |
| `src/api/investigate.py` | Investigation endpoint, subprocess management |
| `src/service/investigate_service.py` | Orchestrates DeepAgent, handles HITL flow |
| `src/graph/flow.py` | LangGraph DeepAgent creation and orchestration |
| `src/graph/agents.py` | SubAgent definitions (planning, research, writer, asknews) |
| `src/graph/tools/` | Tool implementations: `asknews.py`, `opoint.py`, `writer.py` |
| `src/config.py` | Storage backend factory (GCS vs local) |
| `src/service/storage_service.py` | Report storage abstraction |
| `prisma/schema.prisma` | Database schema (User, Team, CaseFile, ChatSession, Message) |

### Key Frontend Files

| File | Role |
|------|------|
| `src/App.tsx` | Router, auth guards, context providers |
| `src/pages/CaseFiles.tsx` / `CaseDetail.tsx` | Core case management UI |
| `src/components/ChatInterface.tsx` | Main investigation chat UI |
| `src/components/InvestigationReport.tsx` | Report rendering |
| `src/api/investigateApi.ts` | Backend API client |
| `src/contexts/CaseFilesContext.tsx` | Case files global state |

### Storage

- **Database**: PostgreSQL via Prisma ORM (Python client)
- **Files/Reports**: Google Cloud Storage (prod) or local filesystem (dev), selected in `src/config.py`
- **Auth**: Firebase (frontend) + Firebase Admin / Supabase JWT (backend)

## Environment Variables

Copy `backend/.env.example` to `backend/.env`. Key vars:

```
DATABASE_URL           # PostgreSQL connection string
GEMINI_API_KEY         # Google Gemini LLM
GEMINI_MODEL_NAME      # e.g. google_genai:gemini-3-flash-preview
OPOINT_API_KEY         # OSINT search API
ASKNEWS_CLIENT_ID / ASKNEWS_CLIENT_SECRET
GCS_BUCKET             # Google Cloud Storage bucket (prod)
GOOGLE_APPLICATION_CREDENTIALS  # Path to GCP service account JSON
SUPABASE_URL / SUPABASE_JWT_SECRET
LANGSMITH_API_KEY      # LangSmith tracing (optional)
```

## Deployment

CI/CD runs via `.github/workflows/gar-build-push.yml` on push to `main` or `staging`:
- Builds Docker images → pushes to Google Artifact Registry → deploys to Cloud Run

The frontend Dockerfile is a multi-stage build (Node → Nginx); `VITE_BACKEND_URL` is injected at build time via `cloudbuild.yaml` substitutions.

## Database Migrations

```bash
cd backend
uv run prisma migrate dev    # Apply migrations in development
uv run prisma generate       # Regenerate Prisma client after schema changes
```
