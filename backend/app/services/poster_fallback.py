"""Poster resolution: prefer reachable OMDb URL, else TMDB (when configured)."""

from app.services.poster_url import is_poster_url_broken
from app.services.tmdb_poster import fetch_tmdb_poster_url

_MAX_POSTER_LEN = 500


def resolve_poster_for_title(imdb_title_id: str, omdb_poster: str | None) -> str | None:
    """Pick a poster URL: use OMDb if it loads; otherwise try TMDB. Returns None if nothing valid."""
    p = (omdb_poster or "").strip()
    if p and p.upper() != "N/A" and not is_poster_url_broken(p):
        return p[:_MAX_POSTER_LEN]

    tmdb_url = fetch_tmdb_poster_url(imdb_title_id)
    if tmdb_url and not is_poster_url_broken(tmdb_url):
        return tmdb_url[:_MAX_POSTER_LEN]

    return None
