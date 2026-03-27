# IMDb export → TasteGraph sync

TasteGraph ingests **CSV exports** from IMDb (manual **Export** while logged in is the most reliable source). An optional **public HTTP scrape** can regenerate those CSVs for cron; see **Public scrape refresh** below for limits and safety behavior.

## What to download on IMDb

| TasteGraph table | IMDb source | Typical export |
|------------------|-------------|----------------|
| **Ratings** | Your ratings | Ratings page → menu → **Export** → CSV |
| **Watchlist** | Watchlist | Watchlist → menu → **Export** → CSV |
| **Favorite list** (curated titles) | A **list** you maintain (e.g. public list URL) | Open the list → **Export** → CSV |
| **Favorite people** | Favorite people | That page → **Export** → CSV (or a simple `name,role` file you maintain) |

Exports usually include a header row with columns such as **Const** (title id `tt…`), **Position**, **Title**, **Your Rating**, **Date Rated**, etc. Formats are detected automatically where multiple layouts exist (e.g. ratings “rich” vs minimal export).

## Semantics

| Import | Default CLI / old behavior | **Sync** scripts / `mirror=true` |
|--------|----------------------------|----------------------------------|
| **Ratings** | Insert-only, or upsert with `--upsert` | **Mirror**: upsert from file + **delete** ratings not in CSV |
| **Watchlist** | Upsert only (no deletes) | **Mirror**: upsert + **delete** rows not in CSV |
| **Favorite list** | Always **mirror** | Same |
| **Favorite people** | Always **mirror** | Same |

**Mirror** = the database table for that source is meant to **match the export file** after the run.

## One-shot commands (from `backend/`)

Point each `--csv` at the file you just downloaded (rename/move as you like).

```bash
cd backend

python -m app.scripts.sync_imdb_ratings --csv /path/to/ratings.csv
python -m app.scripts.sync_imdb_watchlist --csv /path/to/watchlist.csv
python -m app.scripts.sync_imdb_favorite_list --csv /path/to/your_list_export.csv
python -m app.scripts.sync_imdb_favorite_people --csv /path/to/favorite_people.csv
```

## Batch: standard filenames in one folder

If you copy exports into a single directory using these names:

- `ratings.csv`
- `watchlist.csv`
- `favorite_list.csv`
- `favorite_people.csv`

(default layout: repo `data/imdb/` next to `backend/`)

```bash
cd backend
python -m app.scripts.sync_imdb_exports --data-dir ../data/imdb
```

Override individual files:

```bash
python -m app.scripts.sync_imdb_exports \
  --data-dir ../data/imdb \
  --favorite-list ~/Downloads/ls021795057.csv
```

Missing files are **skipped** (no error).

## Lower-level modules (same importers)

```bash
python -m app.imports.ratings /path/to/ratings.csv --upsert
python -m app.imports.ratings /path/to/ratings.csv --mirror

python -m app.imports.watchlist /path/to/watchlist.csv
python -m app.imports.watchlist /path/to/watchlist.csv --mirror
```

Default-path wrappers (optional `--mirror` / `--upsert`):

```bash
python -m app.scripts.import_ratings_default
python -m app.scripts.import_ratings_default --mirror
python -m app.scripts.import_watchlist_default --mirror
```

## Admin HTTP API (optional)

With `X-Admin-Import-Token`:

- `POST /admin/import/ratings?upsert=true&mirror=true`
- `POST /admin/import/watchlist?mirror=true`

Responses include `deleted` when mirror removes rows.

## Notes

- **Empty CSV + mirror** on ratings or watchlist will **clear** that table—use only with a deliberate full export.
- Favorite people **IMDb export** format is detected from columns (e.g. Name + Description / Known For); role is **inferred** (actor / director / writer). A simple CSV `name,role` is also supported.
- Automated download via cookies/URLs is fragile; prefer manual export. See `sync_imdb_favorite_list.py` docstring for an optional `curl` sketch.

## Cron: sync only when exports change

`cron_sync_imdb` stores a **SHA-256 per CSV** under `backend/data/sync/imdb_cron_state.json` (by default). On each run:

| Step | When it runs |
|------|----------------|
| Hash each present file in `--data-dir` | **Every run** |
| Compare to state | **Every run** |
| Mirror **import** for a source | Only if that file’s hash **changed** (or first run) |
| **OMDb enrichment** (bounded batch) | If any import ran this run, or if `--enrich-if-unchanged` |
| **Embeddings** (`generate_title_embeddings`) | Only if `--embeddings` **and** at least one import ran |
| **ML training** (`train_8plus_baseline`) | Only if `--train-ml` (heavy; use a separate rare schedule) |

If **no** CSV changed and you did not pass `--enrich-if-unchanged`, the script exits quickly after updating state for **missing** files (drops stale hash keys).

