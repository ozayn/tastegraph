"""Build modeling datasets from rated titles.

Target: 1 if user_rating >= 8 (strong favorite), else 0.
8+ = strong positive; 7 is still a good rating. One row per rated title with raw fields for feature engineering.
"""

from pathlib import Path

import pandas as pd

from app.core.database import SessionLocal
from app.models.favorite_list_item import FavoriteListItem
from app.models.favorite_person import FavoritePerson
from app.models.imdb_rating import IMDbRating
from app.models.title_metadata import TitleMetadata
from app.services.country_normalize import parse_and_normalize_countries
from app.services.favorite_boost import _load_favorites_by_role, _parse_names


def _parse_list(s: str | None) -> list[str]:
    if not s or not s.strip():
        return []
    return [x.strip() for x in s.split(",") if x.strip() and x.strip().upper() != "N/A"]


def _decade(year: int | None) -> str | None:
    if year is None:
        return None
    return f"{year // 10 * 10}s"


def build_rated_dataset(db=None) -> pd.DataFrame:
    """Build dataset of rated titles with target and raw fields.

    Returns DataFrame with columns:
    - imdb_title_id, user_rating, target (1 if >=8 else 0; 8+ = strong favorite, 7 is still good)
    - title_type, year, decade
    - genres, country, languages, directors, actors, writer
    - favorite_people_match (bool), in_favorite_list (bool)
    """
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        rows = (
            db.query(
                IMDbRating.imdb_title_id,
                IMDbRating.user_rating,
                IMDbRating.date_rated,
                IMDbRating.title_type,
                IMDbRating.year,
                IMDbRating.genres,
                IMDbRating.directors,
                TitleMetadata.country,
                TitleMetadata.languages,
                TitleMetadata.actors,
                TitleMetadata.writer,
            )
            .outerjoin(TitleMetadata, IMDbRating.imdb_title_id == TitleMetadata.imdb_title_id)
            .filter(IMDbRating.user_rating.isnot(None))
            .all()
        )

        favorite_list_ids = {r.imdb_title_id for r in db.query(FavoriteListItem.imdb_title_id).all()}
        favorites_by_role = _load_favorites_by_role(db)

        records = []
        for r in rows:
            imdb_id, user_rating, date_rated, title_type, year, genres, directors, country, languages, actors, writer = r
            target = 1 if (user_rating or 0) >= 8 else 0

            # Favorite people match
            actor_names = _parse_names(actors)
            director_names = _parse_names(directors)
            writer_names = _parse_names(writer)
            fav_match = False
            for role, fav_names in favorites_by_role.items():
                if not fav_names:
                    continue
                names = director_names if role == "director" else (writer_names if role == "writer" else actor_names)
                if fav_names & names:
                    fav_match = True
                    break

            records.append({
                "imdb_title_id": imdb_id,
                "user_rating": user_rating,
                "target": target,
                "date_rated": date_rated,
                "title_type": title_type or "",
                "year": year,
                "decade": _decade(year) or "",
                "genres": genres or "",
                "country": country or "",
                "languages": languages or "",
                "directors": directors or "",
                "actors": actors or "",
                "writer": writer or "",
                "favorite_people_match": fav_match,
                "in_favorite_list": imdb_id in favorite_list_ids,
            })

        return pd.DataFrame(records)
    finally:
        if close_db:
            db.close()


def build_watchlist_candidates(db=None) -> pd.DataFrame:
    """Build dataset of unrated watchlist titles for prediction.

    Returns DataFrame with same schema as rated dataset (minus user_rating, target).
    """
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        from sqlalchemy import exists, select

        from app.models.imdb_watchlist_item import IMDbWatchlistItem

        rated_exists = exists(select(1).where(IMDbRating.imdb_title_id == IMDbWatchlistItem.imdb_title_id))
        rows = (
            db.query(
                IMDbWatchlistItem.imdb_title_id,
                IMDbWatchlistItem.title,
                IMDbWatchlistItem.title_type,
                IMDbWatchlistItem.year,
                IMDbWatchlistItem.genres,
                TitleMetadata.country,
                TitleMetadata.languages,
                TitleMetadata.directors,
                TitleMetadata.actors,
                TitleMetadata.writer,
            )
            .outerjoin(TitleMetadata, IMDbWatchlistItem.imdb_title_id == TitleMetadata.imdb_title_id)
            .filter(IMDbWatchlistItem.your_rating.is_(None))
            .filter(~rated_exists)
            .all()
        )

        favorite_list_ids = {r.imdb_title_id for r in db.query(FavoriteListItem.imdb_title_id).all()}
        favorites_by_role = _load_favorites_by_role(db)

        records = []
        for r in rows:
            imdb_id, title, title_type, year, genres, country, languages, directors, actors, writer = r
            actor_names = _parse_names(actors)
            director_names = _parse_names(directors)
            writer_names = _parse_names(writer)
            fav_match = False
            for role, fav_names in favorites_by_role.items():
                if not fav_names:
                    continue
                names = director_names if role == "director" else (writer_names if role == "writer" else actor_names)
                if fav_names & names:
                    fav_match = True
                    break

            records.append({
                "imdb_title_id": imdb_id,
                "title": title or "",
                "title_type": title_type or "",
                "year": year,
                "decade": _decade(year) or "",
                "genres": genres or "",
                "country": country or "",
                "languages": languages or "",
                "directors": directors or "",
                "actors": actors or "",
                "writer": writer or "",
                "favorite_people_match": fav_match,
                "in_favorite_list": imdb_id in favorite_list_ids,
            })

        return pd.DataFrame(records)
    finally:
        if close_db:
            db.close()
