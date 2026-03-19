"""List metadata_enrichment_failure rows (titles currently skipped). Run from backend: python -m app.scripts.list_metadata_enrichment_failures [limit]"""

import sys

from app.core.database import SessionLocal
from app.models.imdb_rating import IMDbRating
from app.models.imdb_watchlist_item import IMDbWatchlistItem
from app.models.metadata_enrichment_failure import MetadataEnrichmentFailure
from app.models.title_metadata import TitleMetadata


def main() -> None:
    limit = None
    if len(sys.argv) > 1:
        try:
            limit = int(sys.argv[1])
        except ValueError:
            print("Usage: python -m app.scripts.list_metadata_enrichment_failures [limit]")
            raise SystemExit(1)

    db = SessionLocal()
    try:
        q = (
            db.query(MetadataEnrichmentFailure)
            .order_by(MetadataEnrichmentFailure.last_failed_at.desc())
        )
        if limit is not None:
            q = q.limit(limit)
        rows = q.all()

        if not rows:
            print("No metadata enrichment failures.")
            return

        ids = [r.imdb_title_id for r in rows]
        title_lookup = {}
        for imdb_id, title in (
            db.query(TitleMetadata.imdb_title_id, TitleMetadata.title)
            .filter(TitleMetadata.imdb_title_id.in_(ids))
            .all()
        ):
            if title:
                title_lookup[imdb_id] = title
        for imdb_id, title in (
            db.query(IMDbRating.imdb_title_id, IMDbRating.title)
            .filter(IMDbRating.imdb_title_id.in_(ids))
            .all()
        ):
            if title and imdb_id not in title_lookup:
                title_lookup[imdb_id] = title
        for imdb_id, title in (
            db.query(IMDbWatchlistItem.imdb_title_id, IMDbWatchlistItem.title)
            .filter(IMDbWatchlistItem.imdb_title_id.in_(ids))
            .all()
        ):
            if title and imdb_id not in title_lookup:
                title_lookup[imdb_id] = title

        print(f"metadata_enrichment_failure ({len(rows)} rows):")
        print("-" * 80)
        for r in rows:
            title = title_lookup.get(r.imdb_title_id) or ""
            title_part = f"  {title}" if title else ""
            err = (r.last_error or "")[:60]
            if r.last_error and len(r.last_error) > 60:
                err += "..."
            print(f"{r.imdb_title_id}{title_part}")
            print(f"  fail_count={r.fail_count}  last_failed_at={r.last_failed_at}  last_error={err}")
            print("")
    finally:
        db.close()


if __name__ == "__main__":
    main()
