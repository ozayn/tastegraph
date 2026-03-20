"""Studies: portfolio-friendly analytical analyses."""

from collections import Counter, defaultdict
from sqlalchemy import func, extract
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.favorite_list_item import FavoriteListItem
from app.models.imdb_rating import IMDbRating
from app.models.imdb_watchlist_item import IMDbWatchlistItem
from app.models.title_metadata import TitleMetadata
from app.services.country_normalize import parse_and_normalize_countries
from fastapi import APIRouter

router = APIRouter(prefix="/studies", tags=["studies"])

MIN_SUPPORT = 15
STRONG_THRESHOLD = 8
SUPPORT_FLOOR = 30  # full lift weight above this count
CREATOR_MIN_SUPPORT = 5  # min rated titles for favorite creators
GENRE_PAIR_MIN_SUPPORT = 5  # min titles for genre combination analysis


def _is_low_quality(s: str) -> bool:
    s = (s or "").strip()
    if not s or len(s) < 2:
        return True
    if s.upper() in ("N/A", "NA", "N.A.", "N.A"):
        return True
    return False


def _parse_genres(genres: str | None) -> list[str]:
    if not genres or not genres.strip():
        return []
    return [g.strip() for g in genres.split(",") if g.strip() and not _is_low_quality(g.strip())]


def _decade(year: int | None) -> str | None:
    if year is None:
        return None
    return f"{year // 10 * 10}s"


def _parse_languages(lang: str | None) -> list[str]:
    if not lang or not lang.strip():
        return []
    return [l.strip() for l in lang.split(",") if l.strip() and not _is_low_quality(l.strip())]


@router.get("")
def studies_summary():
    """Precomputed studies: taste evolution, predictors of 8+, watchlist conversion, genre pairs, best creators."""
    db = SessionLocal()
    try:
        taste_evolution = _build_taste_evolution(db)
        predictors_8plus = _build_predictors_8plus(db)
        watchlist_taste_alignment = _build_watchlist_taste_alignment(db)
        genre_combinations = _build_genre_combinations(db)
        best_creators = _build_best_creators(db)
        eights_vs_sevens = _build_eights_vs_sevens(db)
        volume_vs_reward = _build_volume_vs_reward(db)
        try:
            favorite_list_summary = _build_favorite_list_summary(db)
        except Exception:
            favorite_list_summary = {"count": 0, "top_genres": [], "top_countries": [], "overlap_with_rated": 0}
        try:
            score_disagreement = _build_score_disagreement(db)
        except Exception:
            score_disagreement = {"n_titles": 0, "note": "Insufficient data"}
        try:
            director_discovery = _build_director_discovery(db)
        except Exception:
            director_discovery = {"note": "Insufficient data"}
        try:
            taste_evolution_deep = _build_taste_evolution_deep(db)
        except Exception:
            taste_evolution_deep = {"note": "Insufficient data"}
        return {
            "taste_evolution": taste_evolution,
            "predictors_8plus": predictors_8plus,
            "watchlist_taste_alignment": watchlist_taste_alignment,
            "genre_combinations": genre_combinations,
            "best_creators": best_creators,
            "eights_vs_sevens": eights_vs_sevens,
            "volume_vs_reward": volume_vs_reward,
            "favorite_list_summary": favorite_list_summary,
            "score_disagreement": score_disagreement,
            "director_discovery": director_discovery,
            "taste_evolution_deep": taste_evolution_deep,
        }
    finally:
        db.close()


def _build_taste_evolution(db: Session) -> dict:
    """How taste changed over years watched."""
    by_year = (
        db.query(
            extract("year", IMDbRating.date_rated).label("year"),
            func.count(IMDbRating.id).label("count"),
            func.avg(IMDbRating.user_rating).label("avg"),
        )
        .filter(IMDbRating.date_rated.isnot(None))
        .group_by(extract("year", IMDbRating.date_rated))
        .order_by(extract("year", IMDbRating.date_rated))
        .all()
    )
    avg_rating_by_year = {int(y): round(float(avg), 2) if avg else None for y, _, avg in by_year}
    count_by_year = {int(y): c for y, c, _ in by_year}

    rows = (
        db.query(
            extract("year", IMDbRating.date_rated).label("year"),
            IMDbRating.genres,
        )
        .filter(IMDbRating.date_rated.isnot(None), IMDbRating.genres.isnot(None))
        .all()
    )
    genre_by_year: dict[int, Counter] = defaultdict(Counter)
    for year, genres in rows:
        y = int(year)
        for g in _parse_genres(genres):
            genre_by_year[y][g] += 1

    top_genres_by_year = {}
    for y, counter in sorted(genre_by_year.items()):
        top = [
            {"genre": g, "count": c}
            for g, c in counter.most_common(5)
            if not _is_low_quality(g)
        ][:3]
        if top:
            top_genres_by_year[y] = top

    rows_country = (
        db.query(
            extract("year", IMDbRating.date_rated).label("year"),
            TitleMetadata.country,
        )
        .join(IMDbRating, IMDbRating.imdb_title_id == TitleMetadata.imdb_title_id)
        .filter(IMDbRating.date_rated.isnot(None), TitleMetadata.country.isnot(None))
        .all()
    )
    country_by_year: dict[int, Counter] = defaultdict(Counter)
    for year, country in rows_country:
        y = int(year)
        for c in parse_and_normalize_countries(country):
            country_by_year[y][c] += 1

    top_countries_by_year = {}
    for y, counter in sorted(country_by_year.items()):
        top = [
            {"country": c, "count": n}
            for c, n in counter.most_common(5)
            if not _is_low_quality(c)
        ][:3]
        if top:
            top_countries_by_year[y] = top

    genre_shifts = _compute_genre_shifts(genre_by_year)
    country_shifts = _compute_country_shifts(country_by_year)
    biggest_increases = [s for s in genre_shifts if s["delta"] > 0][:5]
    biggest_decreases = [s for s in genre_shifts if s["delta"] < 0][-5:]
    biggest_decreases.reverse()

    return {
        "avg_rating_by_year": avg_rating_by_year,
        "count_by_year": count_by_year,
        "top_genres_by_year": top_genres_by_year,
        "top_countries_by_year": top_countries_by_year,
        "genre_shifts": genre_shifts,
        "country_shifts": country_shifts,
        "biggest_genre_increases": biggest_increases,
        "biggest_genre_decreases": biggest_decreases,
    }


