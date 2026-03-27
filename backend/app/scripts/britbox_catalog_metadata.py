"""Compare ``data/britbox/catalog.json`` IMDb IDs to ``TitleMetadata``; enrich gaps via OMDb.

Uses the same enrichment path as ``enrich_missing_metadata`` (``enrich_imdb_ids_batch`` +
``upsert_metadata_result``).

Examples:
    cd backend && python -m app.scripts.britbox_catalog_metadata
    cd backend && python -m app.scripts.britbox_catalog_metadata --write-missing /tmp/britbox_missing.txt
    cd backend && python -m app.scripts.britbox_catalog_metadata --enrich --limit 40
    cd backend && python -m app.scripts.britbox_catalog_metadata --enrich --retry-failed --limit 20

Requires ``OMDB_API_KEY`` in ``backend/.env`` for ``--enrich``.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.core.database import SessionLocal
from app.models.metadata_enrichment_failure import MetadataEnrichmentFailure
from app.models.title_metadata import TitleMetadata
from app.scripts.enrich_missing_metadata import (
    _SKIP_RECENT_FAILURES_DAYS,
    enrich_imdb_ids_batch,
)
from app.services.provider_catalog import (
    _normalize_catalog_imdb_id,
    get_catalog_imdb_ids,
    load_catalog,
)

_SQL_CHUNK = 400


def _catalog_imdb_to_title(catalog: dict) -> dict[str, str]:
    out: dict[str, str] = {}
    for row in catalog.get("titles", []):
        nid = _normalize_catalog_imdb_id(row.get("imdb_id"))
        if not nid:
            continue
        t = (row.get("title") or "").strip()
        out[nid] = t or nid
    return out


def _title_metadata_ids_present(db, want: set[str]) -> set[str]:
    """Normalized imdb_title_id values that exist in DB for any id in ``want``."""
    present: set[str] = set()
    ids = sorted(want)
    for i in range(0, len(ids), _SQL_CHUNK):
        chunk = ids[i : i + _SQL_CHUNK]
        for (raw,) in db.query(TitleMetadata.imdb_title_id).filter(
            TitleMetadata.imdb_title_id.in_(chunk)
        ).all():
            n = _normalize_catalog_imdb_id(raw)
            if n:
                present.add(n)
    return present


def _filter_recent_failures(missing: set[str], *, retry_failed: bool) -> tuple[list[str], int]:
    if retry_failed:
        return sorted(missing), 0
    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=_SKIP_RECENT_FAILURES_DAYS)
        recent = {
            r[0]
            for r in db.query(MetadataEnrichmentFailure.imdb_title_id)
            .filter(MetadataEnrichmentFailure.last_failed_at >= cutoff)
            .all()
        }
        before = len(missing)
        kept = missing - recent
        return sorted(kept), before - len(kept)
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="BritBox catalog vs TitleMetadata gap report and optional OMDb enrichment"
    )
    parser.add_argument(
        "--write-missing",
        type=Path,
        default=None,
        help="Write missing IMDb IDs (one per line) to this file",
    )
    parser.add_argument(
        "--enrich",
        action="store_true",
        help="Run OMDb enrichment for missing IDs (up to --limit)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=25,
        help="Max titles to enrich per run (default 25)",
    )
    parser.add_argument(
        "--retry-failed",
        action="store_true",
        help=(
            "Include IDs that failed enrichment within the last "
            f"{_SKIP_RECENT_FAILURES_DAYS} days"
        ),
    )
    args = parser.parse_args()

    catalog = load_catalog("britbox-us")
    if catalog is None:
        print("ERROR: data/britbox/catalog.json not found. Run fetch_britbox_catalog first.", file=sys.stderr)
        raise SystemExit(1)

    want = get_catalog_imdb_ids(catalog)
    path = Path(__file__).resolve().parent.parent.parent / "data" / "britbox" / "catalog.json"
    src = catalog.get("source", "?")
    fetched = catalog.get("fetched_at", "?")

    db = SessionLocal()
    try:
        present = _title_metadata_ids_present(db, want)
    finally:
        db.close()

    missing = want - present
    title_by_id = _catalog_imdb_to_title(catalog)

    print(f"Catalog: {path}")
    print(f"  source={src!r}  fetched_at={fetched!r}")
    print(f"  snapshot IMDb ids (normalized): {len(want)}")
    print(f"  TitleMetadata rows matching those ids: {len(present)}")
    print(f"  missing in TitleMetadata: {len(missing)}")

    if missing:
        sample = sorted(missing)[:15]
        print(f"  sample missing: {', '.join(sample)}")
    else:
        print("  (nothing to enrich)")

    if args.write_missing is not None:
        args.write_missing.write_text("\n".join(sorted(missing)) + ("\n" if missing else ""))
        print(f"Wrote {len(missing)} id(s) to {args.write_missing}")

    if not args.enrich:
        return

    if not missing:
        print("enrich: skipped (no missing ids)")
        return

    to_process, skipped_fail = _filter_recent_failures(missing, retry_failed=args.retry_failed)
    if skipped_fail:
        print(
            f"enrich: skipped {skipped_fail} id(s) with recent enrichment failures "
            f"(use --retry-failed to include them)"
        )

    batch = to_process[: max(0, args.limit)]
    if not batch:
        print("enrich: no ids to process after filters")
        return

    title_lookup = {i: title_by_id.get(i) for i in batch}
    print(f"enrich: OMDb batch size={len(batch)} (limit={args.limit})")
    attempted, inserted, updated, failed = enrich_imdb_ids_batch(batch, title_lookup=title_lookup)
    sf = f" skipped_recent_failures={skipped_fail}" if skipped_fail else ""
    print(f"attempted={attempted} inserted={inserted} updated={updated} failed={failed}{sf} (britbox catalog)")


if __name__ == "__main__":
    main()
