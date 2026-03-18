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