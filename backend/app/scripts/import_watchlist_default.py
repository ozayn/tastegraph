"""Import watchlist from repo data folder by default.

Optional:
  --mirror   Delete rows not in CSV (same as sync_imdb_watchlist)

Prefer for full export parity:
  python -m app.scripts.sync_imdb_watchlist --csv path/to/watchlist.csv
"""

import sys
from pathlib import Path

from app.imports.watchlist import run_import

_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
_DEFAULT_PATH = _BACKEND_ROOT.parent / "data" / "imdb" / "watchlist.csv"


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    path = str(args[0]) if args else str(_DEFAULT_PATH)
    mirror = "--mirror" in sys.argv
    run_import(path, mirror=mirror)


if __name__ == "__main__":
    main()
