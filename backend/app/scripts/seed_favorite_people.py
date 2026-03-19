"""Seed favorite people from CSV. Idempotent sync.

Accepts:
- Simple: name,role (actor, director, or writer)
- IMDb-style people export: Name, Description, Known For, etc. (role inferred)

Usage:
  python -m app.scripts.seed_favorite_people
  python -m app.scripts.seed_favorite_people path/to/favorite_people.csv
  python -m app.scripts.seed_favorite_people path/to/imdb_people_export.csv
"""

import sys
from pathlib import Path

from app.core.database import SessionLocal
from app.imports.favorite_people import import_favorite_people_from_csv

_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
_DEFAULT_PATH = _BACKEND_ROOT.parent / "data" / "imdb" / "favorite_people.csv"


def main() -> None:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else _DEFAULT_PATH
    if not path.exists():
        print(f"File not found: {path}")
        print("Create a CSV with columns: name,role (actor, director, or writer)")
        print("Example: Christopher Nolan,director")
        raise SystemExit(1)

    db = SessionLocal()
    try:
        inserted, deleted, errors, fmt = import_favorite_people_from_csv(db, path)
        format_label = "IMDb-style people export" if fmt == "imdb" else "simple favorite CSV"
        parts = []
        if inserted:
            parts.append(f"{inserted} inserted")
        if deleted:
            parts.append(f"{deleted} deleted")
        if not parts:
            parts.append("no changes")
        msg = f"Seeded favorites from {path} ({format_label}): {', '.join(parts)}"
        if errors:
            msg += f" ({errors} skipped)"
        print(msg)
    finally:
        db.close()


if __name__ == "__main__":
    main()