### Recommended schedules

1. **Often** (e.g. hourly): drop fresh IMDb exports into `data/imdb/` with standard names, then:

   ```bash
   cd /path/to/tastegraph/backend && /path/to/venv/bin/python -m app.scripts.cron_sync_imdb
   ```

2. **Occasionally** (e.g. weekly) to drain metadata backlog without new CSVs:

   ```bash
   python -m app.scripts.cron_sync_imdb --enrich-if-unchanged --enrich-limit 25
   ```

3. **Rarely**: after meaningful library changes, optionally add `--embeddings` to the job that already saw imports, or run `generate_title_embeddings` manually. Run `train_8plus_baseline` on its own cadence (e.g. monthly), not every import.

### Flags (see `--help`)

- `--dry-run` — print what would happen; no DB or state writes  
- `--skip-enrich` — imports only (not recommended for normal cron)  
- `--enrich-limit N` — cap OMDb calls per run (default 30)  
- `--embeddings` — subprocess embedding rebuild **only when imports ran**  
- `--train-ml` — subprocess ML train (optional; slow)

### Failure behavior

- If an **import** raises, the script exits **1** after logging; hashes for sources **not** yet updated this run stay old so the next cron **retries** the same file. Successfully imported sources already have new hashes saved.

### Operational assumption

By default the cron job only reads local CSVs. **On Railway (or any production image),** refresh CSVs with **`refresh_imdb_public_scrape`** (HTTP; see below), then `cron_sync_imdb`. **Playwright is local-only** and is not installed from `requirements.txt`; see [imdb-playwright-local-only.md](imdb-playwright-local-only.md) if you use a browser on your laptop to run Export.

---

## Public scrape refresh (Railway, no browser)

For **unattended** jobs without Chromium, `refresh_imdb_public_scrape` fetches **public** URLs with HTTP and writes the same filenames under `data/imdb/`. `cron_sync_imdb` remains the downstream mirror import + enrich.

### Limitations (important)

- IMDb often serves **client-rendered** HTML or **empty shells** to datacenter IPs; responses may contain **no `tt…` ids**, so validation fails and **no CSV is replaced** (by design).
- Layout and embedded JSON change without notice; extraction is **heuristic**.
- **Ratings** are only written if this scraper can infer a **numeric 1–10 rating for every extracted title** on the page. If not, it **skips** `ratings.csv` so mirror sync cannot **wipe** scores with blanks.

### Environment

| Output file | Variable |
|-------------|----------|
| `favorite_list.csv` | `IMDB_SCRAPE_LIST_URL` |
| `watchlist.csv` | `IMDB_SCRAPE_WATCHLIST_URL` |
| `ratings.csv` | `IMDB_SCRAPE_RATINGS_URL` |
| `favorite_people.csv` | `IMDB_SCRAPE_FAVORITE_PEOPLE_URL` |

Optional guards: `IMDB_SCRAPE_MIN_FAVORITE_LIST`, `IMDB_SCRAPE_MIN_WATCHLIST`, `IMDB_SCRAPE_MIN_RATINGS`, `IMDB_SCRAPE_MIN_FAVORITE_PEOPLE` (absolute minimum row counts); `IMDB_SCRAPE_MIN_DROP_RATIO` (default `0.5`); `IMDB_SCRAPE_PREV_MIN_FOR_RATIO`; `IMDB_SCRAPE_USER_AGENT`.

Last accepted counts are stored in `data/imdb/.scrape_refresh_state.json` (gitignored).

### Safety behavior

- **Too few rows** vs configured minimum → error, **no** write for that source.
- **Large drop** vs last accepted count (ratio guard) → error, **no** write.
- **Tiny or empty HTTP body** → error, **no** write.
- Successful writes use a temp `*.csv.part` file and **atomic replace** of the target CSV.
- Failed sources leave the **previous** CSV on disk, so the next `cron_sync_imdb` sees an **unchanged hash** and does **not** mirror-clear that table.

### Full cron pipeline (Railway)

From the `backend` directory (adjust venv path):

```bash
cd /path/to/tastegraph/backend && /path/to/venv/bin/python -m app.scripts.refresh_imdb_public_scrape && /path/to/venv/bin/python -m app.scripts.cron_sync_imdb
```

Using `&&` means a scrape failure exits non-zero and **skips** sync for that run (DB untouched). To always attempt sync, use `;` instead (usually **not** recommended if you rely on scrape for CSV freshness).

---

## Local-only: Playwright + Export button

**Not for Railway.** The backend ships without Playwright; production images install **`requirements.txt` only**.

To drive IMDb’s logged-in **Export** flow on your **own computer**, install the optional browser stack and follow [imdb-playwright-local-only.md](imdb-playwright-local-only.md).
