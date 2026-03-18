"""Simple recommendation endpoints."""

from fastapi import APIRouter, Query
from sqlalchemy import desc
from sqlalchemy.sql.expression import nulls_last

from app.core.database import SessionLocal
from app.models.imdb_rating import IMDbRating
from app.models.title_metadata import TitleMetadata

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("/simple")
def recommendations_simple(
    genre_contains: str | None = Query(default=None, description="Filter by genre substring"),
    title_type: str | None = Query(default=None, description="movie, series, or episode"),
    year_from: int | None = Query(default=None, ge=1900, le=2100),
    year_to: int | None = Query(default=None, ge=1900, le=2100),
    limit: int = Query(default=10, ge=1, le=50),
):
    """Filtered recommendations from enriched titles rated 8+."""
    db = SessionLocal()
    try:
        q = (
            db.query(IMDbRating, TitleMetadata)
            .join(TitleMetadata, IMDbRating.imdb_title_id == TitleMetadata.imdb_title_id)
            .filter(IMDbRating.user_rating >= 8)
        )

        if genre_contains:
            q = q.filter(TitleMetadata.genres.ilike(f"%{genre_contains}%"))
        if title_type:
            q = q.filter(TitleMetadata.title_type == title_type)
        if year_from is not None:
            q = q.filter(TitleMetadata.year >= year_from)
        if year_to is not None:
            q = q.filter(TitleMetadata.year <= year_to)

        rows = (
            q.order_by(
                desc(IMDbRating.user_rating),
                nulls_last(desc(IMDbRating.date_rated)),
            )
            .limit(limit)
            .all()
        )

        return [
            {
                "imdb_title_id": r.imdb_title_id,
                "title": m.title,
                "year": m.year,
                "genres": m.genres,
                "user_rating": r.user_rating,
            }
            for r, m in rows
        ]
    finally:
        db.close()
