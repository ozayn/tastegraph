# TasteGraph Runbook

Concise commands and workflows for local/dev/prod maintenance.

---

## 1. Local backend

| Task | Command |
|------|---------|
| Run migrations | `cd backend && ./.venv/bin/python -m alembic upgrade head` |
| Start backend | `make run-backend` or `cd backend && ./.venv/bin/uvicorn app.main:app --reload --port 8000` |
| Health check | `curl http://localhost:8000/health` |

**Port 8000:** If already in use, run `make stop` or `lsof -ti:8000 \| xargs kill`. Backend defaults to 8000.

---

## 2. Metadata enrichment

| Task | Command | When to use |
|------|---------|-------------|
| Enrich locally | `./scripts/enrich_metadata_local.sh` | First-time setup, backfill missing/incomplete metadata |
| Enrich with batch size | `./scripts/enrich_metadata_local.sh 100` | Larger batches (default 10) |
| Retry failed titles | `cd backend && ./.venv/bin/python -m app.scripts.enrich_missing_metadata --retry-failed 25` | After clearing auth failures; bypasses 7-day skip |
| Report coverage | `./scripts/report_metadata_coverage_local.sh` | See country, languages, poster, actors, etc. coverage |
| List failures | `cd backend && ./.venv/bin/python -m app.scripts.list_metadata_enrichment_failures 20` | Inspect titles currently skipped |
| Clear polluted failures (dry-run) | `cd backend && ./.venv/bin/python -m app.scripts.clear_metadata_enrichment_failures --dry-run` | Preview what would be deleted |
| Clear polluted failures | `cd backend && ./.venv/bin/python -m app.scripts.clear_metadata_enrichment_failures` | Remove auth/quota failures so titles can retry |

**Enrichment behavior:** Only missing or incomplete fields are updated (poster, actors, plot, rated, metascore). Titles that failed in last 7 days are skipped unless `--retry-failed`.

### After new metadata

Workflow when you've added or improved metadata:

1. Enrich locally: `./scripts/enrich_metadata_local.sh 100`
2. Report coverage: `./scripts/report_metadata_coverage_local.sh`
3. Retrain ML model: `cd backend && ./.venv/bin/python -m app.ml.train_8plus_baseline`
4. (Optional) Inspect predictions: `cd backend && ./.venv/bin/python -m app.ml.predict_8plus_baseline --top 15`
5. Sync remote: `./scripts/sync_remote.sh`

**Why retrain?** The ML model uses metadata-derived features (genres, countries, decade, title type, favorite-people match). When metadata coverage improves, training data and the feature matrix improve too. Sync updates production data, but retraining updates the saved ML artifacts used by ML mode.

**Rule of thumb:** Small/no metadata change → sync only. Meaningful metadata enrichment → retrain, then sync.

---

## 3. Favorites / favorite people

| Task | Command |
|------|---------|
| Seed locally (simple CSV) | `cd backend && ./.venv/bin/python -m app.scripts.seed_favorite_people ../data/imdb/favorite_people.csv` |
| Seed locally (IMDb-style export) | Same command; script auto-detects format (Name, Description, Known For, etc.) |
| Verify in DB | `cd backend && ./.venv/bin/python -c "from app.core.database import SessionLocal; from app.models.favorite_person import FavoritePerson; db=SessionLocal(); print('count:', db.query(FavoritePerson).count()); db.close()"` |
| Import to remote | `./scripts/import_remote.sh favorites` or `./scripts/import_remote.sh favorites data/imdb/favorite_people.csv` |

**File path:** `data/imdb/favorite_people.csv` (project root). Simple format: `name,role`. IMDb export: Name, Description, Known For, etc.

---

## 4. Favorite list

| Task | Command |
|------|---------|
| Seed locally | `cd backend && ./.venv/bin/python -m app.scripts.seed_favorite_list` or `... seed_favorite_list ../data/imdb/favorite_list.csv` |
| Import to remote | `./scripts/import_remote.sh favorite-list` or `./scripts/import_remote.sh favorite-list data/imdb/favorite_list.csv` |

