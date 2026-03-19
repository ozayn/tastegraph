"""Fetch metadata from OMDb and upsert into TitleMetadata."""

import sys
from typing import Literal

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.title_metadata import TitleMetadata
from app.services.omdb import TitleMetadataResult, fetch_title_metadata


def _truncate(s: str | None, max_len: int) -> str | None:
    if s is None:
        return None
    return s[:max_len] if len(s) > max_len else s


def upsert_metadata_result(result: TitleMetadataResult, db: Session) -> Literal["inserted", "updated"]:
    """Upsert TitleMetadataResult into TitleMetadata. Returns 'inserted' or 'updated'."""
    existing = db.query(TitleMetadata).filter(TitleMetadata.imdb_title_id == result.imdb_title_id).first()

    if existing:
        existing.title = _truncate(result.title, 500)
        existing.title_type = _truncate(result.title_type, 50)
        existing.year = result.year
        existing.genres = _truncate(result.genres, 500)
        existing.languages = _truncate(result.languages, 500)
        existing.country = _truncate(result.country, 500)
        existing.runtime_mins = result.runtime_mins
        existing.release_date = result.release_date
        existing.directors = _truncate(result.directors, 500)
        existing.imdb_rating = result.imdb_rating
        existing.num_votes = result.num_votes
        existing.url = _truncate(result.url, 500)
        db.commit()
        return "updated"
    else:
        db.add(
            TitleMetadata(
                imdb_title_id=result.imdb_title_id,
                title=_truncate(result.title, 500),
                title_type=_truncate(result.title_type, 50),
                year=result.year,
                genres=_truncate(result.genres, 500),
                languages=_truncate(result.languages, 500),
                country=_truncate(result.country, 500),
                runtime_mins=result.runtime_mins,
                release_date=result.release_date,
                directors=_truncate(result.directors, 500),
                imdb_rating=result.imdb_rating,
                num_votes=result.num_votes,
                url=_truncate(result.url, 500),
            )
        )
        db.commit()
        return "inserted"


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python -m app.scripts.enrich_one_title tt0111161")
        raise SystemExit(1)

    imdb_id = sys.argv[1].strip()
    result = fetch_title_metadata(imdb_id)

    if result is None:
        print("Failed: not found or invalid OMDb response")
        raise SystemExit(1)

    db = SessionLocal()
    try:
        action = upsert_metadata_result(result, db)
        print(f"{action.capitalize()}: {result.title or result.imdb_title_id}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
