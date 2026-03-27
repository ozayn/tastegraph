"""Pre-ranking filters for recommendation pools (BritBox catalog, watchlist high-fit, etc.).

Filters narrow the candidate set before scoring/ranking; sort keys stay unchanged within the subset.
"""

from __future__ import annotations

import math

from sqlalchemy.orm import Session

from app.models.title_metadata import TitleMetadata


def parse_decade_bounds(decade: str | None) -> tuple[int, int] | None:
    """Parse ``2020s`` / ``2020`` into inclusive year range for that decade."""
    if decade is None:
        return None
    t = decade.strip().lower().rstrip("s")
    if not t.isdigit():
        return None
    y = int(t)
    if y < 1870 or y > 2095:
        return None
    start = (y // 10) * 10
    return start, start + 9


def normalize_year_value(y: object) -> int | None:
    if y is None:
        return None
    if isinstance(y, float) and math.isnan(y):
        return None
    try:
        iy = int(y)
    except (ValueError, TypeError):
        return None
    if 1870 <= iy <= 2035:
        return iy
    return None


def title_release_year(meta: TitleMetadata, catalog_year: object | None = None) -> int | None:
    for candidate in (meta.year, catalog_year):
        iy = normalize_year_value(candidate)
        if iy is not None:
            return iy
    return None


def genre_set_from_csv(genres_csv: str | None) -> set[str]:
    if not genres_csv:
        return set()
    return {g.strip().lower() for g in genres_csv.split(",") if g.strip()}


def normalize_catalog_genre_filter(genre: str | list[str] | None, *, max_terms: int = 15) -> tuple[str, ...] | None:
    """Lowercased substrings for catalog pool genre filter (OR: any term contained in metadata genres CSV)."""
    if genre is None:
        return None
    if isinstance(genre, str):
        s = genre.strip()
        return (s.lower(),) if s else None
    out: list[str] = []
    for g in genre[:max_terms]:
        if not g or not str(g).strip():
            continue
        out.append(str(g).strip().lower())
    return tuple(out) if out else None


def pool_row_matches_filters(
    *,
    year: int | None,
    genres_csv: str | None,
    country: str | None,
    decade_bounds: tuple[int, int] | None,
    year_min: int | None,
    country_contains: str | None,
    ref_genres: set[str] | None,
    genre_substrings: tuple[str, ...] | None = None,
) -> bool:
    """Return True if this row stays in the pool. ``ref_genres`` None = do not filter on genres."""
    if decade_bounds is not None:
        if year is None or not (decade_bounds[0] <= year <= decade_bounds[1]):
            return False
    if year_min is not None:
        if year is None or year < year_min:
            return False
    cc = country_contains.strip().lower() if country_contains and country_contains.strip() else None
    if cc:
        if cc not in (country or "").lower():
            return False
    if ref_genres:
        if not (genre_set_from_csv(genres_csv) & ref_genres):
            return False
    if genre_substrings:
        hay = (genres_csv or "").lower()
        if not any(sub in hay for sub in genre_substrings):
            return False
    return True


def any_recommendation_filter_active(
    *,
    decade_bounds: tuple[int, int] | None,
    year_min: int | None,
    country_contains: str | None,
    ref_genres: set[str] | None,
    genre_substrings: tuple[str, ...] | None = None,
) -> bool:
    return bool(
        decade_bounds is not None
        or year_min is not None
        or (country_contains and country_contains.strip())
        or ref_genres
        or (genre_substrings and len(genre_substrings) > 0)
    )


def resolve_similar_to_genre_set(db: Session, similar_to: str | None) -> tuple[set[str] | None, str | None]:
    """Resolve a title hint via rated/watchlist rows (same as LLM search similar_to)."""
    if not similar_to or not similar_to.strip():
        return None, None
    from app.services.llm_search import _lookup_similar_title

    sig = _lookup_similar_title(db, similar_to.strip())
    if not sig:
        return None, None
    title = sig.get("resolved_title")
    genres = {
        g.lower().strip()
        for g in sig.get("genres", [])
        if isinstance(g, str) and g.strip()
    }
    return (genres or None, title)


def title_metadata_matches_pool_filters(
    meta: TitleMetadata,
    cat: dict,
    *,
    decade_bounds: tuple[int, int] | None,
    year_min: int | None,
    country_contains: str | None,
    ref_genres: set[str] | None,
    genre_substrings: tuple[str, ...] | None = None,
) -> bool:
    return pool_row_matches_filters(
        year=title_release_year(meta, cat.get("year")),
        genres_csv=meta.genres,
        country=meta.country,
        decade_bounds=decade_bounds,
        year_min=year_min,
        country_contains=country_contains,
        ref_genres=ref_genres,
        genre_substrings=genre_substrings,
    )
