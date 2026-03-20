"""Delete a single rating by IMDb title ID. Use when removing an entry from ratings.csv.

Usage:
  python -m app.scripts.delete_rating tt6333074

Run locally or via `railway run python -m app.scripts.delete_rating tt6333074` for remote.
"""

import sys

from app.core.database import SessionLocal
from app.models.imdb_rating import IMDbRating


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python -m app.scripts.delete_rating <imdb_title_id>")
        sys.exit(1)
    imdb_id = sys.argv[1].strip()
    if not imdb_id.startswith("tt"):
        print("Error: imdb_title_id should look like tt1234567")
        sys.exit(1)

    db = SessionLocal()
    try:
        row = db.query(IMDbRating).filter(IMDbRating.imdb_title_id == imdb_id).first()
        if not row:
            print(f"Not found: {imdb_id}")
            sys.exit(0)
        db.delete(row)
        db.commit()
        print(f"Deleted: {imdb_id} ({row.title or 'untitled'})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