**Migration required:** Run `alembic upgrade head` before first use. Table: `favorite_list`. Format: IMDb list export (Const, Position, Title, Title Type, Year, Genres).

---

## 5. Sync workflows

| Task | Command |
|------|---------|
| Full sync to remote | `./scripts/sync_remote.sh` |

**What sync does (in order):**
1. Ratings
2. Watchlist
3. Export local metadata → `data/imdb/title_metadata.csv`
4. Import metadata
5. Favorites (if `data/imdb/favorite_people.csv` exists)
6. Favorite list (if `data/imdb/favorite_list.csv` exists)

**Env:** `REMOTE_API_URL` and `ADMIN_IMPORT_TOKEN` from `.env.sync` or `.env` at project root.

**Idempotent:** Ratings/watchlist upsert. Metadata: missing-field-only updates. Favorites/favorite-list: replace.

---

## 6. Production / Railway

| Task | Command / note |
|------|----------------|
| Redeploy | Push to main or trigger deploy from Railway dashboard |
| Run remote migrations | `cd backend && railway run python -m alembic upgrade head` (or `railway ssh` then `cd backend && python -m alembic upgrade head`) |
| 404 on new endpoint | Route not deployed → redeploy backend |
| 500 on existing endpoint | Often missing migration (e.g. new table) → run `alembic upgrade head` on Railway |

**Patterns:**
- 404 after adding endpoint → redeploy
- 500 after endpoint exists → migration missing

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| OMDb 401 | Invalid/expired key or quota | Check `OMDB_API_KEY`; add `OMDB_API_KEY_FALLBACK` in `.env` for retries |
| Poster/image 404 | Stale OMDb poster URLs | Re-enrich; OMDb URLs can expire |
| CORS-looking frontend error | Often backend 500 | Check backend logs; 500s can surface as CORS in browser |
| Port 8000 in use | Another process | `make stop` or `lsof -ti:8000 \| xargs kill` |
| Wrong file / CSV | Wrong path or source | Use `data/imdb/*.csv`; sync scripts expect project root |

---

## 8. Exact commands (copy-paste)

```bash
# Local backend
cd backend && ./.venv/bin/python -m alembic upgrade head
make run-backend
curl http://localhost:8000/health

# Metadata
./scripts/enrich_metadata_local.sh 100
./scripts/report_metadata_coverage_local.sh
cd backend && ./.venv/bin/python -m app.ml.train_8plus_baseline
cd backend && ./.venv/bin/python -m app.ml.predict_8plus_baseline --top 15
cd backend && ./.venv/bin/python -m app.scripts.enrich_missing_metadata --retry-failed 25
cd backend && ./.venv/bin/python -m app.scripts.list_metadata_enrichment_failures 20
cd backend && ./.venv/bin/python -m app.scripts.clear_metadata_enrichment_failures --dry-run
cd backend && ./.venv/bin/python -m app.scripts.clear_metadata_enrichment_failures

# Sync
./scripts/sync_remote.sh
./scripts/import_remote.sh favorites data/imdb/favorite_people.csv
./scripts/import_remote.sh favorite-list data/imdb/favorite_list.csv

# Favorites / favorite list (local seed)
cd backend && ./.venv/bin/python -m app.scripts.seed_favorite_people ../data/imdb/favorite_people.csv
cd backend && ./.venv/bin/python -m app.scripts.seed_favorite_list ../data/imdb/favorite_list.csv

# Railway
railway ssh
cd backend && railway run python -m alembic upgrade head
```

---

## Common gotchas

- **Run from project root** for `./scripts/*.sh` (not from `backend/` or `data/`).
- **Favorite list migration:** `favorite_list` table must exist; studies endpoint fails gracefully if missing but feature won't work.
- **Sync env:** `.env.sync` is gitignored; keep `REMOTE_API_URL` and `ADMIN_IMPORT_TOKEN` there.
- **Metadata export:** Sync exports *local* metadata to CSV, then uploads. Enrich locally first if you want fresh metadata on remote.
