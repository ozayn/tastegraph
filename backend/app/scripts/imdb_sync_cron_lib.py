"""Shared helpers for IMDb CSV cron sync (hashing, paths, per-source imports)."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.imports.favorite_list import import_favorite_list_from_csv
from app.imports.favorite_people import import_favorite_people_from_csv
from app.imports.ratings import import_ratings_from_csv
from app.imports.watchlist import import_watchlist_from_csv

SOURCE_FILES: dict[str, str] = {
    "ratings": "ratings.csv",
    "watchlist": "watchlist.csv",
    "favorite_list": "favorite_list.csv",
    "favorite_people": "favorite_people.csv",
}

_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
_DEFAULT_DATA_DIR = _BACKEND_ROOT.parent / "data" / "imdb"
_DEFAULT_STATE_PATH = _BACKEND_ROOT / "data" / "sync" / "imdb_cron_state.json"


def default_data_dir() -> Path:
    return _DEFAULT_DATA_DIR


def default_state_path() -> Path:
    return _DEFAULT_STATE_PATH


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def load_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"version": 1, "sources": {}}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"version": 1, "sources": {}}
    if not isinstance(data, dict):
        return {"version": 1, "sources": {}}
    data.setdefault("version", 1)
    data.setdefault("sources", {})
    if not isinstance(data["sources"], dict):
        data["sources"] = {}
    return data


def save_state(path: Path, state: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def resolve_paths(
    data_dir: Path,
    overrides: dict[str, Path | None],
) -> dict[str, Path | None]:
    """Return absolute paths for each source; None if file not found."""
    out: dict[str, Path | None] = {}
    for key, filename in SOURCE_FILES.items():
        o = overrides.get(key)
        if o is not None:
            out[key] = o if o.exists() else None
        else:
            p = data_dir / filename
            out[key] = p if p.exists() else None
    return out


def run_import_for_source(db: Session, key: str, path: Path) -> dict[str, Any]:
    """Run mirror import for one source. Returns flat dict for logging."""
    if key == "ratings":
        ins, upd, skip, err, deleted = import_ratings_from_csv(db, path, mirror=True)
        return {
            "source": key,
            "inserted": ins,
            "updated": upd,
            "unchanged": skip,
            "errors": err,
            "deleted": deleted,
        }
    if key == "watchlist":
        ins, upd, err, deleted = import_watchlist_from_csv(db, path, mirror=True)
        return {
            "source": key,
            "inserted": ins,
            "updated": upd,
            "errors": err,
            "deleted": deleted,
        }
    if key == "favorite_list":
        ins, deleted, upd, err = import_favorite_list_from_csv(db, path)
        return {
            "source": key,
            "inserted": ins,
            "updated": upd,
            "deleted": deleted,
            "errors": err,
        }
    if key == "favorite_people":
        ins, deleted, err, fmt = import_favorite_people_from_csv(db, path)
        return {
            "source": key,
            "inserted": ins,
            "deleted": deleted,
            "errors": err,
            "format": fmt,
        }
    raise ValueError(f"unknown source {key!r}")
