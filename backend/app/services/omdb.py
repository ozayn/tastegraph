"""OMDb title fetch by imdb_title_id."""

import re
from dataclasses import dataclass
from datetime import date, datetime

import httpx

from app.core.config import settings


@dataclass
class TitleMetadataResult:
    """Expected output shape for OMDb title fetch."""

    imdb_title_id: str
    title: str | None
    title_type: str | None
    year: int | None
    genres: str | None
    languages: str | None
    country: str | None
    runtime_mins: int | None
    release_date: date | None
    directors: str | None
    imdb_rating: float | None
    num_votes: int | None
    url: str | None


def _parse_int(s: str | None) -> int | None:
    if not s or s == "N/A":
        return None
    cleaned = re.sub(r"[^\d]", "", s)
    return int(cleaned) if cleaned else None


def _parse_year(s: str | None) -> int | None:
    if not s or s == "N/A":
        return None
    m = re.search(r"\d{4}", s)
    return int(m.group(0)) if m else None


def _parse_float(s: str | None) -> float | None:
    if not s or s == "N/A":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _parse_date(s: str | None) -> date | None:
    if not s or s == "N/A":
        return None
    try:
        return datetime.strptime(s.strip(), "%d %b %Y").date()
    except ValueError:
        return None


def _parse_runtime(s: str | None) -> int | None:
    if not s or s == "N/A":
        return None
    m = re.search(r"(\d+)\s*min", s, re.IGNORECASE)
    return int(m.group(1)) if m else None


def _is_retryable_error(data: dict) -> bool:
    """True if OMDb error suggests key/quota/rate-limit (worth retrying with fallback)."""
    err = (data.get("Error") or "").lower()
    return any(x in err for x in ("key", "limit", "quota"))


def _fetch_with_key(imdb_title_id: str, apikey: str) -> tuple[TitleMetadataResult | None, dict | None]:
    """Fetch from OMDb with given key. Returns (result, raw_data) or (None, data) on error."""
    url = "https://www.omdbapi.com/"
    params = {"apikey": apikey, "i": imdb_title_id.strip()}
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except (httpx.HTTPError, ValueError):
        return None, None

    if data.get("Response") == "False" or "Error" in data:
        return None, data

    year = _parse_year(data.get("Year"))
    result = TitleMetadataResult(
        imdb_title_id=data.get("imdbID") or imdb_title_id,
        title=data.get("Title") or None,
        title_type=data.get("Type") or None,
        year=year,
        genres=data.get("Genre") or None,
        languages=data.get("Language") or None,
        country=data.get("Country") or None,
        runtime_mins=_parse_runtime(data.get("Runtime")),
        release_date=_parse_date(data.get("Released")),
        directors=data.get("Director") or None,
        imdb_rating=_parse_float(data.get("imdbRating")),
        num_votes=_parse_int(data.get("imdbVotes")),
        url=f"https://www.imdb.com/title/{data.get('imdbID', imdb_title_id)}/" if data.get("imdbID") else None,
    )
    return result, None


def fetch_title_metadata(imdb_title_id: str) -> TitleMetadataResult | None:
    """Fetch title metadata from OMDb by IMDb ID.

    Uses OMDB_API_KEY first; on key/quota/rate-limit error, retries once with
    OMDB_API_KEY_FALLBACK if set.
    """
    result, _ = fetch_title_metadata_with_error(imdb_title_id)
    return result


def fetch_title_metadata_with_error(
    imdb_title_id: str,
) -> tuple[TitleMetadataResult | None, str | None]:
    """Fetch title metadata. Returns (result, error_msg). error_msg is set when result is None."""
    if not settings.OMDB_API_KEY:
        return None, "OMDB_API_KEY not set"

    result, err_data = _fetch_with_key(imdb_title_id, settings.OMDB_API_KEY)
    if result is not None:
        return result, None
    last_error = (err_data or {}).get("Error", "Request failed")

    if err_data and _is_retryable_error(err_data) and settings.OMDB_API_KEY_FALLBACK:
        result, err_data2 = _fetch_with_key(imdb_title_id, settings.OMDB_API_KEY_FALLBACK)
        if result is not None:
            return result, None
        last_error = (err_data2 or {}).get("Error", last_error)

    return None, last_error
