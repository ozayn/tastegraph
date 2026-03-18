"""Import title metadata from repo data folder by default."""

import sys
from pathlib import Path

from app.imports.title_metadata import run_import

_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
_DEFAULT_PATH = _BACKEND_ROOT.parent / "data" / "imdb" / "title_metadata.csv"


def main() -> None:
    path = sys.argv[1] if len(sys.argv) > 1 else str(_DEFAULT_PATH)
    run_import(path)


if __name__ == "__main__":
    main()
