"""OMDb title fetch by imdb_title_id.

Stub for future OMDb API integration. No HTTP requests yet.
"""

from dataclasses import dataclass
from datetime import date


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


def fetch_title_metadata(imdb_title_id: str) -> TitleMetadataResult | None:
    """Fetch title metadata from OMDb by IMDb ID.

    Input: imdb_title_id (e.g. tt1234567)
    Output: TitleMetadataResult or None if not found.

    Not implemented yet. Raises NotImplementedError.
    """
    raise NotImplementedError("OMDb fetch not implemented; no HTTP requests yet")
