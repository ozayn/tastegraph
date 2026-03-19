"""Simple recommendation endpoints."""

from fastapi import APIRouter, Query
from sqlalchemy import case, desc, exists, or_, select
from sqlalchemy.sql.expression import nulls_last

from app.core.database import SessionLocal
from app.models.imdb_rating import IMDbRating
from app.models.imdb_watchlist_item import IMDbWatchlistItem
from app.models.title_metadata import TitleMetadata
from app.services.country_normalize import filter_variants_for_country, parse_and_normalize_countries
from app.services.favorite_boost import compute_favorite_boost, _load_favorites_by_role
from app.services.taste_signals import load_taste_signals, build_reasons, score_watchlist_item

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


def _title_type_matches(tt: str) -> list:
    """Build filters for title_type (movie, series, episode) matching CSV values like Movie, TV Series."""
    tt = (tt or "").strip().lower()
    if not tt:
        return []
    if tt == "movie":
        return [IMDbRating.title_type.ilike("movie")]
    if tt == "series":
        return [IMDbRating.title_type.ilike("%series%")]
    if tt == "episode":
        return [IMDbRating.title_type.ilike("episode")]
    return [IMDbRating.title_type.ilike(f"%{tt}%")]


@router.get("/countries")
def recommendations_countries():
    """Available countries from TitleMetadata.country (ratings 8+ with metadata). Normalized: UK->United Kingdom, USA->United States."""
    db = SessionLocal()
    try:
        rows = (
            db.query(TitleMetadata.country)
            .join(IMDbRating, IMDbRating.imdb_title_id == TitleMetadata.imdb_title_id)
            .filter(IMDbRating.user_rating >= 8)
            .filter(TitleMetadata.country.isnot(None))
            .all()
        )
        countries: set[str] = set()
        for (c,) in rows:
            countries |= parse_and_normalize_countries(c)
        return sorted(countries)
    finally:
        db.close()


@router.get("/genres")
def recommendations_genres():
    """Available genres from ratings (rated 8+) using IMDbRating.genres."""
    db = SessionLocal()
    try:
        rows = (
            db.query(IMDbRating.genres)
            .filter(IMDbRating.user_rating >= 8)
            .filter(IMDbRating.genres.isnot(None))
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
    countries: list[str] | None = Query(default=None, description="Filter by countries (OR), uses TitleMetadata"),
    title_type: str | None = Query(default=None, description="movie, series, or episode"),
    year_from: int | None = Query(default=None, ge=1900, le=2100),
    year_to: int | None = Query(default=None, ge=1900, le=2100),
    limit: int = Query(default=10, ge=1, le=50),
):
    """Your favorites: titles you rated 8+. Uses IMDbRating (CSV) data; country filter requires TitleMetadata."""
    db = SessionLocal()
    try:
        q = (
            db.query(
                IMDbRating,
                TitleMetadata.poster,
                TitleMetadata.actors,
                TitleMetadata.directors,
                TitleMetadata.writer,
                TitleMetadata.country,
            )
            .outerjoin(TitleMetadata, IMDbRating.imdb_title_id == TitleMetadata.imdb_title_id)
            .filter(IMDbRating.user_rating >= 8)
        )

        if genres:
            genre_filters = [
                IMDbRating.genres.ilike(f"%{g.strip()}%") for g in genres if g.strip()
            ]
            if genre_filters:
                q = q.filter(or_(*genre_filters))
        if countries:
            country_filters = []
            for c in countries:
                if not c or not c.strip():
                    continue
                for v in filter_variants_for_country(c.strip()):
                    country_filters.append(TitleMetadata.country.ilike(f"%{v}%"))
            if country_filters:
                q = q.filter(or_(*country_filters))
        tt_filters = _title_type_matches(title_type or "")
        if tt_filters:
            q = q.filter(or_(*tt_filters))
        if year_from is not None:
            q = q.filter(IMDbRating.year >= year_from)
        if year_to is not None:
            q = q.filter(IMDbRating.year <= year_to)

        fetch_limit = min(100, max(limit * 5, 50))
        rows = (
            q.order_by(
                desc(IMDbRating.user_rating),
                nulls_last(desc(IMDbRating.date_rated)),
            )
            .limit(fetch_limit)
            .all()
        )

        favorites_by_role = _load_favorites_by_role(db)
        signals = load_taste_signals(db)
        scored = []
        for r, poster, actors, directors, writer, country in rows:
            boost, matches = compute_favorite_boost(
                actors, directors, writer, favorites_by_role
            )
            score = (r.user_rating or 0) + boost
            scored.append((score, r.date_rated, r, poster, matches, country))

        def _sort_key(x):
            score, date_rated, *_ = x
            date_ord = date_rated.toordinal() if date_rated else 0
            return (-score, -date_ord)

        scored.sort(key=_sort_key)
        top = scored[:limit]

        return [
            {
                "imdb_title_id": r.imdb_title_id,
                "title": r.title,
                "year": r.year,
                "genres": r.genres,
                "user_rating": r.user_rating,
                "poster": poster if poster and poster != "N/A" else None,
                "favorite_matches": matches,
                "reasons": build_reasons(
                    r.genres, country, r.year, matches, signals
                ),
            }
            for _, _, r, poster, matches, country in top
        ]
    finally:
        db.close()


