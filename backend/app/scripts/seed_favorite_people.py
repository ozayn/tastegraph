"""Seed favorite people from CSV. Replaces existing favorites.

CSV format: name,role (one per line). Role: actor, director, or writer.
Example:
  Christopher Nolan,director
  Cillian Murphy,actor

Usage:
  python -m app.scripts.seed_favorite_people
  python -m app.scripts.seed_favorite_people path/to/favorite_people.csv
"""

import sys
from pathlib import Path

from app.core.database import SessionLocal
from app.imports.favorite_people import import_favorite_people_from_csv

_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
_DEFAULT_PATH = _BACKEND_ROOT.parent / "data" / "favorite_people.csv"


def main() -> None:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else _DEFAULT_PATH
    if not path.exists():
        print(f"File not found: {path}")
        print("Create a CSV with columns: name,role (actor, director, or writer)")
        print("Example: Christopher Nolan,director")
        raise SystemExit(1)

    db = SessionLocal()
    try:
        inserted, errors = import_favorite_people_from_csv(db, path)
        print(f"Seeded {inserted} favorite people from {path}" + (f" ({errors} skipped)" if errors else ""))
    finally:
        db.close()


if __name__ == "__main__":
    main()
