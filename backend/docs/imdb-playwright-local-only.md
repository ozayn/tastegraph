# IMDb export refresh via Playwright (local machine only)

**Supported path for automated source refresh outside Railway.** Playwright and Chromium are **not** installed on Railway or in the production Docker image (`requirements.txt` only). Install them on a **developer machine** (or another external runner) via `requirements-imdb-browser.txt`.

**Railway** runs **downstream only**: `cron_sync_imdb`, metadata enrichment, optional embeddings/ML — after CSVs reach production via volume, `sync_remote.sh`, or admin import. See [imdb-export-sync.md](imdb-export-sync.md).

**Do not** rely on `refresh_imdb_public_scrape` for production; public HTTP scrape is experimental and is often blocked by IMDb.

---

## Why this path?

IMDb does not offer a stable authenticated HTTP API for the same CSVs as the Export button. Playwright reuses a saved session and downloads exports **locally**. You then copy `data/imdb/*.csv` into place, run `cron_sync_imdb` locally, or push to Railway with `sync_remote.sh`.

## One-time setup (local)

```bash
cd backend
pip install -r requirements-imdb-browser.txt
playwright install chromium
```

1. Save cookies after logging in interactively:

   ```bash
   python -m app.scripts.imdb_playwright_save_storage -o ../data/imdb/.playwright_storage_state.json
   ```

2. Tell the refresh script which pages to open. **Easiest:** set your IMDb user id and optional list id:

   ```bash
   export IMDB_REFRESH_USER_ID=ur12345678
   export IMDB_REFRESH_FAVORITE_LIST_ID=ls021795057
   ```

   Or set full URLs: `IMDB_REFRESH_RATINGS_URL`, `IMDB_REFRESH_WATCHLIST_URL`, `IMDB_REFRESH_FAVORITE_LIST_URL`, `IMDB_REFRESH_FAVORITE_PEOPLE_URL`.

   Optional JSON (merged with env; env wins):

   ```json
   {
     "user_id": "ur12345678",
     "favorite_list_id": "ls021795057",
     "exports": {
       "ratings": "https://www.imdb.com/user/ur12345678/ratings/"
     }
   }
   ```

3. Run refresh (writes `data/imdb/*.csv` next to `backend/`):

   ```bash
   python -m app.scripts.refresh_imdb_exports --config /path/to/imdb_refresh.json
   ```

   Debug UI: `--headed`. One source: `--only ratings`.

## After a local refresh

Typical flow:

1. **Local DB** — `cd backend && python -m app.scripts.cron_sync_imdb`
2. **Production (Railway)** — from repo root: `./scripts/sync_remote.sh` (or `--parity`), **or** admin CSV import, **or** copy CSVs to a Railway volume and run `cron_sync_imdb` there

Railway should **not** run `refresh_imdb_exports`; only the downstream sync step.

## Reliability

Refresh is **fragile** if IMDb changes UI, adds captchas on login, or the session expires—re-run `imdb_playwright_save_storage` and prefer a headed test (`--headed`) when something breaks.
