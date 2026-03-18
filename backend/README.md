# TasteGraph API

FastAPI backend. Runs on port 8000.

```bash
pip install -r requirements.txt
cp .env.example .env   # optional
uvicorn app.main:app --reload --port 8000
```

Docs: http://localhost:8000/docs

## Migrations

```bash
alembic upgrade head    # apply migrations
alembic revision --autogenerate -m "description"   # create new migration
```
