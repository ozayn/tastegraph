"""Favorite person matching and ranking boost for recommendations."""

from sqlalchemy.orm import Session

from app.models.favorite_person import FavoritePerson

_BOOST_PER_MATCH = 0.5


def _parse_names(s: str | None) -> set[str]:
    """Parse comma-separated names into lowercase set for matching."""
    if not s or not s.strip():
        return set()
    return {n.strip().lower() for n in s.split(",") if n.strip()}


def _load_favorites_by_role(db: Session) -> dict[str, set[str]]:
    """Load favorite names grouped by role. Keys: actor, director, writer."""
    rows = db.query(FavoritePerson.name, FavoritePerson.role).all()
    by_role: dict[str, set[str]] = {"actor": set(), "director": set(), "writer": set()}
    for name, role in rows:
        if role in by_role and name:
            by_role[role].add(name.strip().lower())
    return by_role


def compute_favorite_boost(
    actors: str | None,
    directors: str | None,
    writer: str | None,
    favorites_by_role: dict[str, set[str]],
) -> tuple[float, list[dict[str, str]]]:
    """Return (boost_score, matches) for a title. Matches: [{role, name}, ...]."""
    if not any(favorites_by_role.values()):
        return 0.0, []

    actor_names = _parse_names(actors)
    director_names = _parse_names(directors)
    writer_names = _parse_names(writer)

    matches: list[dict[str, str]] = []
    for role, fav_names in favorites_by_role.items():
        if not fav_names:
            continue
        if role == "actor":
            names = actor_names
        elif role == "director":
            names = director_names
        else:
            names = writer_names
        for fav in fav_names:
            if fav in names:
                matches.append({"role": role, "name": fav})

    boost = _BOOST_PER_MATCH * len(matches)
    return boost, matches
