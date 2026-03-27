"""Sync curated favorite list from an IMDb **list export** CSV (mirror semantics).

Use this when your source of truth is a public or private IMDb list. Export the
list as CSV from IMDb (list page → three-dot / Export → CSV), then run:

  cd backend && python -m app.scripts.sync_imdb_favorite_list --csv /path/to/export.csv

This calls the same importer as ``seed_favorite_list`` / admin upload:
rows in the CSV replace the in-DB set (missing rows are deleted).

Optional: downloading CSV without the browser
----------------------------------------------
IMDb does not document a stable unauthenticated export URL. If you discover an
export link while logged in (DevTools → Network, filter “csv”), you can fetch it
with cookies from a logged-in session, e.g.::

  curl -L -o list.csv -b 'ubid-main=...; session-id=...' 'https://www.imdb.com/list/...export...'

Use a short-lived export URL and keep cookies out of git. This is fragile if
IMDb changes endpoints; prefer manual export for reliability.

Usage:
  python -m app.scripts.sync_imdb_favorite_list --csv /path/to/imdb_list.csv
"""

from __future__ import annotations

import argparse
from pathlib import Path

from app.core.database import SessionLocal
from app.imports.favorite_list import import_favorite_list_from_csv


def main() -> None:
    p = argparse.ArgumentParser(
        description="Sync TasteGraph favorite_list table from an IMDb list export CSV."
    )
    p.add_argument(
        "--csv",
        type=Path,
        required=True,
        help="Path to IMDb list export CSV (Const, Position, Title, …)",
    )
    args = p.parse_args()
    path: Path = args.csv
    if not path.exists():
        print(f"File not found: {path}")
        raise SystemExit(1)

    db = SessionLocal()
    try:
        inserted, deleted, updated, errors = import_favorite_list_from_csv(db, path)
        parts = []
        if inserted:
            parts.append(f"{inserted} inserted")
        if updated:
            parts.append(f"{updated} updated")
        if deleted:
            parts.append(f"{deleted} deleted")
        msg = f"Synced favorite list from {path}: {', '.join(parts) or 'no changes'}"
        if errors:
            msg += f" ({errors} row(s) skipped)"
        print(msg)
    finally:
        db.close()


if __name__ == "__main__":
    main()
