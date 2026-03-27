"""Provider-aware catalog recommendations (BritBox, MUBI, …).

Routes are registered from :data:`app.services.catalog_provider_specs.CATALOG_PROVIDERS`.
Core scoring lives in :mod:`app.services.provider_catalog`.
"""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.config import settings
from app.core.database import SessionLocal
from app.services.catalog_provider_specs import CATALOG_PROVIDERS, CatalogProviderSpec
from app.services.provider_catalog import (
    get_britbox_matched_pool_profile,
    get_provider_high_fit,
    get_provider_ml,
    load_catalog,
)

router = APIRouter(prefix="/recommendations", tags=["recommendations"])

_DECADE_Q = "Restrict pool to release decade, e.g. 2020 or 2020s (applied before ranking)"
_YEAR_Q = "Minimum release year (applied before ranking)"
_COUNTRY_Q = "Substring match on country (case-insensitive, applied before ranking)"
_GENRE_Q = (
    "Substring match on title genres CSV (case-insensitive, before ranking). "
    "Repeat the parameter to OR multiple genres (e.g. genre=Drama&genre=Thriller)."
)
_SIMILAR_Q = (
    "Title hint: keep titles that share a genre with this resolved reference (rated/watchlist)"
)
_TITLE_Q = "Catalog object_type filter: show (series), movie, or all"


def _high_fit_endpoint(spec: CatalogProviderSpec):
    def endpoint(
        limit: int = Query(default=15, ge=1, le=50),
        title_type: str = Query(default=spec.default_title_type, description=_TITLE_Q),
        exclude_rated: bool = Query(default=True),
        decade: str | None = Query(default=None, description=_DECADE_Q),
        year_min: int | None = Query(default=None, ge=1870, le=2035, description=_YEAR_Q),
        country: str | None = Query(default=None, max_length=80, description=_COUNTRY_Q),
        genre: list[str] | None = Query(default=None, description=_GENRE_Q),
        similar_to: str | None = Query(default=None, max_length=150, description=_SIMILAR_Q),
    ) -> dict:
        db = SessionLocal()
        try:
            return get_provider_high_fit(
                db,
                provider_slug=spec.provider_slug,
                limit=limit,
                exclude_rated=exclude_rated,
                title_type=title_type,
                decade=decade,
                year_min=year_min,
                country=country,
                similar_to=similar_to,
                genre=genre,
            )
        finally:
            db.close()

    endpoint.__name__ = f"recommendations_{spec.route_high}"
    endpoint.__doc__ = f"{spec.label} catalog: taste-signal high-fit. Watchlist shapes taste, not the pool."
    return endpoint


def _ml_endpoint(spec: CatalogProviderSpec):
    def endpoint(
        limit: int = Query(default=15, ge=1, le=50),
        title_type: str = Query(default=spec.default_title_type, description=_TITLE_Q),
        exclude_rated: bool = Query(default=True),
        decade: str | None = Query(default=None, description=_DECADE_Q),
        year_min: int | None = Query(default=None, ge=1870, le=2035, description=_YEAR_Q),
        country: str | None = Query(default=None, max_length=80, description=_COUNTRY_Q),
        genre: list[str] | None = Query(default=None, description=_GENRE_Q),
        similar_to: str | None = Query(default=None, max_length=150, description=_SIMILAR_Q),
    ) -> dict:
        db = SessionLocal()
        try:
            return get_provider_ml(
                db,
                provider_slug=spec.provider_slug,
                limit=limit,
                exclude_rated=exclude_rated,
                title_type=title_type,
                decade=decade,
                year_min=year_min,
                country=country,
                similar_to=similar_to,
                genre=genre,
            )
        finally:
            db.close()

    endpoint.__name__ = f"recommendations_{spec.route_ml.replace('-', '_')}"
    endpoint.__doc__ = f"{spec.label} catalog: ML 8+ probability ranking."
    return endpoint


def _stats_endpoint(spec: CatalogProviderSpec):
    def endpoint(
        include_matched_pool_profile: bool = Query(
            default=False,
            description="Include year/decade diagnostics for the metadata-matched pool (needs DB)",
        ),
        title_type: str = Query(
            default=spec.default_title_type,
            description=f"Same as /{spec.route_high}: show, movie, or all",
        ),
        exclude_rated: bool = Query(default=True),
    ) -> dict:
        catalog = load_catalog(spec.provider_slug)
        if catalog is None:
            msg = f"{spec.label} catalog snapshot is not available."
            if settings.DEBUG:
                msg += f" Run: cd backend && python -m {spec.fetch_script_module}"
            return {"loaded": False, "message": msg}
        out: dict = {
            "loaded": True,
            "provider": catalog.get("provider_clear_name", spec.label),
            "provider_slug": spec.provider_slug,
            "fetched_at": catalog.get("fetched_at"),
            "stats": catalog.get("stats", {}),
        }
        if include_matched_pool_profile:
            db = SessionLocal()
            try:
                out["matched_pool_profile"] = get_britbox_matched_pool_profile(
                    db,
                    provider_slug=spec.provider_slug,
                    title_type=title_type,
                    exclude_rated=exclude_rated,
                )
            finally:
                db.close()
        return out

    endpoint.__name__ = f"recommendations_{spec.route_stats.replace('-', '_')}"
    endpoint.__doc__ = f"{spec.label} catalog snapshot stats."
    return endpoint


def register_catalog_provider_routes() -> None:
    for spec in CATALOG_PROVIDERS:
        router.add_api_route(
            f"/{spec.route_high}",
            _high_fit_endpoint(spec),
            methods=["GET"],
            name=f"catalog_{spec.route_high}_high_fit",
        )
        router.add_api_route(
            f"/{spec.route_ml}",
            _ml_endpoint(spec),
            methods=["GET"],
            name=f"catalog_{spec.route_ml}_ml",
        )
        router.add_api_route(
            f"/{spec.route_stats}",
            _stats_endpoint(spec),
            methods=["GET"],
            name=f"catalog_{spec.route_stats}_stats",
        )


register_catalog_provider_routes()
