"""Insights: viewing history and taste profile analysis."""

from collections import Counter
from sqlalchemy import func, extract
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.imdb_rating import IMDbRating
from app.models.title_metadata import TitleMetadata
from app.services.country_normalize import parse_and_normalize_countries
from fastapi import APIRouter

router = APIRouter(prefix="/insights", tags=["insights"])


def _is_low_quality(s: str) -> bool:
    """Filter N/A, empty, and trivial values."""
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


def _parse_people(people_str: str | None) -> list[str]:
    if not people_str or not people_str.strip():
        return []
    return [p.strip() for p in people_str.split(",") if p.strip() and not _is_low_quality(p.strip())]


def _decade(year: int | None) -> str | None:
    if year is None:
        return None
    return f"{year // 10 * 10}s"


@router.get("")
def insights_summary():
    """Precomputed insights: overview, people, trends, taste signals."""
    db = SessionLocal()
    try:
        overview = _build_overview(db)
        people = _build_people(db)
        trends = _build_trends(db)
        taste_signals = _build_taste_signals(db)
        return {
            "overview": overview,
            "people": people,
            "trends": trends,
            "taste_signals": taste_signals,
        }
    finally:
        db.close()


def _build_overview(db: Session) -> dict:
    total = db.query(IMDbRating).count()
    stats = (
        db.query(
            func.avg(IMDbRating.user_rating).label("avg_rating"),
            func.min(IMDbRating.user_rating).label("min_rating"),
            func.max(IMDbRating.user_rating).label("max_rating"),
        )
        .filter(IMDbRating.user_rating.isnot(None))
        .one()
    )
    avg_rating = round(float(stats.avg_rating), 2) if stats.avg_rating else None
    min_rating = int(stats.min_rating) if stats.min_rating is not None else None
    max_rating = int(stats.max_rating) if stats.max_rating is not None else None

    rows = db.query(IMDbRating.genres).filter(IMDbRating.genres.isnot(None)).all()
    genre_counts: Counter = Counter()
    for (g_str,) in rows:
        for genre in _parse_genres(g_str):
            genre_counts[genre] += 1

    genre_ratings = (
        db.query(IMDbRating.genres, IMDbRating.user_rating)
        .filter(IMDbRating.genres.isnot(None), IMDbRating.user_rating.isnot(None))
        .all()
    )
    genre_by_rating: dict[str, list] = {}
    for g_str, r in genre_ratings:
        for genre in _parse_genres(g_str):
            genre_by_rating.setdefault(genre, []).append(r)

    top_genres = [
        {"genre": g, "count": c}
        for g, c in genre_counts.most_common(15)
        if not _is_low_quality(g)
    ][:10]
    top_genres_by_avg = []
    for g, ratings in genre_by_rating.items():
        valid = [r for r in ratings if r is not None]
        if len(valid) >= 3:
            avg = sum(valid) / len(valid)
            top_genres_by_avg.append({"genre": g, "avg_rating": round(avg, 2), "count": len(valid)})
    top_genres_by_avg = [x for x in top_genres_by_avg if not _is_low_quality(x["genre"])]
    top_genres_by_avg.sort(key=lambda x: (-x["avg_rating"], -x["count"]))
    top_genres_by_avg = top_genres_by_avg[:10]

    country_rows = (
        db.query(TitleMetadata.country)
        .join(IMDbRating, IMDbRating.imdb_title_id == TitleMetadata.imdb_title_id)
        .filter(TitleMetadata.country.isnot(None))
        .all()
    )
    country_counts: Counter = Counter()
    for (c_str,) in country_rows:
        for c in parse_and_normalize_countries(c_str):
            country_counts[c] += 1
    top_countries = [
        {"country": c, "count": n}
        for c, n in country_counts.most_common(15)
        if not _is_low_quality(c)
    ][:10]

    year_rows = (
        db.query(IMDbRating.year)
        .filter(IMDbRating.year.isnot(None))
        .all()
    )
    decade_counts: Counter = Counter()
    for (y,) in year_rows:
        d = _decade(y)
        if d:
            decade_counts[d] += 1
    top_decades = [
        {"decade": d, "count": n}
        for d, n in decade_counts.most_common(15)
        if d and not _is_low_quality(d)
    ][:10]

    return {
        "total_rated": total,
        "average_rating": avg_rating,
        "min_rating": min_rating,
        "max_rating": max_rating,
        "top_genres": top_genres,
        "top_genres_by_avg": top_genres_by_avg,
        "top_countries": top_countries,
        "top_decades": top_decades,
    }


