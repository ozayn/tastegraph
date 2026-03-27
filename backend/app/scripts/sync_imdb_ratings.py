"""Sync IMDb ratings from your account **ratings export** CSV (mirror semantics).

Download from IMDb: Your ratings → overflow menu → Export (CSV).

This replaces the in-DB ratings set with the file: new rows, updates, and
deletions so TasteGraph matches the export.

Usage:
  cd backend && python -m app.scripts.sync_imdb_ratings --csv /path/to/ratings.csv
"""

from __future__ import annotations

import argparse
from pathlib import Path

from app.core.database import SessionLocal
from app.imports.ratings import import_ratings_from_csv


def main() -> None:
    p = argparse.ArgumentParser(
        description="Mirror TasteGraph imdb_ratings from an IMDb ratings export CSV."
    )
    p.add_argument(
        "--csv",
        type=Path,
        required=True,
        help="Path to IMDb ratings.csv export",
    )
    args = p.parse_args()
    path: Path = args.csv
    if not path.exists():
        print(f"File not found: {path}")
        raise SystemExit(1)

    db = SessionLocal()
    try:
        inserted, updated, skipped, errors, deleted = import_ratings_from_csv(
            db, path, mirror=True
        )
        parts = [
            f"{inserted} inserted",
            f"{updated} updated",
            f"{skipped} unchanged",
            f"{errors} errors",
        ]
        if deleted:
            parts.append(f"{deleted} deleted")
        print(f"Synced ratings from {path}: {', '.join(parts)}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