def _compute_genre_shifts(genre_by_year: dict[int, Counter]) -> list[dict]:
    """Early vs recent period: biggest genre gains and declines."""
    years_sorted = sorted(genre_by_year.keys())
    if len(years_sorted) < 4:
        return []
    mid = len(years_sorted) // 2
    early_years = set(years_sorted[:mid])
    recent_years = set(years_sorted[mid:])

    early_total: Counter = Counter()
    recent_total: Counter = Counter()
    for y, counter in genre_by_year.items():
        for g, c in counter.items():
            if _is_low_quality(g):
                continue
            if y in early_years:
                early_total[g] += c
            else:
                recent_total[g] += c

    shifts = []
    all_genres = set(early_total.keys()) | set(recent_total.keys())
    for g in all_genres:
        early = early_total.get(g, 0)
        recent = recent_total.get(g, 0)
        delta = recent - early
        if early + recent >= 8:
            shifts.append({
                "genre": g,
                "early_count": early,
                "recent_count": recent,
                "delta": delta,
            })
    shifts.sort(key=lambda x: -x["delta"])
    return shifts[:10]


def _compute_country_shifts(country_by_year: dict[int, Counter]) -> list[dict]:
    """Early vs recent: biggest country gains and declines."""
    years_sorted = sorted(country_by_year.keys())
    if len(years_sorted) < 4:
        return []
    mid = len(years_sorted) // 2
    early_years = set(years_sorted[:mid])
    recent_years = set(years_sorted[mid:])

    early_total: Counter = Counter()
    recent_total: Counter = Counter()
    for y, counter in country_by_year.items():
        for c, n in counter.items():
            if _is_low_quality(c):
                continue
            if y in early_years:
                early_total[c] += n
            else:
                recent_total[c] += n

    shifts = []
    all_countries = set(early_total.keys()) | set(recent_total.keys())
    for c in all_countries:
        early = early_total.get(c, 0)
        recent = recent_total.get(c, 0)
        delta = recent - early
        if early + recent >= 8:
            shifts.append({
                "country": c,
                "early_count": early,
                "recent_count": recent,
                "delta": delta,
            })
    shifts.sort(key=lambda x: -x["delta"])
    return shifts[:8]


def _parse_directors(directors: str | None) -> list[str]:
    """Parse comma-separated director names, filter junk."""
    if not directors or not directors.strip():
        return []
    return [d.strip() for d in directors.split(",") if d.strip() and not _is_low_quality(d.strip())]


def _build_director_discovery(db: Session) -> dict:
    """Director discovery and follow-through: when first rated, how often returned, recurring favorites.

    Requires date_rated. Uses IMDbRating.directors or TitleMetadata.directors (coalesce).
    """
    rows = (
        db.query(
            IMDbRating.date_rated,
            IMDbRating.user_rating,
            IMDbRating.directors,
            TitleMetadata.directors.label("meta_directors"),
        )
        .outerjoin(TitleMetadata, IMDbRating.imdb_title_id == TitleMetadata.imdb_title_id)
        .filter(IMDbRating.date_rated.isnot(None), IMDbRating.user_rating.isnot(None))
        .all()
    )
    # director -> list of (year, rating)
    by_director: dict[str, list[tuple[int, float]]] = defaultdict(list)
    for r in rows:
        directors_str = r.directors if r.directors else r.meta_directors
        for d in _parse_directors(directors_str):
            year = r.date_rated.year
            rating = float(r.user_rating)
            by_director[d].append((year, rating))

    # Require at least 2 directors with 2+ titles for meaningful output
    candidates = {d: vals for d, vals in by_director.items() if len(vals) >= 1}
    if len(candidates) < 5:
        return {"note": "Need date-rated data and directors for at least 5 titles"}

    result = []
    for director, vals in candidates.items():
        vals_sorted = sorted(vals, key=lambda x: x[0])
        first_year = vals_sorted[0][0]
        titles_after = sum(1 for y, _ in vals_sorted if y > first_year)
        total = len(vals)
        ratings = [v for _, v in vals_sorted]
        avg = sum(ratings) / len(ratings)
        result.append({
            "director": director,
            "first_rated_year": first_year,
            "titles_after_discovery": titles_after,
            "total_titles": total,
            "avg_rating": round(avg, 2),
            "is_recurring_favorite": titles_after >= 2 and avg >= STRONG_THRESHOLD,
        })

    # Strongest follow-through: most titles after discovery, then avg rating
    follow_through = [r for r in result if r["titles_after_discovery"] >= 1]
    follow_through.sort(key=lambda x: (-x["titles_after_discovery"], -x["avg_rating"]))
    top_follow_through = follow_through[:15]

    recurring = [r for r in result if r["is_recurring_favorite"]]
    recurring.sort(key=lambda x: (-x["titles_after_discovery"], -x["avg_rating"]))

    return {
        "top_follow_through": top_follow_through,
        "recurring_favorites": recurring[:12],
        "total_directors_discovered": len(candidates),
    }


