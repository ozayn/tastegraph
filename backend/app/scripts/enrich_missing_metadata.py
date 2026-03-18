"""Enrich a small batch of ratings missing from TitleMetadata via OMDb."""

import sys
import time

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.imdb_rating import IMDbRating
from app.models.title_metadata import TitleMetadata
from app.scripts.enrich_one_title import upsert_metadata_result
from app.services.omdb import fetch_title_metadata

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
        existing_ids = select(TitleMetadata.imdb_title_id)
        missing = (
            db.query(IMDbRating.imdb_title_id)
            .filter(IMDbRating.imdb_title_id.notin_(existing_ids))
            .distinct()
            .limit(limit)
            .all()
        )
        missing_ids = [r[0] for r in missing]
    finally:
        db.close()

    if not missing_ids:
        print("attempted=0 inserted=0 updated=0 skipped=0 failed=0 (no missing)")
        return

    attempted = 0
    inserted = 0
    updated = 0
    failed = 0

    for imdb_id in missing_ids:
        result = fetch_title_metadata(imdb_id)
        attempted += 1

        if result is None:
            failed += 1
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

        if attempted < len(missing_ids):
            time.sleep(_DELAY_SECONDS)

    print(f"attempted={attempted} inserted={inserted} updated={updated} skipped=0 failed={failed}")


if __name__ == "__main__":
    main()
