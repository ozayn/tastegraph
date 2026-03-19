"""Import favorite people from CSV. Idempotent set-based sync.

Supports two formats:
1. Simple: name,role (actor, director, or writer)
2. IMDb-style people export: Name, Description, Known For, etc. Role inferred from Description/Known For.
Identity: (name, role) normalized case-insensitively. Inserts missing, deletes removed.
"""

import csv
import io
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.favorite_person import FavoritePerson

_VALID_ROLES = {"actor", "director", "writer"}
_IMDB_MARKER_COLUMNS = {"description", "known for", "knownfor", "const", "position"}
_CSV_ENCODING = "utf-8-sig"  # Handles BOM (Excel, some exports)


def _key(name: str, role: str) -> tuple[str, str]:
    """Normalized key for matching. Role already lowercased."""
    return (name.strip().lower(), role)


def _read_first_row(path: Path) -> tuple[list[str], str]:
    """Read first CSV row and detect delimiter. Returns (headers, delimiter)."""
    with path.open(newline="", encoding=_CSV_ENCODING) as f:
        first_line = f.readline()
    row = next(csv.reader(io.StringIO(first_line)))
    if len(row) == 1 and ";" in row[0]:
        row = [c.strip() for c in row[0].split(";")]
        return row, ";"
    return row, ","


def _detect_format(path: Path) -> str:
    """Return 'simple' or 'imdb' based on CSV structure."""
    first, _ = _read_first_row(path)
    if not first:
        return "simple"
    headers = {h.strip().lower() for h in first}
    if "name" in headers and headers & _IMDB_MARKER_COLUMNS:
        return "imdb"
    return "simple"


def _infer_role_from_imdb(description: str, known_for: str) -> str:
    """Infer role from IMDb Description/Known For. Default: actor."""
    combined = f" {(description or '').lower()} {(known_for or '').lower()} "
    if "director" in combined:
        return "director"
    if "writer" in combined or "screenplay" in combined:
        return "writer"
    return "actor"


def _parse_simple_csv(path: Path) -> tuple[dict[tuple[str, str], str], int]:
    """Parse simple name,role CSV. Returns (incoming, errors)."""
    _, delimiter = _read_first_row(path)
    incoming: dict[tuple[str, str], str] = {}
    errors = 0
    with path.open(newline="", encoding=_CSV_ENCODING) as f:
        reader = csv.reader(f, delimiter=delimiter)
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
    return incoming, errors


def _parse_imdb_csv(path: Path) -> tuple[dict[tuple[str, str], str], int]:
    """Parse IMDb-style people export. Uses Name; infers role from Description/Known For."""
    _, delimiter = _read_first_row(path)
    incoming: dict[tuple[str, str], str] = {}
    errors = 0
    with path.open(newline="", encoding=_CSV_ENCODING) as f:
        reader = csv.DictReader(f, delimiter=delimiter)
        name_col = next((c for c in reader.fieldnames or [] if c.strip().lower() == "name"), None)
        desc_col = next((c for c in reader.fieldnames or [] if c.strip().lower() == "description"), None)
        known_col = next(
            (c for c in reader.fieldnames or []
             if c.strip().lower() in ("known for", "knownfor")),
            None,
        )
        if not name_col:
            return incoming, 1

        for row in reader:
            name = (row.get(name_col) or "").strip()
            if not name:
                continue
            desc = row.get(desc_col, "") or ""
            known = row.get(known_col, "") or ""
            role = _infer_role_from_imdb(desc, known)
            k = _key(name, role)
            incoming[k] = name

    return incoming, errors


def import_favorite_people_from_csv(
    db: Session, path: Path
) -> tuple[int, int, int, str]:
    """Sync favorites from CSV. Returns (inserted, deleted, errors, format). Idempotent when unchanged."""
    fmt = _detect_format(path)
    if fmt == "imdb":
        incoming, errors = _parse_imdb_csv(path)
    else:
        incoming, errors = _parse_simple_csv(path)

    existing_rows = db.query(FavoritePerson).all()
    existing_keys = {_key(r.name, r.role) for r in existing_rows}
    existing_by_key = {_key(r.name, r.role): r for r in existing_rows}

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
    return inserted, deleted, errors, fmt
