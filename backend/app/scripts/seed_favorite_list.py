"""Seed favorite list from CSV. Mirror sync (insert / update / delete).

Accepts IMDb **list export** CSV (Const, Position, Title, Title Type, Year, Genres).

For an explicit ``--csv`` flag, prefer:

  python -m app.scripts.sync_imdb_favorite_list --csv path/to/export.csv

Usage:
  python -m app.scripts.seed_favorite_list
  python -m app.scripts.seed_favorite_list path/to/favorite_list.csv
"""

import sys
from pathlib import Path

from app.core.database import SessionLocal
from app.imports.favorite_list import import_favorite_list_from_csv

_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
_DEFAULT_PATH = _BACKEND_ROOT.parent / "data" / "imdb" / "favorite_list.csv"


def main() -> None:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else _DEFAULT_PATH
    if not path.exists():
        print(f"File not found: {path}")
        print("Create a CSV with IMDb list format (Const, Position, Title, Title Type, Year, Genres)")
        raise SystemExit(1)

    db = SessionLocal()
    try:
        inserted, deleted, updated, errors = import_favorite_list_from_csv(db, path)
        parts = []
        if inserted:
            parts.append(f"{inserted} inserted")
        if updated:
            parts.append(f"{updated} updated")
        if deleted:
            parts.append(f"{deleted} deleted")
        msg = f"Seeded favorite list from {path}: {', '.join(parts) or 'no changes'}"
        if errors:
            msg += f" ({errors} skipped)"
        print(msg)
    finally:
        db.close()


if __name__ == "__main__":
    main()
