"""Run all IMDb CSV syncs from a folder or explicit paths.

Typical layout (same as ``data/imdb/`` in the repo):

  ratings.csv          — IMDb ratings export
  watchlist.csv        — IMDb watchlist export
  favorite_list.csv      — IMDb **list** export (curated favorites list)
  favorite_people.csv    — IMDb favorite people export (or simple name,role)

Any missing file is skipped. Use per-source flags to override paths.

Examples:
  cd backend && python -m app.scripts.sync_imdb_exports --data-dir ../data/imdb
  cd backend && python -m app.scripts.sync_imdb_exports \\
    --ratings ~/Downloads/ratings.csv \\
    --watchlist ~/Downloads/watchlist.csv

See docs/imdb-export-sync.md for where to download each CSV on IMDb.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from app.core.database import SessionLocal
from app.imports.favorite_list import import_favorite_list_from_csv
from app.imports.favorite_people import import_favorite_people_from_csv
from app.imports.ratings import import_ratings_from_csv
from app.imports.watchlist import import_watchlist_from_csv

_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
_DEFAULT_DATA_DIR = _BACKEND_ROOT.parent / "data" / "imdb"


def _resolve(path: Path | None, data_dir: Path, name: str) -> Path | None:
    if path is not None:
        return path if path.exists() else None
    candidate = data_dir / name
    return candidate if candidate.exists() else None


def main() -> None:
    p = argparse.ArgumentParser(
        description="Mirror TasteGraph IMDb-derived tables from export CSVs."
    )
    p.add_argument(
        "--data-dir",
        type=Path,
        default=_DEFAULT_DATA_DIR,
        help=f"Directory containing standard filenames (default: {_DEFAULT_DATA_DIR})",
    )
    p.add_argument("--ratings", type=Path, default=None, help="Override ratings.csv path")
    p.add_argument("--watchlist", type=Path, default=None, help="Override watchlist.csv path")
    p.add_argument(
        "--favorite-list",
        type=Path,
        default=None,
        help="Override favorite_list.csv (IMDb list export)",
    )
    p.add_argument(
        "--favorite-people",
        type=Path,
        default=None,
        help="Override favorite_people.csv",
    )
    args = p.parse_args()
    data_dir = args.data_dir

    db = SessionLocal()
    try:
        print(f"Data directory: {data_dir}")

        rp = _resolve(args.ratings, data_dir, "ratings.csv")
        if rp:
            ins, upd, skip, err, deleted = import_ratings_from_csv(db, rp, mirror=True)
            print(
                f"  ratings ({rp.name}): {ins} inserted, {upd} updated, "
                f"{skip} unchanged, {err} errors, {deleted} deleted"
            )
        else:
            print("  ratings: skipped (file not found)")

        wp = _resolve(args.watchlist, data_dir, "watchlist.csv")
        if wp:
            ins, upd, err, deleted = import_watchlist_from_csv(db, wp, mirror=True)
            print(
                f"  watchlist ({wp.name}): {ins} inserted, {upd} updated, "
                f"{err} errors, {deleted} deleted"
            )
        else:
            print("  watchlist: skipped (file not found)")

        fp = _resolve(args.favorite_list, data_dir, "favorite_list.csv")
        if fp:
            ins, deleted, upd, err = import_favorite_list_from_csv(db, fp)
            print(
                f"  favorite_list ({fp.name}): {ins} inserted, {upd} updated, "
                f"{deleted} deleted, {err} row errors"
            )
        else:
            print("  favorite_list: skipped (file not found)")

        pp = _resolve(args.favorite_people, data_dir, "favorite_people.csv")
        if pp:
            ins, deleted, err, fmt = import_favorite_people_from_csv(db, pp)
            print(
                f"  favorite_people ({pp.name}, {fmt}): {ins} inserted, "
                f"{deleted} deleted, {err} skipped"
            )
        else:
            print("  favorite_people: skipped (file not found)")

        print("Done.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
