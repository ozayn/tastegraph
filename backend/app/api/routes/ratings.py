from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import desc, func, extract
from sqlalchemy.sql.expression import nulls_last, and_

from app.core.database import SessionLocal
from app.imports.ratings import import_ratings_from_csv
from app.models.imdb_rating import IMDbRating

router = APIRouter(prefix="/ratings", tags=["ratings"])


class ImportRequest(BaseModel):
    file_path: str


@router.get("/summary")
def ratings_summary():
    """Basic ratings summary stats."""
    db = SessionLocal()
    try:
        total = db.query(IMDbRating).count()
        stats = (
            db.query(
                func.min(IMDbRating.user_rating).label("min_rating"),
                func.max(IMDbRating.user_rating).label("max_rating"),
                func.avg(IMDbRating.user_rating).label("avg_rating"),
            )
            .filter(IMDbRating.user_rating.isnot(None))
            .one()
        )
        count_by = (
            db.query(IMDbRating.user_rating, func.count(IMDbRating.id))
            .filter(IMDbRating.user_rating.isnot(None))
            .group_by(IMDbRating.user_rating)
            .all()
        )
        count_by_rating = {int(r): c for r, c in count_by}

        return {
            "total_ratings": total,
            "min_rating": float(stats.min_rating) if stats.min_rating is not None else None,
            "max_rating": float(stats.max_rating) if stats.max_rating is not None else None,
            "average_rating": round(float(stats.avg_rating), 2) if stats.avg_rating is not None else None,
            "count_by_rating": count_by_rating,
        }
    finally:
        db.close()


@router.get("/distribution")
def ratings_distribution():
    """Top rating distribution insights for quick UI use."""
    db = SessionLocal()
    try:
        count_by = (
            db.query(IMDbRating.user_rating, func.count(IMDbRating.id))
            .filter(IMDbRating.user_rating.isnot(None))
            .group_by(IMDbRating.user_rating)
            .all()
        )
        count_by_rating = {int(r): c for r, c in count_by}

        most_common_rating = None
        count_of_most_common_rating = 0
        if count_by_rating:
            most_common_rating = max(count_by_rating, key=count_by_rating.get)
            count_of_most_common_rating = count_by_rating[most_common_rating]

        return {
            "most_common_rating": most_common_rating,
            "count_of_most_common_rating": count_of_most_common_rating,
            "count_rated_6": count_by_rating.get(6, 0),
            "count_rated_7": count_by_rating.get(7, 0),
            "count_rated_8_plus": sum(c for r, c in count_by_rating.items() if r >= 8),
        }
    finally:
        db.close()


@router.get("/taste-hints")
def ratings_taste_hints():
    """First taste-profile hints from ratings only (no metadata)."""
    STRONG_POSITIVE = 8
    WEAK_NEGATIVE = 6

    db = SessionLocal()
    try:
        strong_positive_count = (
            db.query(IMDbRating)
            .filter(IMDbRating.user_rating >= STRONG_POSITIVE)
            .count()
        )
        neutral_or_mid_count = (
            db.query(IMDbRating)
            .filter(
                and_(
                    IMDbRating.user_rating >= WEAK_NEGATIVE,
                    IMDbRating.user_rating < STRONG_POSITIVE,
                )
            )
            .count()
        )
        weak_negative_count = (
            db.query(IMDbRating)
            .filter(IMDbRating.user_rating < WEAK_NEGATIVE)
            .count()
        )

        return {
            "strong_positive_threshold": STRONG_POSITIVE,
            "weak_negative_threshold": WEAK_NEGATIVE,
            "strong_positive_count": strong_positive_count,
            "neutral_or_mid_count": neutral_or_mid_count,
            "weak_negative_count": weak_negative_count,
        }
    finally:
        db.close()


@router.get("/strong-positive-sample")
def ratings_strong_positive_sample(limit: int = Query(default=10, ge=1, le=50)):
    """Sample of strongest positive ratings (user_rating >= 8)."""
    db = SessionLocal()
    try:
        rows = (
            db.query(IMDbRating)
            .filter(IMDbRating.user_rating >= 8)
            .order_by(
                desc(IMDbRating.user_rating),
                nulls_last(desc(IMDbRating.date_rated)),
            )
            .limit(limit)
            .all()
        )
        return [
            {
                "imdb_title_id": r.imdb_title_id,
                "user_rating": r.user_rating,
                "date_rated": r.date_rated.isoformat() if r.date_rated else None,
            }
            for r in rows
        ]
    finally:
        db.close()


@router.get("/by-year")
def ratings_by_year():
    """Year-based rating insights from date_rated."""
    db = SessionLocal()
    try:
        dates = (
            db.query(
                func.min(IMDbRating.date_rated).label("earliest"),
                func.max(IMDbRating.date_rated).label("latest"),
            )
            .filter(IMDbRating.date_rated.isnot(None))
            .one()
        )
        count_by = (
            db.query(extract("year", IMDbRating.date_rated).label("year"), func.count(IMDbRating.id))
            .filter(IMDbRating.date_rated.isnot(None))
            .group_by(extract("year", IMDbRating.date_rated))
            .all()
        )
        ratings_count_by_year = {int(y): c for y, c in count_by}

        return {
            "earliest_rating_date": dates.earliest.isoformat() if dates.earliest else None,
            "latest_rating_date": dates.latest.isoformat() if dates.latest else None,
            "ratings_count_by_year": ratings_count_by_year,
        }
    finally:
        db.close()


@router.get("/recent")
def ratings_recent(limit: int = Query(default=5, ge=1, le=20)):
    """Most recently rated items for quick display."""
    db = SessionLocal()
    try:
        rows = (
            db.query(IMDbRating)
            .order_by(
                nulls_last(desc(IMDbRating.date_rated)),
                desc(IMDbRating.created_at),
            )
            .limit(limit)
            .all()
        )
        return [
            {
                "imdb_title_id": r.imdb_title_id,
                "user_rating": r.user_rating,
                "date_rated": r.date_rated.isoformat() if r.date_rated else None,
            }
            for r in rows
        ]
    finally:
        db.close()


@router.get("")
def list_ratings(limit: int = Query(default=20, ge=1, le=100)):
    """List imported IMDb ratings, ordered by date_rated descending."""
    db = SessionLocal()
    try:
        rows = (
            db.query(IMDbRating)
            .order_by(nulls_last(desc(IMDbRating.date_rated)))
            .limit(limit)
            .all()
        )
        return [
            {
                "imdb_title_id": r.imdb_title_id,
                "title": r.title,
                "user_rating": r.user_rating,
                "year": r.year,
                "genres": r.genres,
                "date_rated": r.date_rated.isoformat() if r.date_rated else None,
            }
            for r in rows
        ]
    finally:
        db.close()


@router.post("/import")
def import_ratings(request: ImportRequest):
    """Import IMDb ratings from a local CSV file path."""
    path = Path(request.file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {path}")

    if not path.suffix.lower() == ".csv":
        raise HTTPException(status_code=400, detail="File must be a CSV")

    db = SessionLocal()
    try:
        inserted, skipped, errors = import_ratings_from_csv(db, path)
        return {"inserted": inserted, "skipped": skipped, "errors": errors}
    finally:
        db.close()
