"""Import title metadata from CSV.

Expected columns: imdb_title_id, title, title_type, year, genres, languages, country, runtime_mins,
release_date, directors, actors, writer, plot, poster, metascore, awards, rated, imdb_rating, num_votes, url
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
    if s.upper() == "N/A":
        return None
    if max_len and len(s) > max_len:
        return s[:max_len]
    return s


def _is_missing(val) -> bool:
    """True if value is null, empty, or N/A. Do not overwrite with emptier data."""
    if val is None:
        return True
    if isinstance(val, str):
        s = val.strip()
        return not s or s.upper() == "N/A"
    return False


def _has_value(val) -> bool:
    """True if value is useful (not missing)."""
    return not _is_missing(val)


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
                row_updated = False
                v = _parse_str(row.get("title", ""), 500)
                if _is_missing(existing.title) and _has_value(v):
                    existing.title = v
                    row_updated = True
                v = _parse_str(row.get("title_type", ""), 50)
                if _is_missing(existing.title_type) and _has_value(v):
                    existing.title_type = v
                    row_updated = True
                v = _parse_int(row.get("year", ""))
                if _is_missing(existing.year) and _has_value(v):
                    existing.year = v
                    row_updated = True
                v = _parse_str(row.get("genres", ""), 500)
                if _is_missing(existing.genres) and _has_value(v):
                    existing.genres = v
                    row_updated = True
                v = _parse_str(row.get("languages", ""), 500)
                if _is_missing(existing.languages) and _has_value(v):
                    existing.languages = v
                    row_updated = True
                v = _parse_str(row.get("country", ""), 500)
                if _is_missing(existing.country) and _has_value(v):
                    existing.country = v
                    row_updated = True
                v = _parse_int(row.get("runtime_mins", ""))
                if _is_missing(existing.runtime_mins) and _has_value(v):
                    existing.runtime_mins = v
                    row_updated = True
                v = _parse_date(row.get("release_date", ""))
                if _is_missing(existing.release_date) and _has_value(v):
                    existing.release_date = v
                    row_updated = True
                v = _parse_str(row.get("directors", ""), 500)
                if _is_missing(existing.directors) and _has_value(v):
                    existing.directors = v
                    row_updated = True
                v = _parse_str(row.get("actors", ""), 500)
                if _is_missing(existing.actors) and _has_value(v):
                    existing.actors = v
                    row_updated = True
                v = _parse_str(row.get("writer", ""), 500)
                if _is_missing(existing.writer) and _has_value(v):
                    existing.writer = v
                    row_updated = True
                v = _parse_str(row.get("plot", ""), 2000)
                if _is_missing(existing.plot) and _has_value(v):
                    existing.plot = v
                    row_updated = True
                v = _parse_str(row.get("poster", ""), 500)
                if _is_missing(existing.poster) and _has_value(v):
                    existing.poster = v
                    row_updated = True
                v = _parse_int(row.get("metascore", ""))
                if _is_missing(existing.metascore) and _has_value(v):
                    existing.metascore = v
                    row_updated = True
                v = _parse_str(row.get("awards", ""), 500)
                if _is_missing(existing.awards) and _has_value(v):
                    existing.awards = v
                    row_updated = True
                v = _parse_str(row.get("rated", ""), 20)
                if _is_missing(existing.rated) and _has_value(v):
                    existing.rated = v
                    row_updated = True
                v = _parse_float(row.get("imdb_rating", ""))
                if _is_missing(existing.imdb_rating) and _has_value(v):
                    existing.imdb_rating = v
                    row_updated = True
                v = _parse_int(row.get("num_votes", ""))
                if _is_missing(existing.num_votes) and _has_value(v):
                    existing.num_votes = v
                    row_updated = True
                v = _parse_str(row.get("url", ""), 500)
                if _is_missing(existing.url) and _has_value(v):
                    existing.url = v
                    row_updated = True
                if row_updated:
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
                        actors=_parse_str(row.get("actors", ""), 500),
                        writer=_parse_str(row.get("writer", ""), 500),
                        plot=_parse_str(row.get("plot", ""), 2000),
                        poster=_parse_str(row.get("poster", ""), 500),
                        metascore=_parse_int(row.get("metascore", "")),
                        awards=_parse_str(row.get("awards", ""), 500),
                        rated=_parse_str(row.get("rated", ""), 20),
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
