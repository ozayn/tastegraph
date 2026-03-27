"""Sync IMDb watchlist from your account **watchlist export** CSV (mirror semantics).

Download from IMDb: Watchlist → overflow menu → Export (CSV).

Rows in the DB that are not in the file are removed so the DB matches IMDb.

Usage:
  cd backend && python -m app.scripts.sync_imdb_watchlist --csv /path/to/watchlist.csv
"""

from __future__ import annotations

import argparse
from pathlib import Path

from app.core.database import SessionLocal
from app.imports.watchlist import import_watchlist_from_csv


def main() -> None:
    p = argparse.ArgumentParser(
        description="Mirror TasteGraph imdb_watchlist from an IMDb watchlist export CSV."
    )
    p.add_argument(
        "--csv",
        type=Path,
        required=True,
        help="Path to IMDb watchlist.csv export",
    )
    args = p.parse_args()
    path: Path = args.csv
    if not path.exists():
        print(f"File not found: {path}")
        raise SystemExit(1)

    db = SessionLocal()
    try:
        inserted, updated, errors, deleted = import_watchlist_from_csv(
            db, path, mirror=True
        )
        parts = [f"{inserted} inserted", f"{updated} updated", f"{errors} errors"]
        if deleted:
            parts.append(f"{deleted} deleted")
        print(f"Synced watchlist from {path}: {', '.join(parts)}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
