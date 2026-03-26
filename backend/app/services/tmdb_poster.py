"""TMDB poster lookup by IMDb ID (fallback when OMDb poster is missing or dead)."""

import httpx

from app.core.config import settings

_TMDB_FIND = "https://api.themoviedb.org/3/find/{imdb_id}"
_IMAGE_BASE = "https://image.tmdb.org/t/p/w342"


def fetch_tmdb_poster_url(imdb_title_id: str) -> str | None:
    """Resolve a poster image URL via TMDB /find (external_source=imdb_id).

    Returns None if TMDB_API_KEY is unset, request fails, or no poster_path.
    """
    key = (settings.TMDB_API_KEY or "").strip()
    if not key:
        return None

    iid = imdb_title_id.strip()
    if not iid.startswith("tt"):
        return None

    url = _TMDB_FIND.format(imdb_id=iid)
    params = {"api_key": key, "external_source": "imdb_id"}
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except (httpx.HTTPError, ValueError):
        return None

    for key_results in ("movie_results", "tv_results"):
        items = data.get(key_results) or []
        if not items:
            continue
        path = items[0].get("poster_path")
        if path and isinstance(path, str) and path.startswith("/"):
            return f"{_IMAGE_BASE}{path}"
    return None
