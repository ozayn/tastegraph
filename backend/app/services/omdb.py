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
    actors: str | None
    writer: str | None
    plot: str | None
    poster: str | None
    metascore: int | None
    awards: str | None
    rated: str | None
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
    return any(x in err for x in ("key", "limit", "quota", "401"))


def is_global_omdb_unavailable(error_msg: str | None) -> bool:
    """True if error indicates OMDb is globally unavailable (auth/key/quota). Do not record as title-specific."""
    if not error_msg:
        return False
    err = error_msg.lower()
    return any(
        x in err
        for x in (
            "omdb_api_key not set",
            "http 401",
            "http 403",
            "invalid api key",
            "invalid key",
            "quota",
            "limit exceeded",
            "query limit",
        )
    )


def _fetch_with_key(imdb_title_id: str, apikey: str) -> tuple[TitleMetadataResult | None, dict | None]:
    """Fetch from OMDb with given key. Returns (result, raw_data) or (None, {"Error": msg}) on error."""
    url = "https://www.omdbapi.com/"
    params = {"apikey": apikey, "i": imdb_title_id.strip()}
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as e:
        return None, {"Error": f"HTTP {e.response.status_code}"}
    except httpx.TimeoutException:
        return None, {"Error": "timeout"}
    except httpx.ConnectError:
        return None, {"Error": "connection error"}
    except httpx.HTTPError:
        return None, {"Error": "request failed"}
    except ValueError:
        return None, {"Error": "invalid JSON"}

    if data.get("Response") == "False" or "Error" in data:
        return None, data

    year = _parse_year(data.get("Year"))
    metascore = _parse_int(data.get("Metascore"))
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
        actors=data.get("Actors") or None,
        writer=data.get("Writer") or None,
        plot=data.get("Plot") or None,
        poster=data.get("Poster") if data.get("Poster") and data.get("Poster") != "N/A" else None,
        metascore=metascore,
        awards=data.get("Awards") or None,
        rated=data.get("Rated") if data.get("Rated") and data.get("Rated") != "N/A" else None,
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
    last_error = (err_data or {}).get("Error", "request failed")

    if err_data and _is_retryable_error(err_data) and settings.OMDB_API_KEY_FALLBACK:
        result, err_data2 = _fetch_with_key(imdb_title_id, settings.OMDB_API_KEY_FALLBACK)
        if result is not None:
            return result, None
        err2 = (err_data2 or {}).get("Error", last_error)
        last_error = f"{err2} (fallback key attempted)"
    elif err_data and _is_retryable_error(err_data) and not settings.OMDB_API_KEY_FALLBACK:
        last_error = f"{last_error} (no fallback key set)"

    return None, last_error