def _build_taste_evolution_deep(db: Session) -> dict:
    """Deeper taste evolution: language shifts, broadening/narrowing, rating trend.

    Early vs recent period (first vs second half of years). Interpretive narrative.
    """
    rows_year_genre = (
        db.query(
            extract("year", IMDbRating.date_rated).label("year"),
            IMDbRating.genres,
        )
        .filter(IMDbRating.date_rated.isnot(None), IMDbRating.genres.isnot(None))
        .all()
    )
    rows_year_country = (
        db.query(
            extract("year", IMDbRating.date_rated).label("year"),
            TitleMetadata.country,
        )
        .join(IMDbRating, IMDbRating.imdb_title_id == TitleMetadata.imdb_title_id)
        .filter(IMDbRating.date_rated.isnot(None), TitleMetadata.country.isnot(None))
        .all()
    )
    rows_year_lang = (
        db.query(
            extract("year", IMDbRating.date_rated).label("year"),
            TitleMetadata.languages,
        )
        .join(IMDbRating, IMDbRating.imdb_title_id == TitleMetadata.imdb_title_id)
        .filter(IMDbRating.date_rated.isnot(None), TitleMetadata.languages.isnot(None))
        .all()
    )
    rows_year_rating = (
        db.query(
            extract("year", IMDbRating.date_rated).label("year"),
            IMDbRating.user_rating,
        )
        .filter(IMDbRating.date_rated.isnot(None), IMDbRating.user_rating.isnot(None))
        .all()
    )

    genre_by_year: dict[int, Counter] = defaultdict(Counter)
    for year, genres in rows_year_genre:
        y = int(year)
        for g in _parse_genres(genres):
            genre_by_year[y][g] += 1

    country_by_year: dict[int, Counter] = defaultdict(Counter)
    for year, country in rows_year_country:
        y = int(year)
        for c in parse_and_normalize_countries(country):
            country_by_year[y][c] += 1

    lang_by_year: dict[int, Counter] = defaultdict(Counter)
    for year, lang in rows_year_lang:
        y = int(year)
        for l in _parse_languages(lang):
            lang_by_year[y][l] += 1

    years_sorted = sorted(
        set(genre_by_year.keys()) | set(country_by_year.keys()) | set(lang_by_year.keys())
    )
    if len(years_sorted) < 4:
        return {"note": "Need 4+ years of date-rated data"}

    mid = len(years_sorted) // 2
    early_years = set(years_sorted[:mid])
    recent_years = set(years_sorted[mid:])

    # Language shifts (same pattern as genre/country)
    language_shifts = _compute_language_shifts(lang_by_year, early_years, recent_years)

    # Broadening: unique genres/countries/languages early vs recent
    early_genres = set()
    recent_genres = set()
    for y, counter in genre_by_year.items():
        for g, c in counter.items():
            if _is_low_quality(g):
                continue
            if y in early_years:
                early_genres.add(g)
            else:
                recent_genres.add(g)

    early_countries = set()
    recent_countries = set()
    for y, counter in country_by_year.items():
        for c, n in counter.items():
            if _is_low_quality(c):
                continue
            if y in early_years:
                early_countries.add(c)
            else:
                recent_countries.add(c)

    early_langs = set()
    recent_langs = set()
    for y, counter in lang_by_year.items():
        for l, n in counter.items():
            if _is_low_quality(l):
                continue
            if y in early_years:
                early_langs.add(l)
            else:
                recent_langs.add(l)

    broadening = {
        "genres": {
            "early_unique": len(early_genres),
            "recent_unique": len(recent_genres),
            "broadening": len(recent_genres) > len(early_genres),
            "delta": len(recent_genres) - len(early_genres),
        },
        "countries": {
            "early_unique": len(early_countries),
            "recent_unique": len(recent_countries),
            "broadening": len(recent_countries) > len(early_countries),
            "delta": len(recent_countries) - len(early_countries),
        },
        "languages": {
            "early_unique": len(early_langs),
            "recent_unique": len(recent_langs),
            "broadening": len(recent_langs) > len(early_langs),
            "delta": len(recent_langs) - len(early_langs),
        },
    }

    # Rating trend: early vs recent average
    early_ratings = []
    recent_ratings = []
    for year, rating in rows_year_rating:
        y = int(year)
        if rating is None:
            continue
        r = float(rating)
        if y in early_years:
            early_ratings.append(r)
        else:
            recent_ratings.append(r)

    early_avg = sum(early_ratings) / len(early_ratings) if early_ratings else None
    recent_avg = sum(recent_ratings) / len(recent_ratings) if recent_ratings else None
    rating_delta = None
    rating_trend = "stable"
    if early_avg is not None and recent_avg is not None:
        rating_delta = round(recent_avg - early_avg, 2)
        if rating_delta > 0.2:
            rating_trend = "more_generous"
        elif rating_delta < -0.2:
            rating_trend = "more_selective"

    return {
        "early_years_label": f"{years_sorted[0]}–{years_sorted[mid - 1]}",
        "recent_years_label": f"{years_sorted[mid]}–{years_sorted[-1]}",
        "language_shifts": language_shifts,
        "broadening": broadening,
        "rating_trend": {
            "early_avg": round(early_avg, 2) if early_avg is not None else None,
            "recent_avg": round(recent_avg, 2) if recent_avg is not None else None,
            "delta": rating_delta,
            "interpretation": rating_trend,
        },
    }


