"""Import favorite list from CSV. Idempotent sync: inserts missing, deletes removed, updates changed.

Accepts IMDb **list export** CSV (from a list page: Export → CSV). Typical columns:
Const, Position, Title, Title Type, Year, Genres (same family as watchlist export).
Identity: ``Const`` (``tt…``). Rows not in the file are removed from the DB (mirror).

UTF-8 BOM on the header row is tolerated.
"""

import csv
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.favorite_list_item import FavoriteListItem


def _normalize_row_keys(row: dict[str, str]) -> dict[str, str]:
    """Strip BOM/spaces from CSV header keys (IMDb exports sometimes prefix Const with BOM)."""
    out: dict[str, str] = {}
    for k, v in row.items():
        if k is None:
            continue
        nk = k.lstrip("\ufeff").strip()
        out[nk] = v if v is not None else ""
    return out


def _parse_int(value: str) -> int | None:
    if not value or not value.strip():
        return None
    try:
        return int(float(value.strip()))
    except (ValueError, TypeError):
        return None


def _parse_str(value: str, max_len: int | None = None) -> str | None:
    if not value or not value.strip():
        return None
    s = value.strip()
    if max_len and len(s) > max_len:
        return s[:max_len]
    return s


def _parse_row(row: dict[str, str]) -> tuple[str | None, dict] | None:
    """Parse CSV row. Returns (imdb_id, data) or None if invalid."""
    row = _normalize_row_keys(row)
    imdb_id = _parse_str(row.get("Const", ""), 20)
    if not imdb_id:
        return None
    position = _parse_int(row.get("Position", ""))
    return (
        imdb_id,
        {
            "position": position if position is not None else 0,
            "title": _parse_str(row.get("Title", ""), 500),
            "title_type": _parse_str(row.get("Title Type", ""), 50),
            "year": _parse_int(row.get("Year", "")),
            "genres": _parse_str(row.get("Genres", ""), 500),
        },
    )


def import_favorite_list_from_csv(db: Session, csv_path: Path) -> tuple[int, int, int, int]:
    """Mirror favorite list from CSV. Inserts new, deletes absent, updates changed rows.

    Returns ``(inserted, deleted, updated, errors)``.
    """
    incoming: dict[str, dict] = {}
    errors = 0
    position = 0

    with open(csv_path, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            parsed = _parse_row(row)
            if parsed is None:
                errors += 1
                continue
            imdb_id, data = parsed
            position += 1
            data["position"] = data["position"] or position
            incoming[imdb_id] = data

    existing = {r.imdb_title_id: r for r in db.query(FavoriteListItem).all()}
    existing_ids = set(existing.keys())
    to_insert = [i for i in incoming if i not in existing_ids]
    to_delete = [i for i in existing if i not in incoming]

    inserted = 0
    for imdb_id in to_insert:
        d = incoming[imdb_id]
        db.add(
            FavoriteListItem(
                imdb_title_id=imdb_id,
                position=d["position"],
                title=d["title"],
                title_type=d["title_type"],
                year=d["year"],
                genres=d["genres"],
            )
        )
        inserted += 1

    deleted = 0
    for imdb_id in to_delete:
        db.delete(existing[imdb_id])
        deleted += 1

    updated = 0
    for imdb_id, d in incoming.items():
        if imdb_id in to_insert:
            continue
        r = existing[imdb_id]
        if (
            r.position != d["position"]
            or r.title != d["title"]
            or r.title_type != d["title_type"]
            or r.year != d["year"]
            or r.genres != d["genres"]
        ):
            r.position = d["position"]
            r.title = d["title"]
            r.title_type = d["title_type"]
            r.year = d["year"]
            r.genres = d["genres"]
            updated += 1

    db.commit()
    return inserted, deleted, updated, errors
