"""Compare ``data/mubi/catalog.json`` IMDb IDs to ``TitleMetadata``; enrich gaps via OMDb.

Same flow as ``britbox_catalog_metadata``; shared implementation in ``snapshot_catalog_metadata_core``.

Examples:
    cd backend && python -m app.scripts.mubi_catalog_metadata
    cd backend && python -m app.scripts.mubi_catalog_metadata --write-missing /tmp/mubi_missing.txt
    cd backend && python -m app.scripts.mubi_catalog_metadata --enrich --limit 40
    cd backend && python -m app.scripts.mubi_catalog_metadata --enrich --retry-failed --limit 20

Requires ``OMDB_API_KEY`` in ``backend/.env`` for ``--enrich``.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from app.scripts.enrich_missing_metadata import _SKIP_RECENT_FAILURES_DAYS
from app.scripts.snapshot_catalog_metadata_core import run_snapshot_catalog_metadata_cli


def main() -> None:
    parser = argparse.ArgumentParser(
        description="MUBI catalog vs TitleMetadata gap report and optional OMDb enrichment"
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

    run_snapshot_catalog_metadata_cli(
        "mubi-us",
        display_name="MUBI",
        write_missing=args.write_missing,
        enrich=args.enrich,
        limit=args.limit,
        retry_failed=args.retry_failed,
    )


if __name__ == "__main__":
    main()