def _compute_language_shifts(
    lang_by_year: dict[int, Counter],
    early_years: set[int],
    recent_years: set[int],
) -> list[dict]:
    """Early vs recent: biggest language gains and declines."""
    early_total: Counter = Counter()
    recent_total: Counter = Counter()
    for y, counter in lang_by_year.items():
        for l, n in counter.items():
            if _is_low_quality(l):
                continue
            if y in early_years:
                early_total[l] += n
            else:
                recent_total[l] += n

    shifts = []
    all_langs = set(early_total.keys()) | set(recent_total.keys())
    for l in all_langs:
        early = early_total.get(l, 0)
        recent = recent_total.get(l, 0)
        delta = recent - early
        if early + recent >= 6:
            shifts.append({
                "language": l,
                "early_count": early,
                "recent_count": recent,
                "delta": delta,
            })
    shifts.sort(key=lambda x: -x["delta"])
    return shifts[:10]


def _build_predictors_8plus(db: Session) -> dict:
    """Which features are associated with 8+ ratings (lift analysis)."""
    total = db.query(IMDbRating).filter(IMDbRating.user_rating.isnot(None)).count()
    strong = db.query(IMDbRating).filter(IMDbRating.user_rating >= STRONG_THRESHOLD).count()
    global_rate = strong / total if total > 0 else 0

    rows = (
        db.query(IMDbRating.genres, IMDbRating.user_rating)
        .filter(IMDbRating.genres.isnot(None), IMDbRating.user_rating.isnot(None))
        .all()
    )
    genre_total: Counter = Counter()
    genre_strong: Counter = Counter()
    for genres, r in rows:
        for g in _parse_genres(genres):
            genre_total[g] += 1
            if r >= STRONG_THRESHOLD:
                genre_strong[g] += 1

    def _lift_scores(totals: Counter, strongs: Counter) -> list[dict]:
        result = []
        for key in totals:
            if _is_low_quality(key):
                continue
            t, s = totals[key], strongs.get(key, 0)
            if t < MIN_SUPPORT:
                continue
            rate = s / t if t > 0 else 0
            lift = rate / global_rate if global_rate > 0 else 0
            support_weight = min(1.0, t / SUPPORT_FLOOR)
            score = lift * support_weight
            result.append({
                "feature": key,
                "count": t,
                "rate_8plus": round(rate, 3),
                "lift": round(lift, 2),
                "score": round(score, 2),
            })
        result.sort(key=lambda x: (-x["score"], -x["count"]))
        return result[:10]

    genre_signals = _lift_scores(genre_total, genre_strong)

    country_rows = (
        db.query(TitleMetadata.country, IMDbRating.user_rating)
        .join(IMDbRating, IMDbRating.imdb_title_id == TitleMetadata.imdb_title_id)
        .filter(TitleMetadata.country.isnot(None), IMDbRating.user_rating.isnot(None))
        .all()
    )
    country_total: Counter = Counter()
    country_strong: Counter = Counter()
    for c_str, r in country_rows:
        for c in parse_and_normalize_countries(c_str):
            country_total[c] += 1
            if r >= STRONG_THRESHOLD:
                country_strong[c] += 1
    country_signals = _lift_scores(country_total, country_strong)

    decade_rows = (
        db.query(IMDbRating.year, IMDbRating.user_rating)
        .filter(IMDbRating.year.isnot(None), IMDbRating.user_rating.isnot(None))
        .all()
    )
    decade_total: Counter = Counter()
    decade_strong: Counter = Counter()
    for y, r in decade_rows:
        d = _decade(y)
        if d:
            decade_total[d] += 1
            if r >= STRONG_THRESHOLD:
                decade_strong[d] += 1
    decade_signals = _lift_scores(decade_total, decade_strong)

    lang_rows = (
        db.query(TitleMetadata.languages, IMDbRating.user_rating)
        .join(IMDbRating, IMDbRating.imdb_title_id == TitleMetadata.imdb_title_id)
        .filter(TitleMetadata.languages.isnot(None), IMDbRating.user_rating.isnot(None))
        .all()
    )
    lang_total: Counter = Counter()
    lang_strong: Counter = Counter()
    for l_str, r in lang_rows:
        for lang in _parse_languages(l_str):
            lang_total[lang] += 1
            if r >= STRONG_THRESHOLD:
                lang_strong[lang] += 1
    lang_signals = _lift_scores(lang_total, lang_strong)

    tt_rows = (
        db.query(IMDbRating.title_type, IMDbRating.user_rating)
        .filter(IMDbRating.title_type.isnot(None), IMDbRating.user_rating.isnot(None))
        .all()
    )
    tt_total: Counter = Counter()
    tt_strong: Counter = Counter()
    for tt, r in tt_rows:
        if tt and not _is_low_quality(tt):
            tt_total[tt] += 1
            if r >= STRONG_THRESHOLD:
                tt_strong[tt] += 1
    tt_signals = _lift_scores(tt_total, tt_strong)

    return {
        "global_rate_8plus": round(global_rate, 3),
        "min_support": MIN_SUPPORT,
        "genre_signals": genre_signals,
        "country_signals": country_signals,
        "decade_signals": decade_signals,
        "language_signals": lang_signals,
        "title_type_signals": tt_signals,
    }


