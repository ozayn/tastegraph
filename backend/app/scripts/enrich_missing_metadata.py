"""Enrich a small batch of ratings and watchlist titles missing from TitleMetadata via OMDb."""

import sys
import time

from app.core.database import SessionLocal
from app.models.imdb_rating import IMDbRating
from app.models.imdb_watchlist_item import IMDbWatchlistItem
from app.models.title_metadata import TitleMetadata
from app.scripts.enrich_one_title import upsert_metadata_result
from app.services.omdb import fetch_title_metadata_with_error

_DEFAULT_LIMIT = 10
_DELAY_SECONDS = 1.0


def main() -> None:
    limit = _DEFAULT_LIMIT
    if len(sys.argv) > 1:
        try:
            limit = int(sys.argv[1])
        except ValueError:
            print("Usage: python -m app.scripts.enrich_missing_metadata [limit]")
            raise SystemExit(1)

    db = SessionLocal()
    try:
        existing_subq = db.query(TitleMetadata.imdb_title_id)
        missing_ratings = {
            r[0]
            for r in db.query(IMDbRating.imdb_title_id)
            .filter(IMDbRating.imdb_title_id.notin_(existing_subq))
            .distinct()
            .all()
        }
        missing_watchlist = {
            r[0]
            for r in db.query(IMDbWatchlistItem.imdb_title_id)
            .filter(IMDbWatchlistItem.imdb_title_id.notin_(existing_subq))
            .distinct()
            .all()
        }
        all_missing = list(missing_ratings | missing_watchlist)[:limit]
        from_ratings = len(missing_ratings)
        from_watchlist = len(missing_watchlist)

        # Build title lookup for failed-case reporting
        rating_titles = {
            r[0]: r[1]
            for r in db.query(IMDbRating.imdb_title_id, IMDbRating.title)
            .filter(IMDbRating.imdb_title_id.in_(all_missing))
            .all()
            if r[1]
        }
        watchlist_titles = {
            r[0]: r[1]
            for r in db.query(IMDbWatchlistItem.imdb_title_id, IMDbWatchlistItem.title)
            .filter(IMDbWatchlistItem.imdb_title_id.in_(all_missing))
            .all()
            if r[1]
        }
        title_lookup = {i: rating_titles.get(i) or watchlist_titles.get(i) for i in all_missing}
    finally:
        db.close()

    if not all_missing:
        print("attempted=0 inserted=0 updated=0 skipped=0 failed=0 (no missing from ratings or watchlist)")
        return

    attempted = 0
    inserted = 0
    updated = 0
    failed = 0
    failed_cases: list[tuple[str, str | None, str]] = []

    for imdb_id in all_missing:
        result, error_msg = fetch_title_metadata_with_error(imdb_id)
        attempted += 1

        if result is None:
            failed += 1
            title = title_lookup.get(imdb_id)
            reason = error_msg or "unknown"
            failed_cases.append((imdb_id, title, reason))
            title_part = f" {title}" if title else ""
            print(f"  failed: {imdb_id}{title_part} — {reason}")
        else:
            db = SessionLocal()
            try:
                action = upsert_metadata_result(result, db)
                if action == "inserted":
                    inserted += 1
                else:
                    updated += 1
            finally:
                db.close()

        if attempted < len(all_missing):
            time.sleep(_DELAY_SECONDS)

    if failed_cases:
        print("")
        print("Failed cases:")
        for imdb_id, _, _ in failed_cases:
            print(f"  {imdb_id}")

    suffix = f" (ratings: {from_ratings} watchlist: {from_watchlist} candidates)"
    print(f"attempted={attempted} inserted={inserted} updated={updated} skipped=0 failed={failed}{suffix}")


if __name__ == "__main__":
    main()
