"""Import favorite list from CSV. Idempotent replace: clears and repopulates.

Accepts IMDb-style list CSV: Const, Position, Title, Title Type, Year, Genres.
Same format as watchlist export.
"""

import csv
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.favorite_list_item import FavoriteListItem


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


def import_favorite_list_from_csv(db: Session, csv_path: Path) -> tuple[int, int]:
    """Import favorite list from CSV. Replaces entire list. Returns (inserted, errors)."""
    db.query(FavoriteListItem).delete()

    inserted = 0
    errors = 0

    with open(csv_path, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            imdb_id = _parse_str(row.get("Const", ""), 20)
            if not imdb_id:
                errors += 1
                continue
            position = _parse_int(row.get("Position", ""))
            if position is None:
                position = inserted + 1

            db.add(
                FavoriteListItem(
                    imdb_title_id=imdb_id,
                    position=position,
                    title=_parse_str(row.get("Title", ""), 500),
                    title_type=_parse_str(row.get("Title Type", ""), 50),
                    year=_parse_int(row.get("Year", "")),
                    genres=_parse_str(row.get("Genres", ""), 500),
                )
            )
            inserted += 1

    db.commit()
    return inserted, errors
