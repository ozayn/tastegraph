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


def fetch_title_metadata(imdb_title_id: str) -> TitleMetadataResult | None:
    """Fetch title metadata from OMDb by IMDb ID.

    Input: imdb_title_id (e.g. tt1234567)
    Output: TitleMetadataResult or None if not found / invalid response.
    """
    if not settings.OMDB_API_KEY:
        return None

    url = "https://www.omdbapi.com/"
    params = {"apikey": settings.OMDB_API_KEY, "i": imdb_title_id.strip()}

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except (httpx.HTTPError, ValueError):
        return None

    if data.get("Response") == "False" or "Error" in data:
        return None

    year = _parse_year(data.get("Year"))
    return TitleMetadataResult(
        imdb_title_id=data.get("imdbID") or imdb_title_id,
        title=data.get("Title") or None,
        title_type=data.get("Type") or None,
        year=year,
        genres=data.get("Genre") or None,
        runtime_mins=_parse_runtime(data.get("Runtime")),
        release_date=_parse_date(data.get("Released")),
        directors=data.get("Director") or None,
        imdb_rating=_parse_float(data.get("imdbRating")),
        num_votes=_parse_int(data.get("imdbVotes")),
        url=f"https://www.imdb.com/title/{data.get('imdbID', imdb_title_id)}/" if data.get("imdbID") else None,
    )
