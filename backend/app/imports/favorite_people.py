"""Import favorite people from CSV. Idempotent set-based sync.

CSV columns: name, role. Role: actor, director, or writer.
Identity: (name, role) normalized case-insensitively. Inserts missing, deletes removed.
"""

import csv
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.favorite_person import FavoritePerson

_VALID_ROLES = {"actor", "director", "writer"}


def _key(name: str, role: str) -> tuple[str, str]:
    """Normalized key for matching. Role already lowercased."""
    return (name.strip().lower(), role)


def import_favorite_people_from_csv(db: Session, path: Path) -> tuple[int, int, int]:
    """Sync favorites from CSV. Returns (inserted, deleted, errors). Idempotent when unchanged."""
    existing_rows = db.query(FavoritePerson).all()
    existing_keys = {_key(r.name, r.role) for r in existing_rows}
    existing_by_key = {_key(r.name, r.role): r for r in existing_rows}

    incoming: dict[tuple[str, str], str] = {}  # (name_lower, role) -> display_name
    errors = 0
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 2:
                continue
            name = row[0].strip()
            role = row[1].strip().lower()
            if name.lower() == "name" and role == "role":
                continue
            if not name or role not in _VALID_ROLES:
                errors += 1
                continue
            k = _key(name, role)
            incoming[k] = name

    incoming_keys = set(incoming.keys())
    to_insert = incoming_keys - existing_keys
    to_delete = existing_keys - incoming_keys

    inserted = 0
    for k in to_insert:
        db.add(FavoritePerson(name=incoming[k], role=k[1]))
        inserted += 1

    deleted = 0
    for k in to_delete:
        db.delete(existing_by_key[k])
        deleted += 1

    db.commit()
    return inserted, deleted, errors
