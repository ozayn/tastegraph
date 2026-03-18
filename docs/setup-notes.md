# Backend setup notes

- Local backend commands run from `backend/`
- macOS/Homebrew Python blocks global `pip install` with externally-managed-environment
- Use `backend/.venv` and run commands with `./.venv/bin/python`
- DB check failed initially: database `tastegraph` did not exist
- `createdb tastegraph` fixed it; DB check then succeeded

## Working commands

```bash
cd backend
python -m venv .venv
./.venv/bin/pip install -r requirements.txt
./.venv/bin/python -m app.scripts.check_db
```
