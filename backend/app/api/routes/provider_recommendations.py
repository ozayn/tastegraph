"""Provider-aware recommendation endpoints (prototype).

BritBox (US) catalog scored by taste-signal high-fit and ML 8+ probability.
Catalog snapshot from Watchmode (see ``app.scripts.fetch_britbox_catalog``) in data/britbox/catalog.json.
"""

from fastapi import APIRouter, Query

from app.core.config import settings
from app.core.database import SessionLocal
from app.services.provider_catalog import (
    get_britbox_matched_pool_profile,
    get_provider_high_fit,
    get_provider_ml,
    load_catalog,
)

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("/britbox")
def recommendations_britbox(
    limit: int = Query(default=15, ge=1, le=50),
    title_type: str = Query(
        default="show",
        description="Catalog object_type filter: show (series), movie, or all",
    ),
    exclude_rated: bool = Query(default=True),
    decade: str | None = Query(
        default=None,
        description="Restrict pool to release decade, e.g. 2020 or 2020s (applied before ranking)",
    ),
    year_min: int | None = Query(
        default=None,
        ge=1870,
        le=2035,
        description="Minimum release year (applied before ranking)",
    ),
    country: str | None = Query(
        default=None,
        max_length=80,
        description="Substring match on country (case-insensitive, applied before ranking)",
    ),
    similar_to: str | None = Query(
        default=None,
        max_length=150,
        description="Title hint: keep titles that share a genre with this resolved reference (rated/watchlist)",
    ),
):
    """BritBox catalog: series (default) ranked by taste-signal high-fit. Watchlist shapes taste, not the pool."""
    db = SessionLocal()
    try:
        return get_provider_high_fit(
            db,
            provider_slug="britbox-us",
            limit=limit,
            exclude_rated=exclude_rated,
            title_type=title_type,
            decade=decade,
            year_min=year_min,
            country=country,
            similar_to=similar_to,
        )
    finally:
        db.close()


@router.get("/britbox-ml")
def recommendations_britbox_ml(
    limit: int = Query(default=15, ge=1, le=50),
    title_type: str = Query(
        default="show",
        description="Catalog object_type filter: show (series), movie, or all",
    ),
    exclude_rated: bool = Query(default=True),
    decade: str | None = Query(
        default=None,
        description="Restrict pool to release decade, e.g. 2020 or 2020s (applied before ranking)",
    ),
    year_min: int | None = Query(
        default=None,
        ge=1870,
        le=2035,
        description="Minimum release year (applied before ranking)",
    ),
    country: str | None = Query(
        default=None,
        max_length=80,
        description="Substring match on country (case-insensitive, applied before ranking)",
    ),
    similar_to: str | None = Query(
        default=None,
        max_length=150,
        description="Title hint: keep titles that share a genre with this resolved reference (rated/watchlist)",
    ),
):
    """BritBox catalog: series (default) ranked by ML 8+ probability. Watchlist excluded from candidates."""
    db = SessionLocal()
    try:
        return get_provider_ml(
            db,
            provider_slug="britbox-us",
            limit=limit,
            exclude_rated=exclude_rated,
            title_type=title_type,
            decade=decade,
            year_min=year_min,
            country=country,
            similar_to=similar_to,
        )
    finally:
        db.close()


@router.get("/britbox-stats")
def recommendations_britbox_stats(
    include_matched_pool_profile: bool = Query(
        default=False,
        description="Include year/decade diagnostics for the metadata-matched pool (needs DB)",
    ),
    title_type: str = Query(
        default="show",
        description="Same as /britbox: show, movie, or all",
    ),
    exclude_rated: bool = Query(default=True),
):
    """BritBox catalog snapshot stats; optional matched-pool age profile (aligned with High-Fit filters)."""
    catalog = load_catalog("britbox-us")
    if catalog is None:
        msg = "BritBox catalog snapshot is not available."
        if settings.DEBUG:
            msg += " Run: cd backend && python -m app.scripts.fetch_britbox_catalog"
        return {"loaded": False, "message": msg}
    out: dict = {
        "loaded": True,
        "provider": catalog.get("provider_clear_name", "BritBox"),
        "fetched_at": catalog.get("fetched_at"),
        "stats": catalog.get("stats", {}),
    }
    if include_matched_pool_profile:
        db = SessionLocal()
        try:
            out["matched_pool_profile"] = get_britbox_matched_pool_profile(
                db,
                title_type=title_type,
                exclude_rated=exclude_rated,
            )
        finally:
            db.close()
    return out
