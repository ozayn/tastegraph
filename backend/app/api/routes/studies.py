"""Studies: portfolio-friendly analytical analyses."""

from collections import Counter, defaultdict
from sqlalchemy import func, extract
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
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
        return {
            "taste_evolution": taste_evolution,
            "predictors_8plus": predictors_8plus,
            "watchlist_taste_alignment": watchlist_taste_alignment,
            "genre_combinations": genre_combinations,
            "best_creators": best_creators,
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

    return {
        "avg_rating_by_year": avg_rating_by_year,
        "count_by_year": count_by_year,
        "top_genres_by_year": top_genres_by_year,
        "top_countries_by_year": top_countries_by_year,
        "genre_shifts": genre_shifts,
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