def _build_watchlist_taste_alignment(db: Session) -> dict:
    """Watchlist genres/countries aligned with your 8+ taste (from your ratings)."""
    genre_total: Counter = Counter()
    genre_strong: Counter = Counter()
    for genres, r in db.query(IMDbRating.genres, IMDbRating.user_rating).filter(
        IMDbRating.genres.isnot(None), IMDbRating.user_rating.isnot(None)
    ).all():
        for g in _parse_genres(genres):
            genre_total[g] += 1
            if r >= STRONG_THRESHOLD:
                genre_strong[g] += 1

    country_total: Counter = Counter()
    country_strong: Counter = Counter()
    for c_str, r in db.query(TitleMetadata.country, IMDbRating.user_rating).join(
        IMDbRating, IMDbRating.imdb_title_id == TitleMetadata.imdb_title_id
    ).filter(
        TitleMetadata.country.isnot(None), IMDbRating.user_rating.isnot(None)
    ).all():
        for c in parse_and_normalize_countries(c_str):
            country_total[c] += 1
            if r >= STRONG_THRESHOLD:
                country_strong[c] += 1

    watchlist_rows = db.query(IMDbWatchlistItem.genres).filter(
        IMDbWatchlistItem.genres.isnot(None)
    ).all()
    genre_wl_count: Counter = Counter()
    for (genres,) in watchlist_rows:
        for g in _parse_genres(genres):
            genre_wl_count[g] += 1

    wl_country_rows = (
        db.query(TitleMetadata.country)
        .join(IMDbWatchlistItem, IMDbWatchlistItem.imdb_title_id == TitleMetadata.imdb_title_id)
        .filter(TitleMetadata.country.isnot(None))
        .all()
    )
    country_wl_count: Counter = Counter()
    for (c_str,) in wl_country_rows:
        for c in parse_and_normalize_countries(c_str):
            country_wl_count[c] += 1

    aligned_genres = []
    for g in genre_wl_count:
        if _is_low_quality(g) or genre_wl_count[g] < 5:
            continue
        total = genre_total.get(g, 0)
        if total < MIN_SUPPORT:
            continue
        rate = genre_strong.get(g, 0) / total if total > 0 else 0
        aligned_genres.append({
            "genre": g,
            "watchlist_count": genre_wl_count[g],
            "rate_8plus": round(rate, 3),
            "rated_count": total,
        })
    aligned_genres.sort(key=lambda x: (-x["rate_8plus"], -x["watchlist_count"]))
    aligned_genres = aligned_genres[:10]

    aligned_countries = []
    for c in country_wl_count:
        if _is_low_quality(c) or country_wl_count[c] < 5:
            continue
        total = country_total.get(c, 0)
        if total < MIN_SUPPORT:
            continue
        rate = country_strong.get(c, 0) / total if total > 0 else 0
        aligned_countries.append({
            "country": c,
            "watchlist_count": country_wl_count[c],
            "rate_8plus": round(rate, 3),
            "rated_count": total,
        })
    aligned_countries.sort(key=lambda x: (-x["rate_8plus"], -x["watchlist_count"]))
    aligned_countries = aligned_countries[:10]

    return {
        "aligned_genres": aligned_genres,
        "aligned_countries": aligned_countries,
    }


def _build_genre_combinations(db: Session) -> dict:
    """Genre pairs associated with higher 8+ rate (min support)."""
    rows = (
        db.query(IMDbRating.genres, IMDbRating.user_rating)
        .filter(IMDbRating.genres.isnot(None), IMDbRating.user_rating.isnot(None))
        .all()
    )
    pair_total: Counter = Counter()
    pair_strong: Counter = Counter()
    for genres_str, r in rows:
        gs = _parse_genres(genres_str)
        if len(gs) < 2:
            continue
        for i, g1 in enumerate(gs):
            for g2 in gs[i + 1 :]:
                if _is_low_quality(g1) or _is_low_quality(g2):
                    continue
                pair = tuple(sorted([g1, g2]))
                pair_total[pair] += 1
                if r >= STRONG_THRESHOLD:
                    pair_strong[pair] += 1

    total = db.query(IMDbRating).filter(IMDbRating.user_rating.isnot(None)).count()
    strong = db.query(IMDbRating).filter(IMDbRating.user_rating >= STRONG_THRESHOLD).count()
    global_rate = strong / total if total > 0 else 0

    result = []
    for pair, count in pair_total.most_common(50):
        if count < GENRE_PAIR_MIN_SUPPORT:
            continue
        s = pair_strong.get(pair, 0)
        rate = s / count if count > 0 else 0
        lift = rate / global_rate if global_rate > 0 else 0
        result.append({
            "genres": f"{pair[0]} + {pair[1]}",
            "count": count,
            "rate_8plus": round(rate, 3),
            "lift": round(lift, 2),
        })
    result.sort(key=lambda x: (-x["rate_8plus"], -x["count"]))
    return {
        "min_support": GENRE_PAIR_MIN_SUPPORT,
        "global_rate_8plus": round(global_rate, 3),
        "pairs": result[:15],
    }


