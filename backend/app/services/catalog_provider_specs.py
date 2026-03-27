"""Registry of Watchmode-backed catalog providers (BritBox, MUBI, …).

Adding a provider: define a :class:`CatalogProviderSpec`, add it to ``CATALOG_PROVIDERS``,
add a fetch script + ``data/<folder>/catalog.json``, then register routes via
:func:`register_catalog_provider_routes` in ``provider_recommendations``.

``provider_slug`` matches :func:`app.services.provider_catalog.load_catalog`.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class CatalogProviderSpec:
    provider_slug: str
    route_high: str
    route_ml: str
    route_stats: str
    default_title_type: str
    label: str
    fetch_script_module: str


CATALOG_PROVIDERS: tuple[CatalogProviderSpec, ...] = (
    CatalogProviderSpec(
        provider_slug="britbox-us",
        route_high="britbox",
        route_ml="britbox-ml",
        route_stats="britbox-stats",
        default_title_type="show",
        label="BritBox",
        fetch_script_module="app.scripts.fetch_britbox_catalog",
    ),
    CatalogProviderSpec(
        provider_slug="mubi-us",
        route_high="mubi",
        route_ml="mubi-ml",
        route_stats="mubi-stats",
        default_title_type="movie",
        label="MUBI",
        fetch_script_module="app.scripts.fetch_mubi_catalog",
    ),
)
