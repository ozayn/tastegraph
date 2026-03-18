# TasteGraph API

FastAPI backend. Runs on port 8000.

```bash
pip install -r requirements.txt
cp .env.example .env   # load from backend/.env
uvicorn app.main:app --reload --port 8000
```

Docs: http://localhost:8000/docs

## Database check

```bash
python -m app.scripts.check_db
```

## Migrations

```bash
alembic upgrade head    # apply migrations
alembic revision --autogenerate -m "description"   # create new migration
```

## Import ratings

Raw IMDb ratings CSV expected columns: **Title ID**, **Rating**, **Last Modified Date**.

```bash
# From backend directory, after migrations
python -m app.imports.ratings path/to/user_ratings_raw.csv
```
