"""Fetch metadata for a single title from OMDb."""

import json
import sys

from app.services.omdb import fetch_title_metadata


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python -m app.scripts.fetch_one_metadata tt1234567")
        raise SystemExit(1)

    imdb_id = sys.argv[1]
    result = fetch_title_metadata(imdb_id)

    if result is None:
        print("Not found or invalid response")
        raise SystemExit(1)

    out = {
        "imdb_title_id": result.imdb_title_id,
        "title": result.title,
        "title_type": result.title_type,
        "year": result.year,
        "genres": result.genres,
        "runtime_mins": result.runtime_mins,
        "release_date": str(result.release_date) if result.release_date else None,
        "directors": result.directors,
        "imdb_rating": result.imdb_rating,
        "num_votes": result.num_votes,
        "url": result.url,
    }
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
