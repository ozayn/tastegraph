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

| Variable       | Required | Description                                              |
|----------------|----------|----------------------------------------------------------|
| `DATABASE_URL` | Yes      | From Railway Postgres (auto when linked)                |
| `CORS_ORIGINS` | Yes      | Frontend URL, e.g. `https://yourapp.railway.app`         |
| `OMDB_API_KEY` | No       | Optional, for metadata enrichment                       |

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

### Order

1. Create Postgres
2. Deploy backend, link Postgres, set `CORS_ORIGINS` to your frontend URL (or `*` for testing)
3. Deploy frontend, set `NEXT_PUBLIC_API_URL` to your backend URL