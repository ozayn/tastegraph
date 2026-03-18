# TasteGraph — Project Plan

## Overview

TasteGraph is a personal AI-powered movie and series recommender based on IMDb ratings, watchlist data, mood, and platform preferences.

## Monorepo Structure

```
tastegraph/
├── frontend/     # Next.js app (port 3000)
├── backend/      # FastAPI app (port 8000)
└── docs/         # Documentation
```

## MVP Phases

1. **Setup** — Monorepo, Next.js, FastAPI, PostgreSQL, pgvector
2. **Data import** — IMDb ratings and watchlist
3. **Taste profile** — Build personal profile from imported data
4. **Recommendations** — From candidates, platforms (e.g. BritBox), watchlist
5. **Natural-language queries** — Mood-based and platform-filtered recommendations

## Stack

- Frontend: Next.js
- Backend: FastAPI
- Database: PostgreSQL + pgvector
- Deployment: Railway
- LLM: Groq, Gemini, OpenRouter
