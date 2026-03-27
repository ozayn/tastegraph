"""Import ratings from repo data folder by default.

Optional flags (path should be the first non-flag argument, or use default path):
  --upsert   Update existing rows from CSV
  --mirror   Full parity: upsert + delete rows not in CSV (same as sync_imdb_ratings)

For a one-shot mirror from an export, prefer:
  python -m app.scripts.sync_imdb_ratings --csv path/to/ratings.csv
"""

import sys
from pathlib import Path

from app.imports.ratings import run_import

_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
_DEFAULT_PATH = _BACKEND_ROOT.parent / "data" / "imdb" / "ratings.csv"


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    path = str(args[0]) if args else str(_DEFAULT_PATH)
    upsert = "--upsert" in sys.argv
    mirror = "--mirror" in sys.argv
    run_import(path, upsert=upsert or mirror, mirror=mirror)


if __name__ == "__main__":
    main()
