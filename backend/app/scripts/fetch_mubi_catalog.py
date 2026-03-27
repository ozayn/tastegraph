"""Fetch MUBI US catalog from Watchmode into ``data/mubi/catalog.json``.

Same snapshot shape as BritBox (``provider_catalog.load_catalog``). Watchmode US lists a
standalone subscription source **MUBI** (typically ``source_id=181``, ``type=sub``).

After fetching, backfill ``TitleMetadata`` for snapshot IDs with
``python -m app.scripts.mubi_catalog_metadata --enrich`` (OMDb).

Usage:
    cd backend && python -m app.scripts.fetch_mubi_catalog
    cd backend && python -m app.scripts.fetch_mubi_catalog --list-sources

Options:
    --list-sources     Print MUBI-related Watchmode US sources and exit
    --source-id ID     Override Watchmode source id for this run
    --limit N          Page size for list-titles (max 250, default 250)

Environment (``backend/.env``):
    WATCHMODE_API_KEY          Required
    WATCHMODE_MUBI_SOURCE_ID   Optional; default resolves **MUBI** subscription source
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx

from app.core.config import settings
from app.services.watchmode_catalog_fetchlib import (
    DEFAULT_REGIONS,
    PAGE_LIMIT_MAX,
    WATCHMODE_V1,
    fetch_all_titles,
    load_us_sources,
)

CATALOG_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "mubi"
CATALOG_PATH = CATALOG_DIR / "catalog.json"

# MUBI’s rotating catalog is small; refuse writes that look like a bad scrape.
_MUBI_MIN_TITLES = 25


def list_mubi_sources(sources: list[dict]) -> list[dict]:
    out = []
    for s in sources:
        name = (s.get("name") or "").lower()
        if "mubi" in name:
            out.append(s)
    return sorted(out, key=lambda x: (x.get("name") or ""))


def resolve_mubi_source(sources: list[dict], *, override_id: int | None) -> dict:
    if override_id is not None:
        for s in sources:
            if int(s.get("id") or -1) == override_id:
                return s
        raise RuntimeError(f"No Watchmode US source with id={override_id}")

    env_id = (settings.WATCHMODE_MUBI_SOURCE_ID or "").strip()
    if env_id:
        return resolve_mubi_source(sources, override_id=int(env_id))

    candidates = list_mubi_sources(sources)
    if not candidates:
        raise RuntimeError("No MUBI-related sources found in Watchmode /sources/ for US.")

    for s in candidates:
        if (s.get("name") or "").strip().lower() == "mubi":
            return s
    return candidates[0]


def validate_mubi_snapshot(source: dict, titles: list[dict], list_meta: dict) -> None:
    name = (source.get("name") or "").lower()
    if "mubi" not in name:
        raise RuntimeError(f"Refusing to save: source name {source.get('name')!r} does not look like MUBI.")

    total_results = int(list_meta.get("total_results") or 0)
    if total_results <= 0:
        raise RuntimeError("Watchmode returned total_results=0; not writing catalog.")

    if total_results > 50_000:
        raise RuntimeError(f"Suspicious total_results={total_results}; aborting.")

    if len(titles) == 0:
        raise RuntimeError("No titles parsed from Watchmode response; not writing catalog.")

    if len(titles) < _MUBI_MIN_TITLES:
        raise RuntimeError(
            f"Only {len(titles)} titles parsed (minimum {_MUBI_MIN_TITLES}); "
            "refusing to save an obviously incomplete snapshot."
        )

    with_imdb = [t for t in titles if t.get("imdb_id")]
    ratio = len(with_imdb) / len(titles)
    if ratio < 0.4:
        raise RuntimeError(
            f"Too few rows have imdb_id ({len(with_imdb)}/{len(titles)}={ratio:.0%}); "
            "refusing to write a weak snapshot."
        )

    print(
        f"\nValidation: source id={source.get('id')} name={source.get('name')!r}\n"
        f"  Watchmode total_results (reported): {total_results}\n"
        f"  Parsed titles: {len(titles)} (movies: {sum(1 for t in titles if t.get('object_type') == 'MOVIE')}, "
        f"shows: {sum(1 for t in titles if t.get('object_type') == 'SHOW')})\n"
        f"  With IMDb id: {len(with_imdb)} ({ratio:.0%})"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch MUBI US catalog from Watchmode")
    parser.add_argument(
        "--list-sources",
        action="store_true",
        help="List MUBI-related US sources and exit",
    )
    parser.add_argument("--source-id", type=int, default=None, help="Watchmode source id override")
    parser.add_argument(
        "--limit",
        type=int,
        default=PAGE_LIMIT_MAX,
        help=f"Page size (max {PAGE_LIMIT_MAX})",
    )
    args = parser.parse_args()

    if not (settings.WATCHMODE_API_KEY or "").strip():
        print("ERROR: WATCHMODE_API_KEY is missing. Set it in backend/.env", file=sys.stderr)
        sys.exit(1)

    CATALOG_DIR.mkdir(parents=True, exist_ok=True)
    headers = {"User-Agent": "TasteGraph/0.1 (mubi-catalog)"}

    with httpx.Client(headers=headers) as client:
        sources = load_us_sources(client)

        if args.list_sources:
            print(f"Watchmode {WATCHMODE_V1}  regions={DEFAULT_REGIONS}\n")
            for s in list_mubi_sources(sources):
                print(f"  id={s.get('id')}  name={s.get('name')!r}  type={s.get('type')}")
            return

        print(
            f"Watchmode: {WATCHMODE_V1}\n"
            f"  regions={DEFAULT_REGIONS}\n"
            f"  endpoints: GET /sources/  GET /list-titles/\n"
        )
        src = resolve_mubi_source(sources, override_id=args.source_id)
        print(
            f"Using source id={src.get('id')} name={src.get('name')!r} type={src.get('type')!r}\n"
            f"Fetching all pages (limit={min(args.limit, PAGE_LIMIT_MAX)} per page)..."
        )

        titles, list_meta = fetch_all_titles(
            client, source_id=int(src["id"]), page_limit=args.limit
        )

        try:
            validate_mubi_snapshot(src, titles, list_meta)
        except RuntimeError as e:
            print(f"\nFETCH ABORTED: {e}\nCatalog file not updated.", file=sys.stderr)
            sys.exit(1)

    with_imdb = [t for t in titles if t.get("imdb_id")]
    movies = [t for t in titles if t.get("object_type") == "MOVIE"]
    shows = [t for t in titles if t.get("object_type") == "SHOW"]

    catalog = {
        "provider": "mubi-us",
        "provider_clear_name": (src.get("name") or "").strip(),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "source": "watchmode",
        "watchmode": {
            "api_base": WATCHMODE_V1,
            "source_id": src.get("id"),
            "source_name": (src.get("name") or "").strip(),
            "source_type": src.get("type"),
            "regions": DEFAULT_REGIONS,
            "list_titles": {
                "total_results_reported": list_meta.get("total_results"),
                "total_pages_reported": list_meta.get("total_pages"),
                "page_limit": list_meta.get("page_limit"),
            },
        },
        "stats": {
            "total": len(titles),
            "with_imdb_id": len(with_imdb),
            "without_imdb_id": len(titles) - len(with_imdb),
            "movies": len(movies),
            "shows": len(shows),
        },
        "titles": titles,
    }

    CATALOG_PATH.write_text(json.dumps(catalog, indent=2, ensure_ascii=False))
    print(f"\nSaved {len(titles)} titles to {CATALOG_PATH}")
    print(f"  Movies: {len(movies)}, Shows: {len(shows)}")
    print(f"  With IMDb ID: {len(with_imdb)}, Without: {len(titles) - len(with_imdb)}")


if __name__ == "__main__":
    main()
