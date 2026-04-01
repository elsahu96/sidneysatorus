# Claude Code Rules

## Working Principles

## 1. Plan Mode Default

- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy

- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. PLZ Don't Make Errors, PLZ PLZ, The CTO Is Gonna Kill Me

- The CTO has a spreadsheet. Your mistakes are on it. My name is turning red. PLZ.
- If you make the same mistake twice, update tasks/lessons.md

### 4. Demand Elegance (Balanced)

- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes | don't over-engineer
- Challenge your own work betore presenting it

### 5. Autonomous Bug Fixing

- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests B then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

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
5. DeepAgent runs 3 LangGraph sub-agents in sequence:
   - **planning-agent**: breaks the query into search strategies
   - **research-agent**: searches via AskNews (`tools/asknews.py`)
   - **writer-agent**: structures a Markdown report via `tools/writer.py`
6. Report is stored in GCS (prod) or local filesystem (dev) via `config.py` storage factory
7. Frontend polls `/report` endpoints and renders the result

### Key Backend Files

| File                                 | Role                                                         |
| ------------------------------------ | ------------------------------------------------------------ |
| `src/api/main.py`                    | FastAPI app, CORS, router registration                       |
| `src/api/investigate.py`             | Investigation endpoint, subprocess management                |
| `src/service/investigate_service.py` | Orchestrates DeepAgent, handles HITL flow                    |
| `src/graph/flow.py`                  | LangGraph DeepAgent creation and orchestration               |
| `src/graph/agents.py`                | SubAgent definitions (planning, research, writer, asknews)   |
| `src/graph/tools/`                   | Tool implementations: `asknews.py`, `writer.py`              |
| `src/config.py`                      | Storage backend factory (GCS vs local)                       |
| `src/service/storage_service.py`     | Report storage abstraction                                   |
| `prisma/schema.prisma`               | Database schema (User, Team, CaseFile, ChatSession, Message) |

### Key Frontend Files

| File                                         | Role                                   |
| -------------------------------------------- | -------------------------------------- |
| `src/App.tsx`                                | Router, auth guards, context providers |
| `src/pages/CaseFiles.tsx` / `CaseDetail.tsx` | Core case management UI                |
| `src/components/ChatInterface.tsx`           | Main investigation chat UI             |
| `src/components/InvestigationReport.tsx`     | Report rendering                       |
| `src/api/investigateApi.ts`                  | Backend API client                     |
| `src/contexts/CaseFilesContext.tsx`          | Case files global state                |

### Storage

- **Database**: PostgreSQL via Prisma ORM (Python client)
- **Files/Reports**: Google Cloud Storage (prod) or local filesystem (dev), selected in `src/config.py`
- **Auth**: Firebase (frontend) + Firebase Admin (backend)

## Environment Variables

Copy `backend/.env.example` to `backend/.env`. Key vars:

```
DATABASE_URL                  # Cloud SQL connection string (see .env.example)
GEMINI_API_KEY                # Google Gemini LLM
GEMINI_MODEL_NAME             # e.g. google_genai:gemini-3-flash-preview
ASKNEWS_API_KEY               # AskNews search API
GCS_BUCKET                    # Google Cloud Storage bucket (prod)
GOOGLE_CLOUD_PROJECT          # GCP project ID (Firebase token verification)
GOOGLE_APPLICATION_CREDENTIALS  # Path to GCP service account JSON
LANGSMITH_API_KEY             # LangSmith tracing (optional)
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
