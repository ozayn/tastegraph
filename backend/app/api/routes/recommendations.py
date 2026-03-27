"""Simple recommendation endpoints."""

from collections import defaultdict

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from sqlalchemy import case, desc, exists, or_, select
from sqlalchemy.sql.expression import nulls_last

from app.core.database import SessionLocal
from app.models.imdb_rating import IMDbRating
from app.models.imdb_watchlist_item import IMDbWatchlistItem
from app.models.title_metadata import TitleMetadata
from app.services.country_normalize import filter_variants_for_country, parse_and_normalize_countries
from app.services.favorite_boost import compute_favorite_boost, _load_favorites_by_role
from app.services.llm_search import search_rated, search_watchlist
from app.services.recommendation_filters import (
    any_recommendation_filter_active,
    normalize_year_value,
    parse_decade_bounds,
    pool_row_matches_filters,
    resolve_similar_to_genre_set,
)
from app.services.ml_recommendations import get_ml_watchlist_recommendations
from app.services.taste_signals import (
    build_explore_favorites_reasons,
    build_reasons,
    load_taste_signals,
    score_title_by_taste_signals,
)

router = APIRouter(prefix="/recommendations", tags=["recommendations"])

# Greedy diversity for /simple ("Explore your favorites"): penalize repeating genre
# labels, primary (lead) genre, title_type, and primary country. Tail uses lighter weights;
# curated prefix covers the full visible slice when limit allows + extra cost for repeat
# documentaries / clustering on the same lead genre (e.g. two comedies early).
_SIMPLE_CURATED_PREFIX = 10
_SIMPLE_DIV_LIGHT_GENRE_W = 0.22
_SIMPLE_DIV_LIGHT_TYPE_W = 0.30
_SIMPLE_DIV_LIGHT_COUNTRY_W = 0.10
_SIMPLE_DIV_LIGHT_PRIMARY_GENRE_W = 0.28
_SIMPLE_DIV_CURATED_GENRE_W = 0.44
_SIMPLE_DIV_CURATED_TYPE_W = 0.52
_SIMPLE_DIV_CURATED_COUNTRY_W = 0.15
_SIMPLE_DIV_CURATED_PRIMARY_GENRE_W = 0.62
_SIMPLE_DIV_CURATED_DOC_REPEAT_W = 0.85
_SIMPLE_DIV_RELAX_DOC_REPEAT_W = 0.55
_SIMPLE_DIV_NARROW_GENRE_W = 0.32
_SIMPLE_DIV_NARROW_TYPE_W = 0.40
_SIMPLE_DIV_NARROW_COUNTRY_W = 0.12
_SIMPLE_DIV_NARROW_PRIMARY_GENRE_W = 0.42


def _simple_genre_tokens(genres_csv: str | None) -> list[str]:
    return [p.strip() for p in (genres_csv or "").split(",") if p.strip()]


def _simple_norm_title_type(title_type: str | None) -> str:
    t = (title_type or "").strip().lower()
    return t if t else "—"


def _simple_primary_country(country: str | None) -> str:
    if not country or not str(country).strip():
        return ""
    parts = parse_and_normalize_countries(country)
    return sorted(parts)[0] if parts else ""


def _simple_has_usable_poster(poster: object) -> bool:
    if poster is None:
        return False
    s = str(poster).strip()
    return bool(s) and s.upper() != "N/A"


def _simple_is_short_film(r: IMDbRating) -> bool:
    """Exclude obvious shorts from the curated prefix (keep typical TV episodes)."""
    tt = (r.title_type or "").lower()
    if "short" in tt:
        return True
    for g in _simple_genre_tokens(r.genres):
        if g.lower() == "short":
            return True
    rm = r.runtime_mins
    if rm is None or rm <= 0:
        return False
    if rm > 46:
        return False
    if "series" in tt or "episode" in tt:
        return False
    return True


def _simple_is_documentary(r: IMDbRating) -> bool:
    return any(g.lower() == "documentary" for g in _simple_genre_tokens(r.genres))


