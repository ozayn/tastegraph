"""Import IMDb ratings from CSV.

Supports two formats:
1. Rich IMDb export: Const, Your Rating, Date Rated, Title, Title Type, Year, Genres, etc.
2. Raw format: Title ID, Rating, Last Modified Date
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
        pass
    try:
        year = int(s[:4])
        if 1900 <= year <= 2100:
            return date(year, 1, 1)
    except (ValueError, TypeError):
        pass
    return None


def _normalize_row_keys(row: dict) -> dict[str, str]:
    """Strip BOM/spaces from CSV header keys (IMDb exports may prefix Const with BOM)."""
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


def _is_rich_format(fieldnames: list[str]) -> bool:
    return "Const" in fieldnames and "Your Rating" in fieldnames


def _row_to_rating_raw(row: dict[str, str]) -> IMDbRating | None:
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


def _row_to_rating_rich(row: dict[str, str]) -> IMDbRating | None:
    imdb_id = _parse_str(row.get("Const", ""), 20)
    if not imdb_id:
        return None
    return IMDbRating(
        imdb_title_id=imdb_id,
        title=_parse_str(row.get("Title", ""), 500),
        title_type=_parse_str(row.get("Title Type", ""), 50),
        year=_parse_int(row.get("Year", "")),
        genres=_parse_str(row.get("Genres", ""), 500),
        user_rating=_parse_int(row.get("Your Rating", "")),
        date_rated=_parse_date(row.get("Date Rated", "")),
        imdb_rating=_parse_float(row.get("IMDb Rating", "")),
        runtime_mins=_parse_int(row.get("Runtime (mins)", "")),
        num_votes=_parse_int(row.get("Num Votes", "")),
        release_date=_parse_date(row.get("Release Date", "")),
        directors=_parse_str(row.get("Directors", ""), 500),
        url=_parse_str(row.get("URL", ""), 500),
    )


def _apply_rating_fields(existing: IMDbRating, incoming: IMDbRating, *, rich: bool) -> bool:
    """Copy fields from incoming onto existing. Raw format only updates rating/date fields."""
    changed = False
    if rich:
        fields = (
            "title",
            "title_type",
            "year",
            "genres",
            "user_rating",
            "date_rated",
            "imdb_rating",
            "runtime_mins",
            "num_votes",
            "release_date",
            "directors",
            "url",
        )
    else:
        fields = ("user_rating", "date_rated")
    for attr in fields:
        new_val = getattr(incoming, attr)
        old_val = getattr(existing, attr)
        if old_val != new_val:
            setattr(existing, attr, new_val)
            changed = True
    return changed


def import_ratings_from_csv(
    db: Session, csv_path: Path, *, upsert: bool = False, mirror: bool = False
) -> tuple[int, int, int, int, int]:
    """Import ratings from CSV.

    When upsert is False (default): insert new rows only; existing imdb_title_id rows are skipped.
    When upsert is True: insert new rows; update existing rows when CSV values differ.
    When mirror is True: after import, delete DB rows whose imdb_title_id is not in the CSV
    (full parity with the export). Mirror implies upsert.

    Returns (inserted, updated, skipped, errors, deleted).
    """
    if mirror:
        upsert = True

    existing_by_id: dict[str, IMDbRating] = {
        r.imdb_title_id: r for r in db.query(IMDbRating).all()
    }

    inserted = 0
    updated = 0
    skipped = 0
    errors = 0
    incoming_ids: set[str] = set()

    with open(csv_path, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        fieldnames = [fn.lstrip("\ufeff").strip() for fn in (reader.fieldnames or [])]
        is_rich = _is_rich_format(fieldnames)

        for row in reader:
            row = _normalize_row_keys(row)
            if is_rich:
                rating = _row_to_rating_rich(row)
            else:
                rating = _row_to_rating_raw(row)

            if not rating:
                errors += 1
                continue

            incoming_ids.add(rating.imdb_title_id)
            ex = existing_by_id.get(rating.imdb_title_id)
            if ex is None:
                db.add(rating)
                existing_by_id[rating.imdb_title_id] = rating
                inserted += 1
            elif upsert:
                if _apply_rating_fields(ex, rating, rich=is_rich):
                    updated += 1
                else:
                    skipped += 1
            else:
                skipped += 1

    deleted = 0
    if mirror:
        q = db.query(IMDbRating)
        if incoming_ids:
            q = q.filter(~IMDbRating.imdb_title_id.in_(incoming_ids))
        for r in q.all():
            db.delete(r)
            deleted += 1

    db.commit()
    return inserted, updated, skipped, errors, deleted


def run_import(csv_path: str, *, upsert: bool = False, mirror: bool = False) -> None:
    """Run import and print summary."""
    from app.core.database import SessionLocal

    path = Path(csv_path)
    if not path.exists():
        print(f"Error: File not found: {path}")
        return

    db = SessionLocal()
    try:
        inserted, updated, skipped, errors, deleted = import_ratings_from_csv(
            db, path, upsert=upsert, mirror=mirror
        )
        parts = [
            f"{inserted} inserted",
            f"{updated} updated",
            f"{skipped} skipped",
            f"{errors} errors",
        ]
        if deleted:
            parts.append(f"{deleted} deleted")
        print(f"Import complete: {', '.join(parts)}")
    finally:
        db.close()


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print(
            "Usage: python -m app.imports.ratings <path/to/ratings.csv> [--upsert] [--mirror]"
        )
        sys.exit(1)
    upsert_flag = "--upsert" in sys.argv
    mirror_flag = "--mirror" in sys.argv
    run_import(sys.argv[1], upsert=upsert_flag, mirror=mirror_flag)