def _build_best_creators(db: Session) -> dict:
    """Best directors, actors, writers with min N rated titles."""
    rows = (
        db.query(
            TitleMetadata.directors,
            TitleMetadata.actors,
            TitleMetadata.writer,
            IMDbRating.user_rating,
        )
        .join(IMDbRating, IMDbRating.imdb_title_id == TitleMetadata.imdb_title_id)
        .filter(IMDbRating.user_rating.isnot(None))
        .all()
    )

    def _parse_people(s: str | None) -> list[str]:
        if not s or not s.strip():
            return []
        return [p.strip() for p in s.split(",") if p.strip() and not _is_low_quality(p.strip())]

    director_ratings: dict[str, list] = defaultdict(list)
    actor_ratings: dict[str, list] = defaultdict(list)
    writer_ratings: dict[str, list] = defaultdict(list)

    for directors, actors, writer, rating in rows:
        for p in _parse_people(directors):
            director_ratings[p].append(rating)
        for p in _parse_people(actors):
            actor_ratings[p].append(rating)
        for p in _parse_people(writer):
            writer_ratings[p].append(rating)

    def _top_creators(ratings: dict[str, list], min_n: int) -> list[dict]:
        result = []
        for name, vals in ratings.items():
            valid = [v for v in vals if v is not None]
            if len(valid) < min_n:
                continue
            avg = sum(valid) / len(valid)
            result.append({
                "name": name,
                "count": len(valid),
                "avg_rating": round(avg, 2),
            })
        result.sort(key=lambda x: (-x["avg_rating"], -x["count"]))
        return result[:10]

    return {
        "min_support": CREATOR_MIN_SUPPORT,
        "directors": _top_creators(director_ratings, CREATOR_MIN_SUPPORT),
        "actors": _top_creators(actor_ratings, CREATOR_MIN_SUPPORT),
        "writers": _top_creators(writer_ratings, CREATOR_MIN_SUPPORT),
    }


EIGHTS_VS_SEVENS_MIN = 10  # min titles in each group (8+ and 7) for a feature


def _build_eights_vs_sevens(db: Session) -> dict:
    """What distinguishes 8+ from 7: features more associated with strong favorites than good-but-not-top ratings."""
    rows = (
        db.query(IMDbRating.genres, IMDbRating.user_rating)
        .filter(IMDbRating.genres.isnot(None), IMDbRating.user_rating.isnot(None))
        .all()
    )
    genre_8: Counter = Counter()
    genre_7: Counter = Counter()
    for genres, r in rows:
        for g in _parse_genres(genres):
            if r >= STRONG_THRESHOLD:
                genre_8[g] += 1
            elif r == 7:
                genre_7[g] += 1

    total_8 = sum(genre_8.values())
    total_7 = sum(genre_7.values())
    if total_8 == 0 or total_7 == 0:
        return {"genre_signals": [], "note": "Need both 8+ and 7 ratings."}

    genre_signals = []
    all_genres = set(genre_8.keys()) | set(genre_7.keys())
    for g in all_genres:
        if _is_low_quality(g):
            continue
        c8, c7 = genre_8.get(g, 0), genre_7.get(g, 0)
        if c8 < EIGHTS_VS_SEVENS_MIN or c7 < EIGHTS_VS_SEVENS_MIN:
            continue
        share_8 = c8 / total_8
        share_7 = c7 / total_7
        ratio = share_8 / share_7 if share_7 > 0 else 0
        if ratio > 1:
            genre_signals.append({
                "feature": g,
                "count_8plus": c8,
                "count_7": c7,
                "ratio_8_over_7": round(ratio, 2),
            })
    genre_signals.sort(key=lambda x: -x["ratio_8_over_7"])
    genre_signals = genre_signals[:8]

    country_rows = (
        db.query(TitleMetadata.country, IMDbRating.user_rating)
        .join(IMDbRating, IMDbRating.imdb_title_id == TitleMetadata.imdb_title_id)
        .filter(TitleMetadata.country.isnot(None), IMDbRating.user_rating.isnot(None))
        .all()
    )
    country_8: Counter = Counter()
    country_7: Counter = Counter()
    for c_str, r in country_rows:
        for c in parse_and_normalize_countries(c_str):
            if r >= STRONG_THRESHOLD:
                country_8[c] += 1
            elif r == 7:
                country_7[c] += 1
    total_8_c = sum(country_8.values())
    total_7_c = sum(country_7.values())
    country_signals = []
    if total_8_c > 0 and total_7_c > 0:
        all_countries = set(country_8.keys()) | set(country_7.keys())
        for c in all_countries:
            if _is_low_quality(c):
                continue
            c8, c7 = country_8.get(c, 0), country_7.get(c, 0)
            if c8 < EIGHTS_VS_SEVENS_MIN or c7 < EIGHTS_VS_SEVENS_MIN:
                continue
            share_8 = c8 / total_8_c
            share_7 = c7 / total_7_c
            ratio = share_8 / share_7 if share_7 > 0 else 0
            if ratio > 1:
                country_signals.append({
                    "feature": c,
                    "count_8plus": c8,
                    "count_7": c7,
                    "ratio_8_over_7": round(ratio, 2),
                })
        country_signals.sort(key=lambda x: -x["ratio_8_over_7"])
        country_signals = country_signals[:8]

    decade_rows = (
        db.query(IMDbRating.year, IMDbRating.user_rating)
        .filter(IMDbRating.year.isnot(None), IMDbRating.user_rating.isnot(None))
        .all()
    )
    decade_8: Counter = Counter()
    decade_7: Counter = Counter()
    for y, r in decade_rows:
        d = _decade(y)
        if d:
            if r >= STRONG_THRESHOLD:
                decade_8[d] += 1
            elif r == 7:
                decade_7[d] += 1
    total_8_d = sum(decade_8.values())
    total_7_d = sum(decade_7.values())
    decade_signals = []
    if total_8_d > 0 and total_7_d > 0:
        all_decades = set(decade_8.keys()) | set(decade_7.keys())
        for d in all_decades:
            c8, c7 = decade_8.get(d, 0), decade_7.get(d, 0)
            if c8 < EIGHTS_VS_SEVENS_MIN or c7 < EIGHTS_VS_SEVENS_MIN:
                continue
            share_8 = c8 / total_8_d
            share_7 = c7 / total_7_d
            ratio = share_8 / share_7 if share_7 > 0 else 0
            if ratio > 1:
                decade_signals.append({
                    "feature": d,
                    "count_8plus": c8,
                    "count_7": c7,
                    "ratio_8_over_7": round(ratio, 2),
                })
        decade_signals.sort(key=lambda x: -x["ratio_8_over_7"])
        decade_signals = decade_signals[:8]

    return {
        "min_support": EIGHTS_VS_SEVENS_MIN,
        "genre_signals": genre_signals,
        "country_signals": country_signals,
        "decade_signals": decade_signals,
    }


