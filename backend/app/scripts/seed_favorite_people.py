"""Seed favorite people from CSV. Replaces existing favorites.

CSV format: name,role (one per line). Role: actor, director, or writer.
Example:
  Christopher Nolan,director
  Cillian Murphy,actor

Usage:
  python -m app.scripts.seed_favorite_people
  python -m app.scripts.seed_favorite_people path/to/favorite_people.csv
"""

import csv
import sys
from pathlib import Path

from app.core.database import SessionLocal
from app.models.favorite_person import FavoritePerson

_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
_DEFAULT_PATH = _BACKEND_ROOT.parent / "data" / "favorite_people.csv"

_VALID_ROLES = {"actor", "director", "writer"}


def main() -> None:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else _DEFAULT_PATH
    if not path.exists():
        print(f"File not found: {path}")
        print("Create a CSV with columns: name,role (actor, director, or writer)")
        print("Example: Christopher Nolan,director")
        raise SystemExit(1)

    db = SessionLocal()
    try:
        db.query(FavoritePerson).delete()
        count = 0
        with path.open(newline="", encoding="utf-8") as f:
            reader = csv.reader(f)
            for row in reader:
                if len(row) < 2:
                    continue
                name = row[0].strip()
                role = row[1].strip().lower()
                if not name or role not in _VALID_ROLES:
                    continue
                db.add(FavoritePerson(name=name, role=role))
                count += 1
        db.commit()
        print(f"Seeded {count} favorite people from {path}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
