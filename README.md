# TasteGraph

A personal AI-powered movie and series recommender based on IMDb ratings, watchlist data, mood, and platform preferences.

## MVP goals

- Import IMDb ratings
- Import IMDb watchlist
- Build a personal taste profile
- Recommend what to watch from:
  - all candidates
  - a platform like BritBox
  - my own watchlist
- Support natural-language queries like:
  - “What should I watch on BritBox?”
  - “What fits my mood from my watchlist?”
  - “Recommend a Persian romance movie from my watchlist.”

## Stack

- Frontend: Next.js
- Backend: FastAPI
- Database: PostgreSQL
- Vector search: pgvector
- Deployment: Railway
- LLM providers: Groq, Gemini, OpenRouter

## Run locally

```bash
make run      # Start backend + frontend (Ctrl+C stops both)
make stop     # Stop processes on ports 3000 and 8000
make status   # Check whether ports 3000 and 8000 are in use
```

- **Frontend:** http://localhost:3000
- **Backend:** http://localhost:8000

For separate logs, use `make run-backend` and `make run-frontend` in two terminals.

**Migrations + metadata enrichment (local):**

```bash
./scripts/enrich_metadata_local.sh
./scripts/enrich_metadata_local.sh 25
```

Runs `alembic upgrade head` and `enrich_missing_metadata`. Enriches TitleMetadata for rated titles and watchlist-only titles missing from metadata, and backfills existing rows with incomplete fields (poster, actors, plot, rated, metascore). Titles that failed within the last 7 days are skipped by default. Optional batch size (default 10). Requires `backend/.venv` and `OMDB_API_KEY` in `backend/.env`. Optional `OMDB_API_KEY_FALLBACK` retries on key/quota errors.

**Remote metadata enrichment (Railway):**

```bash
./scripts/enrich_metadata_remote.sh
./scripts/enrich_metadata_remote.sh 50
```

Runs `enrich_missing_metadata` on Railway against the deployed database. Populates TitleMetadata (country, languages, genres, etc.) via OMDb. Requires Railway CLI (`railway link`), `OMDB_API_KEY` set on Railway backend.

## Docker (local development)

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000

## Railway deployment

Deploy frontend, backend, and Postgres as separate Railway services. Set the root directory per service.

### 1. Postgres

- Add **PostgreSQL** from Railway dashboard
- Railway sets `DATABASE_URL` automatically when you link it to the backend

### 2. Backend service

- **Root directory:** `backend`
- **Build command:** `pip install -r requirements.txt`
- **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Environment variables:**

| Variable            | Required | Description                                              |
|---------------------|----------|----------------------------------------------------------|
| `DATABASE_URL`      | Yes      | From Railway Postgres (auto when linked)                |
| `CORS_ORIGINS`      | Yes      | Frontend URL, e.g. `https://yourapp.railway.app`         |
| `ADMIN_IMPORT_TOKEN` | No     | Token for CSV import (X-Admin-Import-Token header)       |
| `OMDB_API_KEY`      | No       | Optional, for metadata enrichment                       |

- After deploy, run migrations: `alembic upgrade head` (via Railway shell or CLI)

### 3. Frontend service

- **Root directory:** `frontend`
- **Build command:** `npm install && npm run build`
- **Start command:** `npm run start -- -p $PORT`
- **Environment variables:**

| Variable                | Required | Description                                    |
|-------------------------|----------|------------------------------------------------|
| `NEXT_PUBLIC_API_URL`   | Yes      | Backend URL, e.g. `https://yourapp-backend.railway.app` |

- Set `NEXT_PUBLIC_API_URL` before building (it is inlined at build time)

### 4. Admin import (CSV sync to deployed backend)

Set `ADMIN_IMPORT_TOKEN` on the backend service. Use it in the `X-Admin-Import-Token` header when uploading CSVs.

**Local (backend on port 8000):**

```bash
curl -X POST http://localhost:8000/admin/import/ratings \
  -H "X-Admin-Import-Token: YOUR_TOKEN" \
  -F "file=@data/imdb/ratings.csv"

curl -X POST http://localhost:8000/admin/import/watchlist \
  -H "X-Admin-Import-Token: YOUR_TOKEN" \
  -F "file=@data/imdb/watchlist.csv"
```

**Deployed (Railway backend URL):**

```bash
curl -X POST https://YOUR-BACKEND.railway.app/admin/import/ratings \
  -H "X-Admin-Import-Token: YOUR_TOKEN" \
  -F "file=@data/imdb/ratings.csv"

curl -X POST https://YOUR-BACKEND.railway.app/admin/import/watchlist \
  -H "X-Admin-Import-Token: YOUR_TOKEN" \
  -F "file=@data/imdb/watchlist.csv"
```

Response: `{"inserted": N, "skipped": M, "errors": K}` (ratings) or `{"inserted": N, "updated": M, "errors": K}` (watchlist).

**Local scripts (self-contained, no sourcing):** Add `REMOTE_API_URL` and `ADMIN_IMPORT_TOKEN` to `.env.sync` or `.env` at project root. Then run:

```bash
./scripts/sync_remote.sh
```

Or import individually:

```bash
./scripts/import_remote.sh ratings
./scripts/import_remote.sh watchlist
```

Uses `data/imdb/ratings.csv` and `data/imdb/watchlist.csv` by default. Run from project root. Use `.env.sync` for sync vars (gitignored) to keep backend `.env` backend-only.

Local CLI scripts (`python -m app.imports.ratings`, `python -m app.imports.watchlist`) remain unchanged for local development.

### Order

1. Create Postgres
2. Deploy backend, link Postgres, set `CORS_ORIGINS` to your frontend URL (or `*` for testing)
3. Deploy frontend, set `NEXT_PUBLIC_API_URL` to your backend URL