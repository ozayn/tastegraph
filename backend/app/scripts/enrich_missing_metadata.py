"""Enrich a small batch of ratings and watchlist titles missing or incomplete in TitleMetadata via OMDb."""

import sys
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy import or_

from app.core.database import SessionLocal
from app.models.imdb_rating import IMDbRating
from app.models.imdb_watchlist_item import IMDbWatchlistItem
from app.models.metadata_enrichment_failure import MetadataEnrichmentFailure
from app.models.title_metadata import TitleMetadata
from app.scripts.enrich_one_title import upsert_metadata_result
from app.services.omdb import fetch_title_metadata_with_error

_DEFAULT_LIMIT = 10
_DELAY_SECONDS = 1.0
_SKIP_RECENT_FAILURES_DAYS = 7

# Rows with any of these null/empty are eligible for backfill
_INCOMPLETE_FILTER = or_(
    TitleMetadata.poster.is_(None),
    TitleMetadata.poster == "",
    TitleMetadata.actors.is_(None),
    TitleMetadata.actors == "",
    TitleMetadata.plot.is_(None),
    TitleMetadata.plot == "",
    TitleMetadata.rated.is_(None),
    TitleMetadata.rated == "",
    TitleMetadata.metascore.is_(None),
)


def _record_failure(imdb_title_id: str, error: str) -> None:
    db = SessionLocal()
    try:
        row = db.get(MetadataEnrichmentFailure, imdb_title_id)
        err_trunc = (error or "unknown")[:500]
        if row:
            row.fail_count += 1
            row.last_failed_at = datetime.now(timezone.utc)
            row.last_error = err_trunc
        else:
            db.add(
                MetadataEnrichmentFailure(
                    imdb_title_id=imdb_title_id,
                    fail_count=1,
                    last_error=err_trunc,
                )
            )
        db.commit()
    finally:
        db.close()


def _clear_failure(imdb_title_id: str) -> None:
    db = SessionLocal()
    try:
        db.query(MetadataEnrichmentFailure).filter(
            MetadataEnrichmentFailure.imdb_title_id == imdb_title_id
        ).delete()
        db.commit()
    finally:
        db.close()


def main() -> None:
    args = [a for a in sys.argv[1:] if a != "--retry-failed"]
    retry_failed = "--retry-failed" in sys.argv
    limit = _DEFAULT_LIMIT
    if args:
        try:
            limit = int(args[0])
        except ValueError:
            print("Usage: python -m app.scripts.enrich_missing_metadata [limit] [--retry-failed]")
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

        incomplete_ids = {
            r[0]
            for r in db.query(TitleMetadata.imdb_title_id)
            .filter(_INCOMPLETE_FILTER)
            .distinct()
            .all()
        }
        all_rating_ids = {r[0] for r in db.query(IMDbRating.imdb_title_id).distinct().all()}
        all_watchlist_ids = {r[0] for r in db.query(IMDbWatchlistItem.imdb_title_id).distinct().all()}
        incomplete_candidates = incomplete_ids & (all_rating_ids | all_watchlist_ids)

        all_candidates_set = missing_ratings | missing_watchlist | incomplete_candidates

        # Exclude titles that failed within last N days (unless --retry-failed)
        skipped_recent_failures = 0
        if not retry_failed:
            cutoff = datetime.now(timezone.utc) - timedelta(days=_SKIP_RECENT_FAILURES_DAYS)
            recently_failed = {
                r[0]
                for r in db.query(MetadataEnrichmentFailure.imdb_title_id)
                .filter(MetadataEnrichmentFailure.last_failed_at >= cutoff)
                .all()
            }
            before_skip = len(all_candidates_set)
            all_candidates_set = all_candidates_set - recently_failed
            skipped_recent_failures = before_skip - len(all_candidates_set)

        all_candidates = list(all_candidates_set)[:limit]
        from_ratings = len(set(all_candidates) & all_rating_ids)
        from_watchlist = len(set(all_candidates) & all_watchlist_ids)

        # Build title lookup for failed-case reporting
        rating_titles = {
            r[0]: r[1]
            for r in db.query(IMDbRating.imdb_title_id, IMDbRating.title)
            .filter(IMDbRating.imdb_title_id.in_(all_candidates))
            .all()
            if r[1]
        }
        watchlist_titles = {
            r[0]: r[1]
            for r in db.query(IMDbWatchlistItem.imdb_title_id, IMDbWatchlistItem.title)
            .filter(IMDbWatchlistItem.imdb_title_id.in_(all_candidates))
            .all()
            if r[1]
        }
        title_lookup = {i: rating_titles.get(i) or watchlist_titles.get(i) for i in all_candidates}
    finally:
        db.close()

    if not all_candidates:
        sf = f" skipped_recent_failures={skipped_recent_failures}" if skipped_recent_failures else ""
        print(f"attempted=0 inserted=0 updated=0 skipped=0 failed=0{sf} (no missing or incomplete from ratings or watchlist)")
        return

    attempted = 0
    inserted = 0
    updated = 0
    failed = 0
    failed_cases: list[tuple[str, str | None, str]] = []

    for imdb_id in all_candidates:
        result, error_msg = fetch_title_metadata_with_error(imdb_id)
        attempted += 1

        if result is None:
            failed += 1
            title = title_lookup.get(imdb_id)
            reason = error_msg or "unknown"
            failed_cases.append((imdb_id, title, reason))
            title_part = f" {title}" if title else ""
            print(f"  failed: {imdb_id}{title_part} — {reason}")
            # Record failure for skip logic
            _record_failure(imdb_id, reason)
        else:
            _clear_failure(imdb_id)
            db = SessionLocal()
            try:
                action = upsert_metadata_result(result, db)
                if action == "inserted":
                    inserted += 1
                else:
                    updated += 1
            finally:
                db.close()

        if attempted < len(all_candidates):
            time.sleep(_DELAY_SECONDS)

    if failed_cases:
        print("")
        print("Failed cases:")
        for imdb_id, _, _ in failed_cases:
            print(f"  {imdb_id}")

    sf = f" skipped_recent_failures={skipped_recent_failures}" if skipped_recent_failures else ""
    suffix = f" (ratings: {from_ratings} watchlist: {from_watchlist} candidates)"
    print(f"attempted={attempted} inserted={inserted} updated={updated} skipped=0 failed={failed}{sf}{suffix}")


if __name__ == "__main__":
    main()