@router.get("/watchlist-high-fit")
def recommendations_watchlist_high_fit(
    limit: int = Query(default=15, ge=1, le=50),
):
    """Underwatched but high-fit: watchlist items ranked by taste alignment (excludes rated)."""
    db = SessionLocal()
    try:
        q = (
            db.query(
                IMDbWatchlistItem,
                TitleMetadata.poster,
                TitleMetadata.actors,
                TitleMetadata.directors,
                TitleMetadata.writer,
                TitleMetadata.country,
                TitleMetadata.genres,
            )
            .outerjoin(
                TitleMetadata, IMDbWatchlistItem.imdb_title_id == TitleMetadata.imdb_title_id
            )
            .filter(IMDbWatchlistItem.your_rating.is_(None))
        )
        rated_exists = exists(select(1).where(IMDbRating.imdb_title_id == IMDbWatchlistItem.imdb_title_id))
        q = q.filter(~rated_exists)

        rows = q.all()

        favorites_by_role = _load_favorites_by_role(db)
        signals = load_taste_signals(db)

        scored_items = []
        for r, poster, actors, directors, writer, country, meta_genres in rows:
            boost, matches = compute_favorite_boost(
                actors, directors, writer, favorites_by_role
            )
            genres_str = meta_genres or r.genres
            fit_score, explanation = score_watchlist_item(
                r.imdb_title_id, genres_str, country, r.year, directors, matches, signals
            )
            total_score = fit_score + boost * 2  # Favorites add to fit
            scored_items.append((
                total_score,
                r,
                poster if poster and poster != "N/A" else None,
                explanation,
            ))

        scored_items.sort(key=lambda x: -x[0])
        top = scored_items[:limit]

        return [
            {
                "imdb_title_id": r.imdb_title_id,
                "title": r.title,
                "title_type": r.title_type,
                "year": r.year,
                "poster": poster,
                "explanation": explanation,
            }
            for _, r, poster, explanation in top
        ]
    finally:
        db.close()


@router.get("/watchlist-countries")
def recommendations_watchlist_countries():
    """Available countries from TitleMetadata.country for watchlist items. Normalized: UK->United Kingdom, USA->United States."""
    db = SessionLocal()
    try:
        rows = (
            db.query(TitleMetadata.country)
            .join(IMDbWatchlistItem, IMDbWatchlistItem.imdb_title_id == TitleMetadata.imdb_title_id)
            .filter(TitleMetadata.country.isnot(None))
            .all()
        )
        countries: set[str] = set()
        for (c,) in rows:
            countries |= parse_and_normalize_countries(c)
        return sorted(countries)
    finally:
        db.close()