VOLUME_REWARD_MIN = 10


def _build_volume_vs_reward(db: Session) -> dict:
    """Volume vs reward: watch a lot but love less vs watch less but love more."""
    rows = (
        db.query(IMDbRating.genres, IMDbRating.user_rating)
        .filter(IMDbRating.genres.isnot(None), IMDbRating.user_rating.isnot(None))
        .all()
    )
    genre_count: Counter = Counter()
    genre_sum: Counter = Counter()
    for genres, r in rows:
        for g in _parse_genres(genres):
            genre_count[g] += 1
            genre_sum[g] += r

    watch_lot_love_less = []
    watch_less_love_more = []
    for g in genre_count:
        if _is_low_quality(g) or genre_count[g] < VOLUME_REWARD_MIN:
            continue
        count = genre_count[g]
        avg = genre_sum[g] / count
        watch_lot_love_less.append({"feature": g, "count": count, "avg_rating": round(avg, 2)})
        watch_less_love_more.append({"feature": g, "count": count, "avg_rating": round(avg, 2)})

    count_sorted = sorted(watch_lot_love_less, key=lambda x: -x["count"])
    avg_sorted = sorted(watch_less_love_more, key=lambda x: -x["avg_rating"])
    count_rank = {x["feature"]: i for i, x in enumerate(count_sorted)}
    avg_rank = {x["feature"]: i for i, x in enumerate(avg_sorted)}

    watch_lot_love_less = []
    for x in count_sorted[:20]:
        rank_count = count_rank[x["feature"]]
        rank_avg = avg_rank[x["feature"]]
        if rank_avg > rank_count + 5:
            watch_lot_love_less.append({**x, "rank_count": rank_count, "rank_avg": rank_avg})
    watch_lot_love_less.sort(key=lambda x: x["rank_avg"] - x["rank_count"])
    watch_lot_love_less = watch_lot_love_less[:6]

    watch_less_love_more = []
    for x in avg_sorted[:20]:
        rank_count = count_rank[x["feature"]]
        rank_avg = avg_rank[x["feature"]]
        if rank_count > rank_avg + 5:
            watch_less_love_more.append({**x, "rank_count": rank_count, "rank_avg": rank_avg})
    watch_less_love_more.sort(key=lambda x: x["rank_count"] - x["rank_avg"])
    watch_less_love_more = watch_less_love_more[:6]

    country_rows = (
        db.query(TitleMetadata.country, IMDbRating.user_rating)
        .join(IMDbRating, IMDbRating.imdb_title_id == TitleMetadata.imdb_title_id)
        .filter(TitleMetadata.country.isnot(None), IMDbRating.user_rating.isnot(None))
        .all()
    )
    country_count: Counter = Counter()
    country_sum: Counter = Counter()
    for c_str, r in country_rows:
        for c in parse_and_normalize_countries(c_str):
            country_count[c] += 1
            country_sum[c] += r

    country_watch_lot = []
    country_watch_less = []
    for c in country_count:
        if _is_low_quality(c) or country_count[c] < VOLUME_REWARD_MIN:
            continue
        count = country_count[c]
        avg = country_sum[c] / count
        country_watch_lot.append({"feature": c, "count": count, "avg_rating": round(avg, 2)})
        country_watch_less.append({"feature": c, "count": count, "avg_rating": round(avg, 2)})

    c_count_sorted = sorted(country_watch_lot, key=lambda x: -x["count"])
    c_avg_sorted = sorted(country_watch_less, key=lambda x: -x["avg_rating"])
    c_count_rank = {x["feature"]: i for i, x in enumerate(c_count_sorted)}
    c_avg_rank = {x["feature"]: i for i, x in enumerate(c_avg_sorted)}

    country_watch_lot = []
    for x in c_count_sorted[:15]:
        rc, ra = c_count_rank[x["feature"]], c_avg_rank[x["feature"]]
        if ra > rc + 3:
            country_watch_lot.append({**x, "rank_count": rc, "rank_avg": ra})
    country_watch_lot.sort(key=lambda x: x["rank_avg"] - x["rank_count"])
    country_watch_lot = country_watch_lot[:5]

    country_watch_less = []
    for x in c_avg_sorted[:15]:
        rc, ra = c_count_rank[x["feature"]], c_avg_rank[x["feature"]]
        if rc > ra + 3:
            country_watch_less.append({**x, "rank_count": rc, "rank_avg": ra})
    country_watch_less.sort(key=lambda x: x["rank_count"] - x["rank_avg"])
    country_watch_less = country_watch_less[:5]

    return {
        "min_support": VOLUME_REWARD_MIN,
        "watch_lot_love_less_genres": watch_lot_love_less,
        "watch_less_love_more_genres": watch_less_love_more,
        "watch_lot_love_less_countries": country_watch_lot,
        "watch_less_love_more_countries": country_watch_less,
    }


