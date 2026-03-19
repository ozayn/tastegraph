# TasteGraph Deployment Troubleshooting

## Problems and fixes

### 1. Frontend deployed but still calls http://localhost:8000

**Symptom:** Browser network requests go to localhost from Railway frontend.

**Root cause:** `NEXT_PUBLIC_API_URL` missing at build time; frontend Docker build used fallback.

**Fix:** Pass `NEXT_PUBLIC_API_URL` into frontend Dockerfile before `npm run build` (ARG + ENV). Ensure it is set in Railway frontend service env vars.

---

### 2. Frontend Railway service shows "Application failed to respond"

**Symptom:** Railway 502 / failed to respond.

**Root cause:** Frontend Dockerfile ran `next dev` instead of production server.

**Fix:** Use production Next.js start command in Dockerfile: `npm run start -- -p 3000` with `HOSTNAME=0.0.0.0`.

---

### 3. Backend endpoints return 500 because tables do not exist

**Symptom:** `relation "imdb_watchlist" does not exist` or similar.

**Root cause:** Railway Postgres schema behind code; migrations not run.

**Fix:** `railway run` or `railway ssh`, then `python -m alembic upgrade head`.

---

### 4. Local alembic/import commands fail because REMOTE_API_URL is present

**Symptom:** Pydantic Settings ValidationError for `remote_api_url` or similar.

**Root cause:** Sync-only env var was placed where backend settings load it.

**Fix:** Keep `REMOTE_API_URL` out of `backend/.env`; use `.env.sync` or shell exports for sync scripts.

---

### 5. Railway migration attempt from local machine fails with postgres.railway.internal

**Symptom:** Could not translate host name "postgres.railway.internal".

**Root cause:** Railway internal DB hostname only resolves inside Railway network.

**Fix:** Use `railway run` or `railway ssh` for migrations, not local alembic against internal host.

---

### 6. Backend crashes on startup after adding admin upload endpoints

**Symptom:** FastAPI says python-multipart is required.

**Root cause:** Multipart dependency missing.

**Fix:** Add `python-multipart` to backend `requirements.txt` and redeploy.

---

### 7. Genre dropdown says "Genres appear after enrichment" even though endpoint has data

**Symptom:** Dropdown empty despite endpoint returning genres.

**Root cause:** Frontend fetch result was computed but not stored with `setGenres`.

**Fix:** Pass fetched genres into state (e.g. `.then(setGenres)` in the fetch chain).

---

### 8. Watchlist genre filter offers genres but returns no results

**Symptom:** Action or other genres selectable but zero matches.

**Root cause:** Fallback genres did not reflect real watchlist candidate data.

**Fix:** Use true watchlist-backed genres, or disable/fallback carefully.

---

### 9. Deployed frontend hits correct backend URL but still gets CORS errors

**Symptom:** Fetches to backend Railway URL blocked by CORS.

**Root cause:** `CORS_ORIGINS` on backend had wrong frontend origin, including a trailing slash.

**Fix:** Set exact frontend URL with no trailing slash and redeploy backend.

---

### 10. Deployed backend shows empty data after migrations

**Symptom:** `import-status` endpoints return zero and recommendations return `[]`.

**Root cause:** Schema exists, but no ratings/watchlist imported into Railway DB.

**Fix:** Run `./scripts/sync_remote.sh` or admin import endpoints with `ADMIN_IMPORT_TOKEN`.

---

## Safe practices going forward

- Keep backend runtime env separate from sync-only env (use `.env.sync` for sync scripts).
- Always run migrations before testing a new deployed schema.
- Remember `NEXT_PUBLIC_*` is build-time for Next.js; set before `npm run build`.
- Verify backend endpoints directly (curl) before debugging frontend.
- Avoid trailing slashes in CORS origins.
- Verify deployed frontend requests in browser network tab.
