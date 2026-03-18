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
        your_rating=_parse_int(row.get("Your Rating", "")),
        date_rated=_parse_date(row.get("Date Rated", "")),
    )


def import_watchlist_from_csv(db: Session, csv_path: Path) -> tuple[int, int, int]:
    """Import watchlist from CSV. Returns (inserted, skipped, errors)."""
    existing_ids = {
        r.imdb_title_id for r in db.query(IMDbWatchlistItem.imdb_title_id).all()
    }

    inserted = 0
    skipped = 0
    errors = 0

    with open(csv_path, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            item = _row_to_item(row)
            if not item:
                errors += 1
                continue
            if item.imdb_title_id in existing_ids:
                skipped += 1
                continue
            db.add(item)
            existing_ids.add(item.imdb_title_id)
            inserted += 1

    db.commit()
    return inserted, skipped, errors


def run_import(csv_path: str) -> None:
    """Run import and print summary."""
    from app.core.database import SessionLocal

    path = Path(csv_path)
    if not path.exists():
        print(f"Error: File not found: {path}")
        return

    db = SessionLocal()
    try:
        inserted, skipped, errors = import_watchlist_from_csv(db, path)
        print(f"Import complete: {inserted} inserted, {skipped} skipped, {errors} errors")
    finally:
        db.close()


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python -m app.imports.watchlist <path/to/watchlist.csv>")
        sys.exit(1)
    run_import(sys.argv[1])
