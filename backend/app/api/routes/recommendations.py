"""Simple recommendation endpoints."""

from fastapi import APIRouter, Query
from sqlalchemy import case, desc, or_
from sqlalchemy.sql.expression import nulls_last

from app.core.database import SessionLocal
from app.models.imdb_rating import IMDbRating
from app.models.imdb_watchlist_item import IMDbWatchlistItem
from app.models.title_metadata import TitleMetadata

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("/genres")
def recommendations_genres():
    """Available genres from enriched ratings (rated 8+)."""
    db = SessionLocal()
    try:
        rows = (
            db.query(TitleMetadata.genres)
            .join(IMDbRating, TitleMetadata.imdb_title_id == IMDbRating.imdb_title_id)
            .filter(IMDbRating.user_rating >= 8)
            .filter(TitleMetadata.genres.isnot(None))
            .all()
        )
        genres: set[str] = set()
        for (g,) in rows:
            for part in (g or "").split(","):
                s = part.strip()
                if s:
                    genres.add(s)
        return sorted(genres)
    finally:
        db.close()


@router.get("/simple")
def recommendations_simple(
    genres: list[str] | None = Query(default=None, description="Filter by genres (OR)"),
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

        if genres:
            genre_filters = [
                TitleMetadata.genres.ilike(f"%{g.strip()}%") for g in genres if g.strip()
            ]
            if genre_filters:
                q = q.filter(or_(*genre_filters))
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


@router.get("/watchlist-simple")
def recommendations_watchlist_simple(
    title_type: str | None = Query(default=None, description="movie, TV Series, etc."),
    year_from: int | None = Query(default=None, ge=1900, le=2100),
    year_to: int | None = Query(default=None, ge=1900, le=2100),
    limit: int = Query(default=20, ge=1, le=100),
):
    """Recommendations from watchlist, preferring items with title/title_type/year."""
    db = SessionLocal()
    try:
        q = db.query(IMDbWatchlistItem)

        if title_type:
            q = q.filter(IMDbWatchlistItem.title_type == title_type)
        if year_from is not None:
            q = q.filter(IMDbWatchlistItem.year >= year_from)
        if year_to is not None:
            q = q.filter(IMDbWatchlistItem.year <= year_to)

        has_meta = (
            IMDbWatchlistItem.title.isnot(None)
            & IMDbWatchlistItem.title_type.isnot(None)
            & IMDbWatchlistItem.year.isnot(None)
        )
        meta_first = case((has_meta, 0), else_=1)

        rows = (
            q.order_by(meta_first.asc(), IMDbWatchlistItem.position.asc())
            .limit(limit)
            .all()
        )

        return [
            {
                "imdb_title_id": r.imdb_title_id,
                "title": r.title,
                "title_type": r.title_type,
                "year": r.year,
                "your_rating": r.your_rating,
                "date_rated": r.date_rated.isoformat() if r.date_rated else None,
            }
            for r in rows
        ]
    finally:
        db.close()


def _build_simple_explanation(
    genres: list[str] | None,
    title_type: str | None,
    year_from: int | None,
    year_to: int | None,
) -> str:
    """Build a deterministic plain-text explanation from filter params."""
    base = "These are enriched titles you rated 8 or higher"
    parts = []

    if genres:
        cleaned = [g.strip() for g in genres if g.strip()]
        if cleaned:
            if len(cleaned) == 1:
                parts.append(f"in {cleaned[0]}")
            elif len(cleaned) == 2:
                parts.append(f"in {cleaned[0]} or {cleaned[1]}")
            else:
                parts.append(f"in {', '.join(cleaned[:-1])}, or {cleaned[-1]}")

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
    genres: list[str] | None = Query(default=None, description="Filter by genres (OR)"),
    title_type: str | None = Query(default=None, description="movie, series, or episode"),
    year_from: int | None = Query(default=None, ge=1900, le=2100),
    year_to: int | None = Query(default=None, ge=1900, le=2100),
):
    """Plain-text explanation of the current simple recommendation filters."""
    explanation = _build_simple_explanation(genres, title_type, year_from, year_to)
    return {"explanation": explanation}
