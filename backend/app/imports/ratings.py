"""Import IMDb ratings from raw CSV export.

Expected columns: Title ID, Rating, Last Modified Date
- Title ID -> imdb_title_id
- Rating -> user_rating
- Last Modified Date -> date_rated (date rating was last modified)
"""

import csv
from datetime import date
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.imdb_rating import IMDbRating


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
        return None


def _parse_str(value: str, max_len: int | None = None) -> str | None:
    if not value or not value.strip():
        return None
    s = value.strip()
    if max_len and len(s) > max_len:
        return s[:max_len]
    return s


def _row_to_rating(row: dict[str, str]) -> IMDbRating | None:
    imdb_id = _parse_str(row.get("Title ID", ""), 20)
    if not imdb_id:
        return None

    return IMDbRating(
        imdb_title_id=imdb_id,
        title=None,
        title_type=None,
        year=None,
        genres=None,
        user_rating=_parse_int(row.get("Rating", "")),
        date_rated=_parse_date(row.get("Last Modified Date", "")),
        imdb_rating=None,
        runtime_mins=None,
        num_votes=None,
        release_date=None,
        directors=None,
        url=None,
    )


def import_ratings_from_csv(db: Session, csv_path: Path) -> tuple[int, int, int]:
    """Import ratings from CSV. Returns (inserted, skipped, errors)."""
    existing_ids = {r.imdb_title_id for r in db.query(IMDbRating.imdb_title_id).all()}

    inserted = 0
    skipped = 0
    errors = 0

    with open(csv_path, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rating = _row_to_rating(row)
            if not rating:
                errors += 1
                continue
            if rating.imdb_title_id in existing_ids:
                skipped += 1
                continue
            db.add(rating)
            existing_ids.add(rating.imdb_title_id)
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
        inserted, skipped, errors = import_ratings_from_csv(db, path)
        print(f"Import complete: {inserted} inserted, {skipped} skipped, {errors} errors")
    finally:
        db.close()


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python -m app.imports.ratings <path/to/ratings.csv>")
        sys.exit(1)
    run_import(sys.argv[1])