def _build_people(db: Session) -> dict:
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
    director_counts: Counter = Counter()
    director_ratings: dict[str, list] = {}
    actor_counts: Counter = Counter()
    actor_ratings: dict[str, list] = {}
    writer_counts: Counter = Counter()
    writer_ratings: dict[str, list] = {}

    for directors, actors, writer, rating in rows:
        for p in _parse_people(directors):
            director_counts[p] += 1
            director_ratings.setdefault(p, []).append(rating)
        for p in _parse_people(actors):
            actor_counts[p] += 1
            actor_ratings.setdefault(p, []).append(rating)
        for p in _parse_people(writer):
            writer_counts[p] += 1
            writer_ratings.setdefault(p, []).append(rating)

    def _top_people(counts: Counter, ratings: dict, min_count: int = 2) -> list:
        result = []
        for name, count in counts.most_common(25):
            if count < min_count or _is_low_quality(name):
                continue
            valid = [r for r in ratings.get(name, []) if r is not None]
            avg = sum(valid) / len(valid) if valid else None
            result.append({
                "name": name,
                "count": count,
                "avg_rating": round(avg, 2) if avg else None,
            })
        result.sort(key=lambda x: (-x["count"], -(x["avg_rating"] or 0)))
        return result[:10]

    return {
        "top_directors": _top_people(director_counts, director_ratings),
        "top_actors": _top_people(actor_counts, actor_ratings),
        "top_writers": _top_people(writer_counts, writer_ratings),
    }


def _build_trends(db: Session) -> dict:
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
    ratings_by_year_watched = {int(y): c for y, c, _ in by_year}
    avg_rating_by_year_watched = {
        int(y): round(float(avg), 2) if avg else None
        for y, _, avg in by_year
    }

    by_release = (
        db.query(IMDbRating.year, func.count(IMDbRating.id))
        .filter(IMDbRating.year.isnot(None))
        .group_by(IMDbRating.year)
        .order_by(IMDbRating.year)
        .all()
    )
    release_year_distribution = {int(y): c for y, c in by_release}

    return {
        "ratings_by_year_watched": ratings_by_year_watched,
        "avg_rating_by_year_watched": avg_rating_by_year_watched,
        "release_year_distribution": release_year_distribution,
    }


def _build_taste_signals(db: Session) -> dict:
    STRONG = 8
    rows = (
        db.query(IMDbRating.genres, TitleMetadata.country)
        .outerjoin(TitleMetadata, IMDbRating.imdb_title_id == TitleMetadata.imdb_title_id)
        .filter(IMDbRating.user_rating >= STRONG)
        .all()
    )
    strong_genre_counts: Counter = Counter()
    strong_country_counts: Counter = Counter()
    for genres, country in rows:
        for g in _parse_genres(genres):
            strong_genre_counts[g] += 1
        for c in parse_and_normalize_countries(country):
            strong_country_counts[c] += 1

    strong_genres = [
        {"genre": g, "count": c}
        for g, c in strong_genre_counts.most_common(15)
        if not _is_low_quality(g)
    ][:10]
    strong_countries = [
        {"country": c, "count": n}
        for c, n in strong_country_counts.most_common(15)
        if not _is_low_quality(c)
    ][:10]

    people_rows = (
        db.query(TitleMetadata.directors, TitleMetadata.actors, TitleMetadata.writer)
        .join(IMDbRating, IMDbRating.imdb_title_id == TitleMetadata.imdb_title_id)
        .filter(IMDbRating.user_rating >= STRONG)
        .all()
    )
    strong_people: Counter = Counter()
    for (d, a, w) in people_rows:
        for p in _parse_people(d) + _parse_people(a) + _parse_people(w):
            strong_people[p] += 1
    recurring_people = [
        {"name": n, "count": c}
        for n, c in strong_people.most_common(20)
        if c >= 2 and not _is_low_quality(n)
    ][:15]

    return {
        "strong_genres": strong_genres,
        "strong_countries": strong_countries,
        "recurring_people": recurring_people,
    }
