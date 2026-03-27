"""Sync curated **favorite people** from an IMDb **favorite people export** CSV (mirror semantics).

Download from IMDb: Your favorite people list → Export → CSV (IMDb-style columns:
Name, Description, Known For, …). The importer infers actor / director / writer
from Description / Known For.

Alternatively use a simple two-column file: name,role (actor|director|writer).

Rows not in the file are removed from TasteGraph (same as ``seed_favorite_people``).

Usage:
  cd backend && python -m app.scripts.sync_imdb_favorite_people --csv /path/to/people.csv
"""

from __future__ import annotations

import argparse
from pathlib import Path

from app.core.database import SessionLocal
from app.imports.favorite_people import import_favorite_people_from_csv


def main() -> None:
    p = argparse.ArgumentParser(
        description="Mirror TasteGraph favorite people from an IMDb people export or simple CSV."
    )
    p.add_argument(
        "--csv",
        type=Path,
        required=True,
    )
    args = p.parse_args()
    path: Path = args.csv
    if not path.exists():
        print(f"File not found: {path}")
        raise SystemExit(1)

    db = SessionLocal()
    try:
        inserted, deleted, errors, fmt = import_favorite_people_from_csv(db, path)
        label = "IMDb-style export" if fmt == "imdb" else "simple name,role CSV"
        parts = []
        if inserted:
            parts.append(f"{inserted} inserted")
        if deleted:
            parts.append(f"{deleted} deleted")
        msg = f"Synced favorite people from {path} ({label}): {', '.join(parts) or 'no changes'}"
        if errors:
            msg += f" ({errors} skipped)"
        print(msg)
    finally:
        db.close()


if __name__ == "__main__":
    main()
