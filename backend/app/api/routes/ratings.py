from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import desc
from sqlalchemy.sql.expression import nulls_last

from app.core.database import SessionLocal
from app.imports.ratings import import_ratings_from_csv
from app.models.imdb_rating import IMDbRating

router = APIRouter(prefix="/ratings", tags=["ratings"])


class ImportRequest(BaseModel):
    file_path: str


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
