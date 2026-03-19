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

Supports two CSV formats. **Rich format** (ratings.csv) is preferred — includes metadata.

**Rich format:** Const, Your Rating, Date Rated, Title, Title Type, Year, Genres, IMDb Rating, Runtime (mins), Num Votes, Release Date, Directors, URL

**Raw format:** Title ID, Rating, Last Modified Date

```bash
# Defaults to ../data/imdb/ratings.csv
python -m app.scripts.import_ratings_default

# Or with custom path
python -m app.scripts.import_ratings_default path/to/ratings.csv
```

## Title metadata

The `title_metadata` table stores enrichment data keyed by `imdb_title_id`. OMDb can fetch metadata for a single title:

```bash
python -m app.scripts.fetch_one_metadata tt1234567
```

To fetch and upsert into the database:

```bash
python -m app.scripts.enrich_one_title tt0111161
```

To enrich a small batch of ratings and watchlist titles missing or incomplete in metadata (default 10):

```bash
python -m app.scripts.enrich_missing_metadata
python -m app.scripts.enrich_missing_metadata 25
```

Also backfills existing rows with incomplete fields (poster, actors, plot, rated, metascore). Titles that failed OMDb enrichment within the last 7 days are skipped by default; use `--retry-failed` to include them. Requires `OMDB_API_KEY` in `backend/.env`. Optional `OMDB_API_KEY_FALLBACK` retries on key/quota/rate-limit errors. Outputs JSON (fetch), success/failure message (enrich one), or summary counts (enrich batch).

Import from CSV (columns: imdb_title_id, title, title_type, year, genres, runtime_mins, release_date, directors, imdb_rating, num_votes, url):

```bash
# Defaults to ../data/imdb/title_metadata.csv
python -m app.scripts.import_metadata_default

# Or with custom path
python -m app.scripts.import_metadata_default path/to/metadata.csv
```

## Watchlist

Import from IMDb watchlist export (watchlist.csv). Columns: Position, Const, Created, Modified, Title, Title Type, Year, Your Rating, Date Rated.

```bash
python -m app.scripts.import_watchlist_default
```
