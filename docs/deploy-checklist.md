# TasteGraph Deployment Verification Checklist

## Pre-deploy

- [ ] `NEXT_PUBLIC_API_URL` points to the backend service URL (e.g. Railway backend)
- [ ] Backend CORS allows the frontend origin
- [ ] Database is provisioned and migrations applied

## Post-deploy

### Frontend

- [ ] Frontend URL loads (no 502/503)
- [ ] Page renders (not blank or dev-mode error)
- [ ] Browser console has no CORS errors

### Backend

- [ ] `GET /health` returns 200
- [ ] `GET /docs` loads (OpenAPI/Swagger UI)
- [ ] Backend logs show no startup errors

### Integration

- [ ] Frontend fetches backend data (e.g. ratings summary, recommendations)
- [ ] Ratings/watchlist data is present (check via API or UI)

## Common Failure Causes

| Symptom | Likely cause |
|---------|--------------|
| CORS errors in browser | Wrong CORS origin; backend not allowing frontend URL |
| 404 or connection refused from frontend | Wrong `NEXT_PUBLIC_API_URL`; must match deployed backend URL |
| Blank page or "Could not find production build" | Frontend running dev mode; ensure Dockerfile uses `next start` |
| Empty dashboard, no ratings | Backend DB empty; run migrations and import data |
