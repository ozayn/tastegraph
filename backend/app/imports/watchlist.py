"""Import IMDb watchlist from watchlist.csv export."""

import csv
from datetime import date
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.imdb_watchlist_item import IMDbWatchlistItem


def _parse_int(value: str) -> int | None:
    if not value or not value.strip():
        return None
    try:
        return int(float(value.strip()))
    except (ValueError, TypeError):
        return None


def _parse_date(value: str) -> date | None:
    if not value or not value.strip():
        return None
    s = value.strip()
    try:
        return date.fromisoformat(s[:10])
    except (ValueError, TypeError):
        pass
    try:
        year = int(s[:4])
        if 1900 <= year <= 2100:
            return date(year, 1, 1)
    except (ValueError, TypeError):
        pass
    return None


def _normalize_row_keys(row: dict) -> dict[str, str]:
    out: dict[str, str] = {}
    for k, v in row.items():
        if k is None:
            continue
        nk = str(k).lstrip("\ufeff").strip()
        out[nk] = v if isinstance(v, str) else (str(v) if v is not None else "")
    return out


def _parse_str(value: str, max_len: int | None = None) -> str | None:
    if not value or not value.strip():
        return None
    s = value.strip()
    if max_len and len(s) > max_len:
        return s[:max_len]
    return s


def _row_to_item(row: dict[str, str]) -> IMDbWatchlistItem | None:
    imdb_id = _parse_str(row.get("Const", ""), 20)
    if not imdb_id:
        return None
    position = _parse_int(row.get("Position", ""))
    if position is None:
        return None
    return IMDbWatchlistItem(
        imdb_title_id=imdb_id,
        position=position,
        created=_parse_date(row.get("Created", "")),
        modified=_parse_date(row.get("Modified", "")),
        title=_parse_str(row.get("Title", ""), 500),
        title_type=_parse_str(row.get("Title Type", ""), 50),
        year=_parse_int(row.get("Year", "")),
        genres=_parse_str(row.get("Genres", ""), 500),
        your_rating=_parse_int(row.get("Your Rating", "")),
        date_rated=_parse_date(row.get("Date Rated", "")),
    )


def import_watchlist_from_csv(
    db: Session, csv_path: Path, *, mirror: bool = False
) -> tuple[int, int, int, int]:
    """Import watchlist from CSV.

    Default: upsert rows from the file (insert new, update existing). Does not remove
    titles absent from the CSV.

    When mirror is True: same upserts, then delete DB rows not present in the CSV
    (parity with IMDb watchlist export).

    Returns (inserted, updated, errors, deleted).
    """
    existing = {r.imdb_title_id: r for r in db.query(IMDbWatchlistItem).all()}

    inserted = 0
    updated = 0
    errors = 0
    incoming_ids: set[str] = set()

    with open(csv_path, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            row = _normalize_row_keys(row)
            item = _row_to_item(row)
            if not item:
                errors += 1
                continue
            incoming_ids.add(item.imdb_title_id)
            existing_row = existing.get(item.imdb_title_id)
            if existing_row:
                existing_row.created = item.created
                existing_row.modified = item.modified
                existing_row.title = item.title
                existing_row.title_type = item.title_type
                existing_row.year = item.year
                existing_row.genres = item.genres
                existing_row.your_rating = item.your_rating
                existing_row.date_rated = item.date_rated
                updated += 1
            else:
                db.add(item)
                existing[item.imdb_title_id] = item
                inserted += 1

    deleted = 0
    if mirror:
        q = db.query(IMDbWatchlistItem)
        if incoming_ids:
            q = q.filter(~IMDbWatchlistItem.imdb_title_id.in_(incoming_ids))
        for r in q.all():
            db.delete(r)
            deleted += 1

    db.commit()
    return inserted, updated, errors, deleted


def run_import(csv_path: str, *, mirror: bool = False) -> None:
    """Run import and print summary."""
    from app.core.database import SessionLocal

    path = Path(csv_path)
    if not path.exists():
        print(f"Error: File not found: {path}")
        return

    db = SessionLocal()
    try:
        inserted, updated, errors, deleted = import_watchlist_from_csv(
            db, path, mirror=mirror
        )
        parts = [f"{inserted} inserted", f"{updated} updated", f"{errors} errors"]
        if deleted:
            parts.append(f"{deleted} deleted")
        print(f"Import complete: {', '.join(parts)}")
    finally:
        db.close()


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python -m app.imports.watchlist <path/to/watchlist.csv> [--mirror]")
        sys.exit(1)
    mirror_flag = "--mirror" in sys.argv
    run_import(sys.argv[1], mirror=mirror_flag)
