# IMDb export refresh via Playwright (local machine only)

**Do not use this path on Railway, Docker production images, or any host where you only install `requirements.txt`.**

Playwright and Chromium are **not** part of the normal backend dependency set. The backend `Dockerfile` runs `pip install -r requirements.txt` only. Optional browser automation is installed explicitly via `requirements-imdb-browser.txt` on a **developer workstation** when you want to drive IMDb’s logged-in **Export** UI.

**Railway / unattended refresh:** use `refresh_imdb_public_scrape` + `cron_sync_imdb` as described in [imdb-export-sync.md](imdb-export-sync.md) (HTTP scrape; best-effort).

---

## Why keep this at all?

IMDb does not offer a stable authenticated HTTP API for the same CSVs as the Export button. Playwright can reuse a saved session and download exports **locally**, after which you can copy `data/imdb/*.csv` into place or sync via your usual workflow.

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

- Point `cron_sync_imdb` at the same `data/imdb/` on that machine, **or**
- Copy the CSVs to another environment and run sync there, **or**
- Use admin import / `sync_remote.sh` as you do today.

## Reliability

Refresh is **fragile** if IMDb changes UI, adds captchas on login, or the session expires—re-run `imdb_playwright_save_storage` and prefer a headed test (`--headed`) when something breaks.