def _simple_primary_genre(genres_csv: str | None) -> str:
    """First listed genre (IMDb order)—used to soften repeated lead-genre clusters."""
    toks = _simple_genre_tokens(genres_csv)
    return toks[0].lower() if toks else ""


def _greedy_diversify_simple_rows(
    pool_in: list,
    pick: int,
    *,
    genre_w: float,
    type_w: float,
    country_w: float,
    primary_genre_w: float = 0.0,
    documentary_repeat_w: float = 0.0,
) -> list:
    """Pick `pick` rows from pool_in (already quality-ordered) by maximizing
    score minus diversity penalties. Deterministic."""
    if pick <= 0 or not pool_in:
        return []

    pool_size = min(len(pool_in), max(pick * 6, 60))
    pool = pool_in[:pool_size]
    remaining = list(range(len(pool)))
    chosen_idx: list[int] = []

    genre_counts: defaultdict[str, int] = defaultdict(int)
    primary_genre_counts: defaultdict[str, int] = defaultdict(int)
    type_counts: defaultdict[str, int] = defaultdict(int)
    country_counts: defaultdict[str, int] = defaultdict(int)
    doc_chosen = 0

    def register_chosen(ix: int) -> None:
        nonlocal doc_chosen
        _score, _date_rated, r, _poster, _matches, c = pool[ix]
        for g in _simple_genre_tokens(r.genres):
            genre_counts[g] += 1
        pg = _simple_primary_genre(r.genres)
        if pg:
            primary_genre_counts[pg] += 1
        type_counts[_simple_norm_title_type(r.title_type)] += 1
        pk = _simple_primary_country(c)
        if pk:
            country_counts[pk] += 1
        if _simple_is_documentary(r):
            doc_chosen += 1

    def diversity_penalty(ix: int) -> float:
        _score, _date_rated, r, _poster, _matches, c = pool[ix]
        pen = 0.0
        for g in _simple_genre_tokens(r.genres):
            pen += genre_w * genre_counts[g]
        if primary_genre_w > 0:
            pg = _simple_primary_genre(r.genres)
            if pg:
                pen += primary_genre_w * primary_genre_counts[pg]
        pen += type_w * type_counts[_simple_norm_title_type(r.title_type)]
        pk = _simple_primary_country(c)
        if pk:
            pen += country_w * country_counts[pk]
        if documentary_repeat_w > 0 and doc_chosen >= 1 and _simple_is_documentary(r):
            pen += documentary_repeat_w * doc_chosen
        return pen

    while len(chosen_idx) < pick and remaining:
        best_ix: int | None = None
        best_key: tuple[float, float, int, str] | None = None
        for ix in remaining:
            row = pool[ix]
            score, date_rated, r = row[0], row[1], row[2]
            date_ord = date_rated.toordinal() if date_rated else 0
            adjusted = score - diversity_penalty(ix)
            tie = (adjusted, score, date_ord, r.imdb_title_id or "")
            if best_key is None or tie > best_key:
                best_key = tie
                best_ix = ix
        assert best_ix is not None
        chosen_idx.append(best_ix)
        register_chosen(best_ix)
        remaining.remove(best_ix)

    return [pool[i] for i in chosen_idx]


