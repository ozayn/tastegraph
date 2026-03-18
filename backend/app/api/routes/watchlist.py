from fastapi import APIRouter
from sqlalchemy import func

from app.core.database import SessionLocal
from app.models.imdb_watchlist_item import IMDbWatchlistItem

router = APIRouter(prefix="/watchlist", tags=["watchlist"])


@router.get("/import-status")
def watchlist_import_status():
    """Basic import status from IMDbWatchlistItem table."""
    db = SessionLocal()
    try:
        total = db.query(IMDbWatchlistItem).count()
        latest = db.query(func.max(IMDbWatchlistItem.created_at)).scalar()
        return {
            "total_watchlist_items": total,
            "has_watchlist_data": total > 0,
            "latest_imported_created_at": latest.isoformat() if latest else None,
        }
    finally:
        db.close()
