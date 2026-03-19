"""Import title metadata from CSV.

Expected columns: imdb_title_id, title, title_type, year, genres, languages, country, runtime_mins,
release_date, directors, imdb_rating, num_votes, url
Upserts by imdb_title_id. Tolerant of missing fields.
"""

import csv
from datetime import date
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.title_metadata import TitleMetadata


def _parse_int(value: str) -> int | None:
    if not value or not value.strip():
        return None
    try:
        return int(float(value.strip()))
    except (ValueError, TypeError):
        return None


def _parse_float(value: str) -> float | None:
    if not value or not value.strip():
        return None
    try:
        return float(value.strip())
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


def import_title_metadata_from_csv(db: Session, csv_path: Path) -> tuple[int, int]:
    """Import metadata from CSV. Upserts by imdb_title_id. Returns (inserted, updated)."""
    inserted = 0
    updated = 0

    with open(csv_path, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            imdb_id = _parse_str(row.get("imdb_title_id", ""), 20)
            if not imdb_id:
                continue

            existing = db.query(TitleMetadata).filter(TitleMetadata.imdb_title_id == imdb_id).first()

            if existing:
                existing.title = _parse_str(row.get("title", ""), 500)
                existing.title_type = _parse_str(row.get("title_type", ""), 50)
                existing.year = _parse_int(row.get("year", ""))
                existing.genres = _parse_str(row.get("genres", ""), 500)
                existing.languages = _parse_str(row.get("languages", ""), 500)
                existing.country = _parse_str(row.get("country", ""), 500)
                existing.runtime_mins = _parse_int(row.get("runtime_mins", ""))
                existing.release_date = _parse_date(row.get("release_date", ""))
                existing.directors = _parse_str(row.get("directors", ""), 500)
                existing.imdb_rating = _parse_float(row.get("imdb_rating", ""))
                existing.num_votes = _parse_int(row.get("num_votes", ""))
                existing.url = _parse_str(row.get("url", ""), 500)
                updated += 1
            else:
                db.add(
                    TitleMetadata(
                        imdb_title_id=imdb_id,
                        title=_parse_str(row.get("title", ""), 500),
                        title_type=_parse_str(row.get("title_type", ""), 50),
                        year=_parse_int(row.get("year", "")),
                        genres=_parse_str(row.get("genres", ""), 500),
                        languages=_parse_str(row.get("languages", ""), 500),
                        country=_parse_str(row.get("country", ""), 500),
                        runtime_mins=_parse_int(row.get("runtime_mins", "")),
                        release_date=_parse_date(row.get("release_date", "")),
                        directors=_parse_str(row.get("directors", ""), 500),
                        imdb_rating=_parse_float(row.get("imdb_rating", "")),
                        num_votes=_parse_int(row.get("num_votes", "")),
                        url=_parse_str(row.get("url", ""), 500),
                    )
                )
                inserted += 1

    db.commit()
    return inserted, updated


def run_import(csv_path: str) -> None:
    """Run import and print summary."""
    from app.core.database import SessionLocal

    path = Path(csv_path)
    if not path.exists():
        print(f"Error: File not found: {path}")
        return

    db = SessionLocal()
    try:
        inserted, updated = import_title_metadata_from_csv(db, path)
        print(f"Import complete: {inserted} inserted, {updated} updated")
    finally:
        db.close()


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python -m app.imports.title_metadata <path/to/metadata.csv>")
        sys.exit(1)
    run_import(sys.argv[1])
