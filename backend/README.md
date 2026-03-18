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
# From backend directory, defaults to ../data/imdb/user_ratings_raw.csv
python -m app.scripts.import_ratings_default

# Or with custom path
python -m app.scripts.import_ratings_default path/to/ratings.csv
```

## Title metadata

The `title_metadata` table stores enrichment data keyed by `imdb_title_id`. It is populated later from external sources (e.g. IMDb API, TMDB). No external fetch code yet.

Import from CSV (columns: imdb_title_id, title, title_type, year, genres, runtime_mins, release_date, directors, imdb_rating, num_votes, url):

```bash
# Defaults to ../data/imdb/title_metadata.csv
python -m app.scripts.import_metadata_default

# Or with custom path
python -m app.scripts.import_metadata_default path/to/metadata.csv
```
