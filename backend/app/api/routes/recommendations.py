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


def _build_simple_explanation(
    genre_contains: str | None,
    title_type: str | None,
    year_from: int | None,
    year_to: int | None,
) -> str:
    """Build a deterministic plain-text explanation from filter params."""
    base = "These are enriched titles you rated 8 or higher"
    parts = []

    if genre_contains and genre_contains.strip():
        parts.append(f"filtered to {genre_contains.strip()}")

    if title_type:
        type_labels = {"movie": "movies", "series": "series", "episode": "episodes"}
        type_label = type_labels.get(title_type, f"{title_type}s")
        parts.append(f"{type_label} only")

    if year_from is not None and year_to is not None:
        parts.append(f"from {year_from} through {year_to}")
    elif year_from is not None:
        parts.append(f"from {year_from} onward")
    elif year_to is not None:
        parts.append(f"through {year_to}")

    if parts:
        return f"{base}, {', '.join(parts)}."
    return f"{base}."


@router.get("/simple-explanation")
def recommendations_simple_explanation(
    genre_contains: str | None = Query(default=None, description="Filter by genre substring"),
    title_type: str | None = Query(default=None, description="movie, series, or episode"),
    year_from: int | None = Query(default=None, ge=1900, le=2100),
    year_to: int | None = Query(default=None, ge=1900, le=2100),
):
    """Plain-text explanation of the current simple recommendation filters."""
    explanation = _build_simple_explanation(genre_contains, title_type, year_from, year_to)
    return {"explanation": explanation}