def _assemble_simple_explore_favorites(scored_sorted: list, limit: int) -> list:
    """Curated first slice: usable poster required until the pool is exhausted (no shorts,
    then poster + shorts); only then fill remaining prefix slots without poster. Tail fills
    poster-backed titles first (light greedy), then no-poster rows so missing art sinks."""
    if limit <= 0:
        return []
    if len(scored_sorted) <= 1:
        return scored_sorted[:limit]

    master = scored_sorted
    picked: list = []
    picked_ids: set[str] = set()

    def extend_unique(rows: list, *, max_total: int | None = None) -> None:
        for row in rows:
            if max_total is not None and len(picked) >= max_total:
                return
            if len(picked) >= limit:
                return
            tid = row[2].imdb_title_id
            if tid in picked_ids:
                continue
            picked.append(row)
            picked_ids.add(tid)

    k = min(_SIMPLE_CURATED_PREFIX, limit)

    strict = [
        row
        for row in master
        if _simple_has_usable_poster(row[3]) and not _simple_is_short_film(row[2])
    ]
    extend_unique(
        _greedy_diversify_simple_rows(
            strict,
            k,
            genre_w=_SIMPLE_DIV_CURATED_GENRE_W,
            type_w=_SIMPLE_DIV_CURATED_TYPE_W,
            country_w=_SIMPLE_DIV_CURATED_COUNTRY_W,
            primary_genre_w=_SIMPLE_DIV_CURATED_PRIMARY_GENRE_W,
            documentary_repeat_w=_SIMPLE_DIV_CURATED_DOC_REPEAT_W,
        ),
        max_total=k,
    )

    if len(picked) < k:
        poster_allow_short = [
            row
            for row in master
            if row[2].imdb_title_id not in picked_ids
            and _simple_has_usable_poster(row[3])
        ]
        extend_unique(
            _greedy_diversify_simple_rows(
                poster_allow_short,
                k - len(picked),
                genre_w=_SIMPLE_DIV_CURATED_GENRE_W,
                type_w=_SIMPLE_DIV_CURATED_TYPE_W,
                country_w=_SIMPLE_DIV_CURATED_COUNTRY_W,
                primary_genre_w=_SIMPLE_DIV_CURATED_PRIMARY_GENRE_W,
                documentary_repeat_w=_SIMPLE_DIV_RELAX_DOC_REPEAT_W,
            ),
            max_total=k,
        )

    if len(picked) < k:
        narrow = [row for row in master if row[2].imdb_title_id not in picked_ids]
        extend_unique(
            _greedy_diversify_simple_rows(
                narrow,
                k - len(picked),
                genre_w=_SIMPLE_DIV_NARROW_GENRE_W,
                type_w=_SIMPLE_DIV_NARROW_TYPE_W,
                country_w=_SIMPLE_DIV_NARROW_COUNTRY_W,
                primary_genre_w=_SIMPLE_DIV_NARROW_PRIMARY_GENRE_W,
                documentary_repeat_w=_SIMPLE_DIV_RELAX_DOC_REPEAT_W,
            ),
            max_total=k,
        )

    if len(picked) < limit:
        rest_unpicked = [row for row in master if row[2].imdb_title_id not in picked_ids]
        rest_poster = [row for row in rest_unpicked if _simple_has_usable_poster(row[3])]
        rest_no_poster = [row for row in rest_unpicked if not _simple_has_usable_poster(row[3])]
        need = limit - len(picked)
        extend_unique(
            _greedy_diversify_simple_rows(
                rest_poster,
                need,
                genre_w=_SIMPLE_DIV_LIGHT_GENRE_W,
                type_w=_SIMPLE_DIV_LIGHT_TYPE_W,
                country_w=_SIMPLE_DIV_LIGHT_COUNTRY_W,
                primary_genre_w=_SIMPLE_DIV_LIGHT_PRIMARY_GENRE_W,
                documentary_repeat_w=0.0,
            ),
        )
        if len(picked) < limit:
            extend_unique(
                _greedy_diversify_simple_rows(
                    rest_no_poster,
                    limit - len(picked),
                    genre_w=_SIMPLE_DIV_LIGHT_GENRE_W,
                    type_w=_SIMPLE_DIV_LIGHT_TYPE_W,
                    country_w=_SIMPLE_DIV_LIGHT_COUNTRY_W,
                    primary_genre_w=_SIMPLE_DIV_LIGHT_PRIMARY_GENRE_W,
                    documentary_repeat_w=0.0,
                ),
            )

    if len(picked) < limit:
        for row in master:
            if row[2].imdb_title_id not in picked_ids and _simple_has_usable_poster(row[3]):
                picked.append(row)
                picked_ids.add(row[2].imdb_title_id)
                if len(picked) >= limit:
                    break
        for row in master:
            if row[2].imdb_title_id not in picked_ids:
                picked.append(row)
                picked_ids.add(row[2].imdb_title_id)
                if len(picked) >= limit:
                    break

    return picked[:limit]


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

        fetch_limit = min(100, max(limit * 6, 60))
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
        top = _assemble_simple_explore_favorites(scored, limit)

        return [
            {
                "imdb_title_id": r.imdb_title_id,
                "title": r.title,
                "year": r.year,
                "genres": r.genres,
                "user_rating": r.user_rating,
                "poster": poster if poster and poster != "N/A" else None,
                "favorite_matches": matches,
                "reasons": build_explore_favorites_reasons(
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
    decade: str | None = Query(
        default=None,
        description="Restrict pool to release decade, e.g. 2020 or 2020s (before ranking)",
    ),
    year_min: int | None = Query(
        default=None,
        ge=1870,
        le=2035,
        description="Minimum release year (before ranking)",
    ),
    country: str | None = Query(
        default=None,
        max_length=80,
        description="Substring match on country (before ranking)",
    ),
    similar_to: str | None = Query(
        default=None,
        max_length=150,
        description="Title hint: keep items that share a genre with resolved reference (rated/watchlist)",
    ),
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
        favorite_list_ids = signals.get("favorite_list_ids", set())

        decade_bounds = parse_decade_bounds(decade)
        ref_genres, _similar_resolved = resolve_similar_to_genre_set(db, similar_to)
        filter_active = any_recommendation_filter_active(
            decade_bounds=decade_bounds,
            year_min=year_min,
            country_contains=country,
            ref_genres=ref_genres,
        )

        scored_items = []
        for r, poster, actors, directors, writer, country, meta_genres in rows:
            if r.imdb_title_id in favorite_list_ids:
                continue  # exclude favorite_list titles from underwatched candidates
            genres_str = meta_genres or r.genres
            y = normalize_year_value(r.year)
            if filter_active and not pool_row_matches_filters(
                year=y,
                genres_csv=genres_str,
                country=country,
                decade_bounds=decade_bounds,
                year_min=year_min,
                country_contains=country,
                ref_genres=ref_genres,
            ):
                continue
            boost, matches = compute_favorite_boost(
                actors, directors, writer, favorites_by_role
            )
            fit_score, explanation = score_title_by_taste_signals(
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


@router.get("/watchlist-ml")
def recommendations_watchlist_ml(
    limit: int = Query(default=15, ge=1, le=50),
):
    """ML-ranked watchlist: unrated items scored by predicted 8+ probability. Requires trained model."""
    db = SessionLocal()
    try:
        items = get_ml_watchlist_recommendations(db, limit=limit)
        if items is None:
            return {"items": [], "model_available": False}

        ids = [x["imdb_title_id"] for x in items]
        poster_map = {}
        if ids:
            rows = db.query(TitleMetadata.imdb_title_id, TitleMetadata.poster).filter(
                TitleMetadata.imdb_title_id.in_(ids)
            ).all()
            for imdb_id, poster in rows:
                poster_map[imdb_id] = poster if poster and poster != "N/A" else None

        for item in items:
            item["poster"] = poster_map.get(item["imdb_title_id"])

        return {"items": items, "model_available": True}
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
    base = "Your 8+ library: titles you already rated highly—filtered here"
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


class WatchlistSearchRequest(BaseModel):
    q: str = Field(default="", max_length=500)
    scope: str = Field(default="watchlist", description="watchlist | watched")


@router.post("/watchlist-search")
def recommendations_watchlist_search(
    body: WatchlistSearchRequest,
    limit: int = Query(default=8, ge=1, le=50),
    decade: str | None = Query(
        default=None,
        max_length=12,
        description="Restrict pool to release decade (e.g. 2020s) before ranking; clears LLM year_min",
    ),
):
    """Grounded natural-language search. scope=watchlist (default) or watched. LLM interprets query; retrieval uses only real data."""
    db = SessionLocal()
    try:
        scope = (body.scope or "watchlist").strip().lower()
        if scope == "watched":
            result = search_rated(db, body.q or "", limit=limit, pool_decade=decade)
        else:
            result = search_watchlist(db, body.q or "", limit=limit, pool_decade=decade)
        return result
    finally:
        db.close()
