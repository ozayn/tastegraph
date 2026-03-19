"""Taste signals from 8+ ratings for recommendation reasons and high-fit scoring."""

from collections import Counter
from sqlalchemy.orm import Session

from app.models.favorite_list_item import FavoriteListItem
from app.models.imdb_rating import IMDbRating
from app.models.title_metadata import TitleMetadata
from app.services.country_normalize import parse_and_normalize_countries
from app.services.favorite_boost import ROLE_SCORE_WEIGHT

STRONG_THRESHOLD = 8


def _is_low_quality(s: str) -> bool:
    s = (s or "").strip()
    return not s or len(s) < 2 or s.upper() in ("N/A", "NA", "N.A.", "N.A")


def _parse_genres(genres: str | None) -> list[str]:
    if not genres or not genres.strip():
        return []
    return [g.strip() for g in genres.split(",") if g.strip() and not _is_low_quality(g.strip())]


def _decade(year: int | None) -> str | None:
    if year is None:
        return None
    return f"{year // 10 * 10}s"


def load_taste_signals(db: Session) -> dict:
    """Load strong genres, countries, decades from 8+ ratings and favorite_list. Returns sets for fast lookup."""
    rows = (
        db.query(IMDbRating.genres, TitleMetadata.country, IMDbRating.year)
        .outerjoin(TitleMetadata, IMDbRating.imdb_title_id == TitleMetadata.imdb_title_id)
        .filter(IMDbRating.user_rating >= STRONG_THRESHOLD)
        .all()
    )
    genre_counts: Counter = Counter()
    country_counts: Counter = Counter()
    decade_counts: Counter = Counter()
    for genres, country, year in rows:
        for g in _parse_genres(genres):
            genre_counts[g] += 1
        for c in parse_and_normalize_countries(country):
            country_counts[c] += 1
        d = _decade(year)
        if d:
            decade_counts[d] += 1

    strong_genres = {
        g for g, _ in genre_counts.most_common(15)
        if not _is_low_quality(g)
    }
    strong_countries = {
        c for c, _ in country_counts.most_common(15)
        if not _is_low_quality(c)
    }
    strong_decades = {
        d for d, _ in decade_counts.most_common(10)
        if d and not _is_low_quality(d)
    }

    # Merge favorite_list patterns (curated canon) into strong signals
    fl_rows = (
        db.query(FavoriteListItem.genres, TitleMetadata.country, FavoriteListItem.year)
        .outerjoin(TitleMetadata, FavoriteListItem.imdb_title_id == TitleMetadata.imdb_title_id)
        .all()
    )
    for genres, country, year in fl_rows:
        for g in _parse_genres(genres):
            strong_genres.add(g)
        for c in parse_and_normalize_countries(country):
            strong_countries.add(c)
        d = _decade(year)
        if d:
            strong_decades.add(d)

    favorite_list_ids = {r.imdb_title_id for r in db.query(FavoriteListItem.imdb_title_id).all()}

    return {
        "strong_genres": strong_genres,
        "strong_countries": strong_countries,
        "strong_decades": strong_decades,
        "favorite_list_ids": favorite_list_ids,
    }


def build_reasons(
    genres: str | None,
    country: str | None,
    year: int | None,
    favorite_matches: list[dict],
    signals: dict,
) -> list[str]:
    """Build a compact list of reason strings for a recommendation."""
    reasons: list[str] = []
    item_genres = {g.strip() for g in (genres or "").split(",") if g.strip()}
    item_countries = parse_and_normalize_countries(country) if country else set()
    item_decade = _decade(year)

    genre_overlap = item_genres & signals["strong_genres"]
    if genre_overlap:
        sorted_genres = sorted(genre_overlap)[:3]
        if len(sorted_genres) == 1:
            reasons.append(f"matches your strong genre: {sorted_genres[0]}")
        else:
            reasons.append(f"matches your strong genres: {', '.join(sorted_genres)}")

    country_overlap = item_countries & signals["strong_countries"]
    if country_overlap:
        c = next(iter(country_overlap))
        reasons.append(f"from a country you rate highly: {c}")

    if item_decade and item_decade in signals["strong_decades"]:
        reasons.append(f"aligns with a strong release decade: {item_decade}")

    for m in sorted(favorite_matches[:3], key=lambda x: ROLE_SCORE_WEIGHT.get(x.get("role", ""), 0), reverse=True):
        role = m.get("role", "")
        name = m.get("name", "")
        if name:
            role_label = {"director": "Director", "actor": "Actor", "writer": "Writer"}.get(role, role)
            reasons.append(f"features {role_label}: {name}")

    return reasons[:5]  # Cap at 5 reasons


def score_watchlist_item(
    imdb_title_id: str,
    genres: str | None,
    country: str | None,
    year: int | None,
    favorite_matches: list[dict],
    signals: dict,
) -> tuple[int, dict]:
    """Score a watchlist item by matching taste signals. Returns (score, explanation)."""
    score = 0
    item_genres = {g.strip() for g in (genres or "").split(",") if g.strip()}
    item_countries = parse_and_normalize_countries(country) if country else set()
    item_decade = _decade(year)

    in_favorite_list = imdb_title_id in signals.get("favorite_list_ids", set())

    matched_genres = sorted(item_genres & signals["strong_genres"])[:3]
    for _ in matched_genres:
        score += 2

    matched_countries = sorted(item_countries & signals["strong_countries"])[:2]
    for _ in matched_countries:
        score += 2

    matched_decade = item_decade if (item_decade and item_decade in signals["strong_decades"]) else None
    if matched_decade:
        score += 1

    if in_favorite_list:
        score += 5

    matched_people = [
        {"name": m.get("name", ""), "role": m.get("role", "creator")}
        for m in favorite_matches[:3]
        if m.get("name")
    ]
    for p in matched_people:
        score += ROLE_SCORE_WEIGHT.get(p["role"], 1)

    top_reasons: list[str] = []
    if in_favorite_list:
        top_reasons.append("In your curated favorites list")
    if matched_genres:
        top_reasons.append(f"Strong genre{'s' if len(matched_genres) > 1 else ''}: {', '.join(matched_genres)}")
    if matched_countries:
        top_reasons.append(f"From country you rate highly: {matched_countries[0]}")
    if matched_decade:
        top_reasons.append(f"Strong decade: {matched_decade}")
    for p in matched_people:
        role_label = {"director": "Director", "actor": "Actor", "writer": "Writer"}.get(p["role"], p["role"])
        top_reasons.append(f"Favorite {role_label}: {p['name']}")

    explanation = {
        "in_favorite_list": in_favorite_list,
        "matched_genres": matched_genres,
        "matched_countries": matched_countries,
        "matched_decade": matched_decade,
        "matched_people": matched_people,
        "top_reasons": top_reasons[:5],
    }
    return score, explanation
