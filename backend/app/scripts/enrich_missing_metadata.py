"""Enrich a small batch of library titles missing or incomplete in TitleMetadata via OMDb.

Candidates: ratings, watchlist, and curated favorite_list (missing row or incomplete metadata).
"""

import sys
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.favorite_list_item import FavoriteListItem
from app.models.imdb_rating import IMDbRating
from app.models.imdb_watchlist_item import IMDbWatchlistItem
from app.models.metadata_enrichment_failure import MetadataEnrichmentFailure
from app.models.title_metadata import TitleMetadata
from app.scripts.enrich_one_title import upsert_metadata_result
from app.services.omdb import fetch_title_metadata_with_error, is_global_omdb_unavailable

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


def enrich_imdb_ids_batch(
    imdb_ids: list[str],
    *,
    title_lookup: dict[str, str | None] | None = None,
) -> tuple[int, int, int, int]:
    """OMDb fetch + TitleMetadata upsert for each id (same pipeline as this module's main loop).

    Returns (attempted, inserted, updated, failed). Stops early if OMDb is globally unavailable.
    """
    title_lookup = title_lookup or {}
    attempted = 0
    inserted = 0
    updated = 0
    failed = 0
    failed_cases: list[tuple[str, str | None, str]] = []

    for idx, imdb_id in enumerate(imdb_ids):
        result, error_msg = fetch_title_metadata_with_error(imdb_id)
        attempted += 1

        if result is None:
            reason = error_msg or "unknown"
            if is_global_omdb_unavailable(reason):
                print(f"OMDb unavailable ({reason}). Stopping run.")
                break
            failed += 1
            title = title_lookup.get(imdb_id)
            failed_cases.append((imdb_id, title, reason))
            title_part = f" {title}" if title else ""
            print(f"  failed: {imdb_id}{title_part} — {reason}")
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

        if idx < len(imdb_ids) - 1:
            time.sleep(_DELAY_SECONDS)

    if failed_cases:
        print("")
        print("Failed cases:")
        for fid, _, _ in failed_cases:
            print(f"  {fid}")

    return attempted, inserted, updated, failed


def collect_enrichment_candidates(
    db: Session,
    *,
    limit: int,
    retry_failed: bool = False,
) -> tuple[
    list[str],
    dict[str, str | None],
    int,
    dict[str, int],
]:
    """Pick up to ``limit`` imdb_title_ids needing OMDb enrichment (missing or incomplete).

    Includes titles referenced by ratings, watchlist, or favorite_list.

    Returns (ids, title_lookup, skipped_recent_failures, counts) where counts has
    keys from_ratings, from_watchlist, from_favorite_list for the returned id list.
    """
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
    missing_favorites = {
        r[0]
        for r in db.query(FavoriteListItem.imdb_title_id)
        .filter(FavoriteListItem.imdb_title_id.notin_(existing_subq))
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
    all_favorite_ids = {r[0] for r in db.query(FavoriteListItem.imdb_title_id).distinct().all()}
    incomplete_candidates = incomplete_ids & (
        all_rating_ids | all_watchlist_ids | all_favorite_ids
    )

    all_candidates_set = (
        missing_ratings | missing_watchlist | missing_favorites | incomplete_candidates
    )

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
    from_favorite_list = len(set(all_candidates) & all_favorite_ids)

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
    favorite_titles = {
        r[0]: r[1]
        for r in db.query(FavoriteListItem.imdb_title_id, FavoriteListItem.title)
        .filter(FavoriteListItem.imdb_title_id.in_(all_candidates))
        .all()
        if r[1]
    }
    title_lookup = {
        i: rating_titles.get(i) or watchlist_titles.get(i) or favorite_titles.get(i)
        for i in all_candidates
    }
    counts = {
        "from_ratings": from_ratings,
        "from_watchlist": from_watchlist,
        "from_favorite_list": from_favorite_list,
    }
    return all_candidates, title_lookup, skipped_recent_failures, counts


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
        all_candidates, title_lookup, skipped_recent_failures, counts = (
            collect_enrichment_candidates(db, limit=limit, retry_failed=retry_failed)
        )
    finally:
        db.close()

    if not all_candidates:
        sf = f" skipped_recent_failures={skipped_recent_failures}" if skipped_recent_failures else ""
        print(
            f"attempted=0 inserted=0 updated=0 skipped=0 failed=0{sf} "
            "(no missing or incomplete from ratings, watchlist, or favorite_list)"
        )
        return

    attempted, inserted, updated, failed = enrich_imdb_ids_batch(
        all_candidates, title_lookup=title_lookup
    )

    sf = f" skipped_recent_failures={skipped_recent_failures}" if skipped_recent_failures else ""
    suffix = (
        f" (ratings: {counts['from_ratings']} watchlist: {counts['from_watchlist']} "
        f"favorite_list: {counts['from_favorite_list']} candidates)"
    )
    print(f"attempted={attempted} inserted={inserted} updated={updated} skipped=0 failed={failed}{sf}{suffix}")


if __name__ == "__main__":
    main()