@router.get("/watchlist-genres")
def recommendations_watchlist_genres():
    """Available genres from watchlist items (from IMDbWatchlistItem.genres)."""
    db = SessionLocal()
    try:
        rows = (
            db.query(IMDbWatchlistItem.genres)
            .filter(IMDbWatchlistItem.genres.isnot(None))
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


@router.get("/watchlist-simple")
def recommendations_watchlist_simple(
    genres: list[str] | None = Query(default=None, description="Filter by genres (OR)"),
    countries: list[str] | None = Query(default=None, description="Filter by countries (OR), uses TitleMetadata"),
    title_type: str | None = Query(default=None, description="movie, TV Series, etc."),
    year_from: int | None = Query(default=None, ge=1900, le=2100),
    year_to: int | None = Query(default=None, ge=1900, le=2100),
    include_rated: bool = Query(default=False, description="Include already-rated items"),
    limit: int = Query(default=20, ge=1, le=100),
):
    """Things to watch from watchlist. By default excludes already-rated titles."""
    db = SessionLocal()
    try:
        q = db.query(
            IMDbWatchlistItem,
            TitleMetadata.poster,
            TitleMetadata.actors,
            TitleMetadata.directors,
            TitleMetadata.writer,
            TitleMetadata.country,
            TitleMetadata.genres,
        ).outerjoin(
            TitleMetadata, IMDbWatchlistItem.imdb_title_id == TitleMetadata.imdb_title_id
        )

        if genres:
            genre_filters = [
                IMDbWatchlistItem.genres.ilike(f"%{g.strip()}%") for g in genres if g.strip()
            ]
            if genre_filters:
                q = q.filter(or_(*genre_filters))

        if countries:
            country_filters = []
            for c in countries:
                if not c or not c.strip():
                    continue
                for v in filter_variants_for_country(c.strip()):
                    country_filters.append(TitleMetadata.country.ilike(f"%{v}%"))
            if country_filters:
                q = q.filter(or_(*country_filters))

        if not include_rated:
            q = q.filter(IMDbWatchlistItem.your_rating.is_(None))
            rated_exists = exists(select(1).where(IMDbRating.imdb_title_id == IMDbWatchlistItem.imdb_title_id))
            q = q.filter(~rated_exists)

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

        fetch_limit = min(200, max(limit * 5, 50))
        rows = (
            q.order_by(meta_first.asc(), IMDbWatchlistItem.position.asc())
            .limit(fetch_limit)
            .all()
        )

        favorites_by_role = _load_favorites_by_role(db)
        signals = load_taste_signals(db)
        scored = []
        for r, poster, actors, directors, writer, country, meta_genres in rows:
            boost, matches = compute_favorite_boost(
                actors, directors, writer, favorites_by_role
            )
            has_meta = bool(r.title and r.title_type and r.year is not None)
            meta_first_val = 0 if has_meta else 1
            scored.append((boost, meta_first_val, r.position or 0, r, poster, matches, country, meta_genres))

        def _wl_sort_key(x):
            boost, mf, pos, *_ = x
            return (-boost, mf, pos)

        scored.sort(key=_wl_sort_key)
        top = scored[:limit]

        return [
            {
                "imdb_title_id": r.imdb_title_id,
                "title": r.title,
                "title_type": r.title_type,
                "year": r.year,
                "your_rating": r.your_rating,
                "date_rated": r.date_rated.isoformat() if r.date_rated else None,
                "poster": poster if poster and poster != "N/A" else None,
                "favorite_matches": matches,
                "reasons": build_reasons(
                    meta_genres or r.genres, country, r.year, matches, signals
                ),
            }
            for _, _, _, r, poster, matches, country, meta_genres in top
        ]
    finally:
        db.close()


def _build_simple_explanation(
    genres: list[str] | None,
    countries: list[str] | None,
    title_type: str | None,
    year_from: int | None,
    year_to: int | None,
) -> str:
    """Build a deterministic plain-text explanation from filter params."""
    base = "Your favorites: enriched titles you rated 8 or higher"
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

    if countries:
        cleaned = [c.strip() for c in countries if c.strip()]
        if cleaned:
            if len(cleaned) == 1:
                parts.append(f"from {cleaned[0]}")
            elif len(cleaned) == 2:
                parts.append(f"from {cleaned[0]} or {cleaned[1]}")
            else:
                parts.append(f"from {', '.join(cleaned[:-1])}, or {cleaned[-1]}")

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
    countries: list[str] | None = Query(default=None, description="Filter by countries (OR)"),
    title_type: str | None = Query(default=None, description="movie, series, or episode"),
    year_from: int | None = Query(default=None, ge=1900, le=2100),
    year_to: int | None = Query(default=None, ge=1900, le=2100),
):
    """Plain-text explanation of the current simple recommendation filters."""
    explanation = _build_simple_explanation(genres, countries, title_type, year_from, year_to)
    return {"explanation": explanation}
