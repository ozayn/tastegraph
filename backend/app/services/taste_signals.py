"""Taste signals from 8+ ratings for recommendation reasons and high-fit scoring."""

from collections import Counter
from sqlalchemy.orm import Session

from app.models.imdb_rating import IMDbRating
from app.models.title_metadata import TitleMetadata
from app.services.country_normalize import parse_and_normalize_countries

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
    """Load strong genres, countries, decades from 8+ ratings. Returns sets for fast lookup."""
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

    return {
        "strong_genres": strong_genres,
        "strong_countries": strong_countries,
        "strong_decades": strong_decades,
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

    for m in favorite_matches[:3]:
        role = m.get("role", "")
        name = m.get("name", "")
        if name:
            role_label = {"director": "Director", "actor": "Actor", "writer": "Writer"}.get(role, role)
            reasons.append(f"features {role_label}: {name}")

    return reasons[:5]  # Cap at 5 reasons


def score_watchlist_item(
    genres: str | None,
    country: str | None,
    year: int | None,
    favorite_matches: list[dict],
    signals: dict,
) -> tuple[int, list[str]]:
    """Score a watchlist item by matching taste signals. Returns (score, matching_signals)."""
    score = 0
    matching: list[str] = []
    item_genres = {g.strip() for g in (genres or "").split(",") if g.strip()}
    item_countries = parse_and_normalize_countries(country) if country else set()
    item_decade = _decade(year)

    for g in item_genres & signals["strong_genres"]:
        score += 2  # Genre match
        matching.append(g)

    for c in item_countries & signals["strong_countries"]:
        score += 2
        matching.append(c)

    if item_decade and item_decade in signals["strong_decades"]:
        score += 1
        matching.append(item_decade)

    for m in favorite_matches:
        name = m.get("name", "")
        if name:
            score += 2
            role = m.get("role", "creator")
            matching.append(f"{name} ({role})")

    return score, matching[:8]  # Cap matching signals