def _build_score_disagreement(db: Session) -> dict:
    """Compare my rating vs IMDb rating vs Metascore (critics). Metascore normalized to 0–10.

    Requires titles with user_rating, imdb_rating, and metascore. Graceful when Metascore missing.
    """
    rows = (
        db.query(
            IMDbRating.imdb_title_id,
            IMDbRating.title,
            IMDbRating.year,
            IMDbRating.user_rating,
            IMDbRating.imdb_rating,
            TitleMetadata.metascore,
        )
        .join(TitleMetadata, IMDbRating.imdb_title_id == TitleMetadata.imdb_title_id)
        .filter(
            IMDbRating.user_rating.isnot(None),
            TitleMetadata.metascore.isnot(None),
        )
        .all()
    )
    # Prefer IMDb rating from CSV; fallback to TitleMetadata if needed (same join)
    # IMDbRating has imdb_rating from export; TitleMetadata has it from OMDb. Use IMDbRating.
    valid = []
    for r in rows:
        imdb = r.imdb_rating if r.imdb_rating is not None else None
        if imdb is None:
            continue
        meta = r.metascore
        if meta is None or meta < 0 or meta > 100:
            continue
        meta_10 = meta / 10.0
        me = float(r.user_rating)
        valid.append({
            "imdb_title_id": r.imdb_title_id,
            "title": r.title or "",
            "year": r.year,
            "me": me,
            "imdb": float(imdb),
            "metascore_10": round(meta_10, 1),
            "gap_me_imdb": round(me - float(imdb), 1),
            "gap_me_metascore": round(me - meta_10, 1),
            "gap_critic_audience": round(meta_10 - float(imdb), 1),
        })

    if len(valid) < 5:
        return {"n_titles": len(valid), "note": "Need at least 5 titles with Metascore for this study"}

    n = len(valid)
    avg_gap_me_imdb = sum(x["gap_me_imdb"] for x in valid) / n
    avg_gap_me_metascore = sum(x["gap_me_metascore"] for x in valid) / n
    abs_me_imdb = sum(abs(x["gap_me_imdb"]) for x in valid) / n
    abs_me_metascore = sum(abs(x["gap_me_metascore"]) for x in valid) / n

    alignment = "critics" if abs_me_metascore < abs_me_imdb else "audiences"
    if abs(abs_me_metascore - abs_me_imdb) < 0.1:
        alignment = "neutral"

    higher_than_imdb = sorted([x for x in valid if x["gap_me_imdb"] > 0], key=lambda x: -x["gap_me_imdb"])[:5]
    lower_than_imdb = sorted([x for x in valid if x["gap_me_imdb"] < 0], key=lambda x: x["gap_me_imdb"])[:5]
    higher_than_metascore = sorted([x for x in valid if x["gap_me_metascore"] > 0], key=lambda x: -x["gap_me_metascore"])[:5]
    lower_than_metascore = sorted([x for x in valid if x["gap_me_metascore"] < 0], key=lambda x: x["gap_me_metascore"])[:5]

    critic_audience_divergence = [
        x for x in valid if abs(x["gap_critic_audience"]) >= 1.5
    ]
    critic_audience_divergence.sort(key=lambda x: -abs(x["gap_critic_audience"]))
    critic_audience_divergence = critic_audience_divergence[:15]

    def _row(r):
        return {
            "imdb_title_id": r["imdb_title_id"],
            "title": r["title"],
            "year": r["year"],
            "me": r["me"],
            "imdb": r["imdb"],
            "metascore_10": r["metascore_10"],
            "gap_me_imdb": r["gap_me_imdb"],
            "gap_me_metascore": r["gap_me_metascore"],
            "gap_critic_audience": r["gap_critic_audience"],
        }

    return {
        "n_titles": n,
        "avg_gap_me_imdb": round(avg_gap_me_imdb, 2),
        "avg_gap_me_metascore": round(avg_gap_me_metascore, 2),
        "alignment": alignment,
        "higher_than_imdb": [_row(x) for x in higher_than_imdb],
        "lower_than_imdb": [_row(x) for x in lower_than_imdb],
        "higher_than_metascore": [_row(x) for x in higher_than_metascore],
        "lower_than_metascore": [_row(x) for x in lower_than_metascore],
        "critic_audience_divergence": [_row(x) for x in critic_audience_divergence],
    }


def _build_favorite_list_summary(db: Session) -> dict:
    """Summary of curated favorite list: genres, countries, overlap with rated."""
    fl_items = db.query(FavoriteListItem).all()
    count = len(fl_items)
    if count == 0:
        return {"count": 0, "top_genres": [], "top_countries": [], "overlap_with_rated": 0}

    genre_counts: Counter = Counter()
    country_counts: Counter = Counter()
    fl_ids = {r.imdb_title_id for r in fl_items}

    for r in fl_items:
        for g in _parse_genres(r.genres):
            genre_counts[g] += 1

    country_rows = (
        db.query(TitleMetadata.country)
        .join(FavoriteListItem, FavoriteListItem.imdb_title_id == TitleMetadata.imdb_title_id)
        .filter(TitleMetadata.country.isnot(None))
        .all()
    )
    for (c_str,) in country_rows:
        for c in parse_and_normalize_countries(c_str):
            country_counts[c] += 1

    rated_ids = {r.imdb_title_id for r in db.query(IMDbRating.imdb_title_id).all()}
    overlap = len(fl_ids & rated_ids)

    top_genres = [
        {"genre": g, "count": c}
        for g, c in genre_counts.most_common(10)
        if not _is_low_quality(g)
    ]
    top_countries = [
        {"country": c, "count": n}
        for c, n in country_counts.most_common(10)
        if not _is_low_quality(c)
    ]

    return {
        "count": count,
        "top_genres": top_genres,
        "top_countries": top_countries,
        "overlap_with_rated": overlap,
    }
