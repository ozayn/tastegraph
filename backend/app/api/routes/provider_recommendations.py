"""Provider-aware recommendation endpoints (prototype).

BritBox Amazon Channel (US) catalog scored by taste-signal high-fit and ML 8+ probability.
Catalog sourced from a JustWatch snapshot stored in data/britbox/catalog.json.
"""

from fastapi import APIRouter, Query

from app.core.config import settings
from app.core.database import SessionLocal
from app.services.provider_catalog import get_provider_high_fit, get_provider_ml, load_catalog

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("/britbox")
def recommendations_britbox(
    limit: int = Query(default=15, ge=1, le=50),
    title_type: str | None = Query(default=None, description="movie or show"),
    exclude_rated: bool = Query(default=True),
):
    """BritBox Amazon Channel: titles ranked by taste-signal high-fit. Prototype."""
    db = SessionLocal()
    try:
        return get_provider_high_fit(
            db, provider_slug="britbox-us", limit=limit,
            exclude_rated=exclude_rated, title_type=title_type,
        )
    finally:
        db.close()


@router.get("/britbox-ml")
def recommendations_britbox_ml(
    limit: int = Query(default=15, ge=1, le=50),
    title_type: str | None = Query(default=None, description="movie or show"),
    exclude_rated: bool = Query(default=True),
):
    """BritBox Amazon Channel: titles ranked by ML 8+ probability. Prototype. Requires trained model."""
    db = SessionLocal()
    try:
        return get_provider_ml(
            db, provider_slug="britbox-us", limit=limit,
            exclude_rated=exclude_rated, title_type=title_type,
        )
    finally:
        db.close()


@router.get("/britbox-stats")
def recommendations_britbox_stats():
    """BritBox catalog snapshot stats."""
    catalog = load_catalog("britbox-us")
    if catalog is None:
        msg = "BritBox catalog snapshot is not available."
        if settings.DEBUG:
            msg += " Run: cd backend && python -m app.scripts.fetch_britbox_catalog"
        return {"loaded": False, "message": msg}
    return {
        "loaded": True,
        "provider": catalog.get("provider_clear_name", "BritBox"),
        "fetched_at": catalog.get("fetched_at"),
        "stats": catalog.get("stats", {}),
    }
