"""Import favorite people from CSV. Replaces existing favorites.

CSV columns: name, role. Role: actor, director, or writer.
"""

import csv
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.favorite_person import FavoritePerson

_VALID_ROLES = {"actor", "director", "writer"}


def import_favorite_people_from_csv(db: Session, path: Path) -> tuple[int, int]:
    """Load CSV and replace all favorite people. Returns (inserted, errors)."""
    db.query(FavoritePerson).delete()
    inserted = 0
    errors = 0
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 2:
                continue
            name = row[0].strip()
            role = row[1].strip().lower()
            # Skip header row
            if name.lower() == "name" and role == "role":
                continue
            if not name or role not in _VALID_ROLES:
                errors += 1
                continue
            db.add(FavoritePerson(name=name, role=role))
            inserted += 1
    db.commit()
    return inserted, errors
