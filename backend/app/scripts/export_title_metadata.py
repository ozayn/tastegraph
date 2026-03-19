"""Export TitleMetadata to CSV for sync to remote."""

import csv
import sys
from pathlib import Path

from app.core.database import SessionLocal
from app.models.title_metadata import TitleMetadata

_COLUMNS = [
    "imdb_title_id",
    "title",
    "title_type",
    "year",
    "genres",
    "languages",
    "country",
    "runtime_mins",
    "release_date",
    "directors",
    "imdb_rating",
    "num_votes",
    "url",
]


def export_to_csv(csv_path: Path) -> int:
    """Export all TitleMetadata to CSV. Returns row count."""
    db = SessionLocal()
    try:
        rows = db.query(TitleMetadata).all()
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=_COLUMNS, extrasaction="ignore")
            writer.writeheader()
            for r in rows:
                writer.writerow({
                    "imdb_title_id": r.imdb_title_id,
                    "title": r.title or "",
                    "title_type": r.title_type or "",
                    "year": r.year or "",
                    "genres": r.genres or "",
                    "languages": r.languages or "",
                    "country": r.country or "",
                    "runtime_mins": r.runtime_mins or "",
                    "release_date": r.release_date.isoformat() if r.release_date else "",
                    "directors": r.directors or "",
                    "imdb_rating": r.imdb_rating or "",
                    "num_votes": r.num_votes or "",
                    "url": r.url or "",
                })
        return len(rows)
    finally:
        db.close()


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python -m app.scripts.export_title_metadata <output.csv>")
        raise SystemExit(1)

    path = Path(sys.argv[1])
    path.parent.mkdir(parents=True, exist_ok=True)
    count = export_to_csv(path)
    print(f"Exported {count} rows to {path}")


if __name__ == "__main__":
    main()
