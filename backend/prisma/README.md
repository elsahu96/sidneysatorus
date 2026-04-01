# Prisma Python CLI

Run these from the **backend** directory (`cd backend`). Ensure `DATABASE_URL` is set in `.env`.

**Note:** Prisma is an ORM that connects to a database; it does not run a database server. You need a running PostgreSQL (or MySQL/SQLite) instance. Set `DATABASE_URL` in `backend/.env` to point to it.

## Running a local PostgreSQL database

Use one of these options so Prisma can connect locally.

### Option A: Docker (recommended)

```bash
docker run -d --name sidney-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=sidney \
  -p 5432:5432 \
  postgres:16-alpine
```

Then in `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sidney
```

### Option B: Homebrew (macOS)

```bash
brew install postgresql@16
brew services start postgresql@16
# Create database
createdb sidney
```

Then in `backend/.env` (replace `your_username` with your macOS username, or use `postgres:password` if you set one):

```env
DATABASE_URL=postgresql://your_username@localhost:5432/sidney
```

### Option C: GCP Cloud SQL

Use the Cloud SQL Auth Proxy (see main CLAUDE.md for setup). Set `DATABASE_URL` in `.env` to the local proxy URL:

```env
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5433/ai_sidney_staging
```

---

## Generate Prisma Client (Python) after schema changes

```bash
cd backend
prisma generate
```

## Push schema to the database (no migration files; good for local/prototyping)

```bash
cd backend
prisma db push
```

## Create a new migration (for production-style workflows)

```bash
cd backend
prisma migrate dev --name description_of_changes
```

## View database in Prisma Studio

```bash
cd backend
prisma studio
```

## Reset database (CAUTION: deletes all data)

```bash
cd backend
prisma migrate reset
```

## Seed with mock data

Seeds a demo User + Team plus Folders, Projects, CaseFiles, and ProjectDocuments. Run from the **backend** directory (ensure `DATABASE_URL` is set in `.env`):

```bash
cd backend
python prisma/seed.py
```

- **First run:** Creates a demo user (`demo@sidney.local` / firebase_uid `seed-demo-user-001`), a team, and mock folders, projects, case files, and documents.
- **Re-run:** Reuses the same demo user/team and adds more data (folders/projects/case files are created again).

To seed into an **existing team** (e.g. after you’ve signed in and have a team_id):

```bash
cd backend
TEAM_ID=<your-team-id> SEED_DEMO_USER=0 python prisma/seed.py
```

Get your `team_id` from the `/me` API response after logging in, or from Prisma Studio.

