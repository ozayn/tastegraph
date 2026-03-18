# TasteGraph API

FastAPI backend. Runs on port 8000.

```bash
pip install -r requirements.txt
cp .env.example .env   # load from backend/.env
uvicorn app.main:app --reload --port 8000
```

Docs: http://localhost:8000/docs

## Migrations

```bash
alembic upgrade head    # apply migrations
alembic revision --autogenerate -m "description"   # create new migration
```

## Import ratings

```bash
# From backend directory, after migrations
python -m app.imports.ratings path/to/ratings.csv
```
