"""Fetch BritBox US catalog from Watchmode into ``data/britbox/catalog.json``.

Uses Watchmode ``/v1/sources`` + ``/v1/list-titles`` with ``source_ids`` and ``regions=US``.
Output rows match what :mod:`app.services.provider_catalog` expects: ``imdb_id``, ``title``,
``year``, ``object_type`` (``SHOW`` / ``MOVIE``), optional ``genres`` / ``poster_url``.

The old JustWatch GraphQL path is **deprecated** (see ``fetch_britbox_catalog_justwatch_deprecated.py``).

Usage:
    cd backend && python -m app.scripts.fetch_britbox_catalog

Options:
    --list-sources     Print BritBox-related Watchmode US sources and exit
    --source-id ID     Override Watchmode source id for this run (e.g. 376 or 377)
    --limit N          Page size for list-titles (max 250, default 250)

Environment (``backend/.env``):
    WATCHMODE_API_KEY           Required
    WATCHMODE_BRITBOX_SOURCE_ID Optional; default picks **Britbox (Via Amazon Prime)** in US
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

from app.core.config import settings

WATCHMODE_V1 = "https://api.watchmode.com/v1"
DEFAULT_REGIONS = "US"
PAGE_LIMIT_MAX = 250

# Prefer Amazon Prime channel for typical US access; standalone Britbox app is the fallback.
SOURCE_NAME_AMAZON_HINTS = ("amazon", "prime")

CATALOG_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "britbox"
CATALOG_PATH = CATALOG_DIR / "catalog.json"


def _normalize_imdb_id(raw: str | None) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s or s.upper() in ("N/A", "NULL", "NONE"):
        return None
    if len(s) >= 3 and s[:2].lower() == "tt" and s[2:].isdigit():
        return "tt" + s[2:]
    if s.isdigit():
        return f"tt{s}"
    return None


def _watchmode_type_to_object_type(wm_type: str | None) -> str | None:
    if not wm_type:
        return None
    u = str(wm_type).strip().lower()
    if u in ("tv_series", "tv", "tv show", "show"):
        return "SHOW"
    if u in ("movie", "film"):
        return "MOVIE"
    return None


def _get_json(client: httpx.Client, path: str, params: dict) -> dict | list:
    url = f"{WATCHMODE_V1}{path}"
    q = {"apiKey": settings.WATCHMODE_API_KEY, **params}
    resp = client.get(url, params=q, timeout=120.0)
    resp.raise_for_status()
    data = resp.json()
    if isinstance(data, dict) and data.get("success") is False:
        raise RuntimeError(data.get("errorMessage") or str(data))
    return data


def load_us_sources(client: httpx.Client) -> list[dict]:
    data = _get_json(client, "/sources/", {"regions": DEFAULT_REGIONS})
    if not isinstance(data, list):
        raise RuntimeError(f"Unexpected /sources/ payload type: {type(data)}")
    return data


def list_britbox_sources(sources: list[dict]) -> list[dict]:
    out = []
    for s in sources:
        name = (s.get("name") or "").lower()
        if "britbox" in name or "brit box" in name:
            out.append(s)
    return sorted(out, key=lambda x: (x.get("name") or ""))


def resolve_britbox_source(
    sources: list[dict],
    *,
    override_id: int | None,
) -> dict:
    if override_id is not None:
        for s in sources:
            if int(s.get("id") or -1) == override_id:
                return s
        raise RuntimeError(f"No Watchmode US source with id={override_id}")

    env_id = (settings.WATCHMODE_BRITBOX_SOURCE_ID or "").strip()
    if env_id:
        return resolve_britbox_source(sources, override_id=int(env_id))

    brit = list_britbox_sources(sources)
    if not brit:
        raise RuntimeError("No BritBox-related sources found in Watchmode /sources/ for US.")

    def _is_amazon_channel(s: dict) -> bool:
        n = (s.get("name") or "").lower()
        return all(h in n for h in SOURCE_NAME_AMAZON_HINTS)

    for s in brit:
        if _is_amazon_channel(s):
            return s
    # Fallback: standalone "Britbox" subscription app
    for s in brit:
        if (s.get("name") or "").strip().lower() == "britbox":
            return s
    return brit[0]


def fetch_all_titles(
    client: httpx.Client,
    *,
    source_id: int,
    page_limit: int,
) -> tuple[list[dict], dict]:
    page_limit = min(max(1, page_limit), PAGE_LIMIT_MAX)
    titles_out: list[dict] = []
    seen_imdb: set[str] = set()
    seen_wm: set[int] = set()
    page = 1
    meta: dict = {}

    while True:
        params: dict = {
            "source_ids": source_id,
            "regions": DEFAULT_REGIONS,
            "limit": page_limit,
            "page": page,
        }
        data = _get_json(client, "/list-titles/", params)
        if not isinstance(data, dict):
            raise RuntimeError(f"Unexpected /list-titles/ payload: {type(data)}")

        block_titles = data.get("titles") or []
        total_results = int(data.get("total_results") or 0)
        total_pages = int(data.get("total_pages") or 0)
        meta = {
            "total_results": total_results,
            "total_pages": total_pages,
            "page_limit": page_limit,
        }

        if page == 1 and total_results <= 0:
            break

        for row in block_titles:
            if not isinstance(row, dict):
                continue
            wm_id = row.get("id")
            if isinstance(wm_id, int) and wm_id in seen_wm:
                continue
            if isinstance(wm_id, int):
                seen_wm.add(wm_id)
            imdb_raw = row.get("imdb_id")
            imdb_n = _normalize_imdb_id(str(imdb_raw).strip() if imdb_raw is not None else None)
            object_type = _watchmode_type_to_object_type(row.get("type"))
            if not object_type:
                continue
            entry = {
                "watchmode_id": wm_id,
                "imdb_id": imdb_n,
                "title": row.get("title"),
                "year": row.get("year"),
                "object_type": object_type,
                "genres": [],
                "poster_url": None,
            }
            if imdb_n and imdb_n in seen_imdb:
                continue
            if imdb_n:
                seen_imdb.add(imdb_n)
            titles_out.append(entry)

        print(f"  Page {page}/{max(total_pages, 1)}: +{len(block_titles)} rows (unique imdb: {len(seen_imdb)}, kept: {len(titles_out)})")

        if not block_titles:
            break
        if total_pages and page >= total_pages:
            break
        page += 1
        time.sleep(0.25)

    return titles_out, meta


def validate_snapshot(source: dict, titles: list[dict], list_meta: dict) -> None:
    name = (source.get("name") or "").lower()
    if "britbox" not in name:
        raise RuntimeError(f"Refusing to save: source name {source.get('name')!r} does not look like BritBox.")

    total_results = int(list_meta.get("total_results") or 0)
    if total_results <= 0:
        raise RuntimeError("Watchmode returned total_results=0; not writing catalog.")

    if total_results > 50_000:
        raise RuntimeError(f"Suspicious total_results={total_results}; aborting.")

    with_imdb = [t for t in titles if t.get("imdb_id")]
    if len(titles) == 0:
        raise RuntimeError("No titles parsed from Watchmode response; not writing catalog.")
    ratio = len(with_imdb) / len(titles)
    if ratio < 0.4:
        raise RuntimeError(
            f"Too few rows have imdb_id ({len(with_imdb)}/{len(titles)}={ratio:.0%}); "
            f"refusing to write a weak snapshot."
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch BritBox US catalog from Watchmode")
    parser.add_argument(
        "--list-sources",
        action="store_true",
        help="List BritBox-related US sources and exit",
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
    headers = {"User-Agent": "TasteGraph/0.1 (britbox-catalog)"}

    with httpx.Client(headers=headers) as client:
        sources = load_us_sources(client)

        if args.list_sources:
            print(f"Watchmode {WATCHMODE_V1}  regions={DEFAULT_REGIONS}\n")
            for s in list_britbox_sources(sources):
                print(f"  id={s.get('id')}  name={s.get('name')!r}  type={s.get('type')}")
            return

        print(
            f"Watchmode: {WATCHMODE_V1}\n"
            f"  regions={DEFAULT_REGIONS}\n"
            f"  endpoints: GET /sources/  GET /list-titles/\n"
        )
        src = resolve_britbox_source(sources, override_id=args.source_id)
        print(
            f"Using source id={src.get('id')} name={src.get('name')!r} type={src.get('type')!r}\n"
            f"Fetching all pages (limit={min(args.limit, PAGE_LIMIT_MAX)} per page)..."
        )

        titles, list_meta = fetch_all_titles(
            client, source_id=int(src["id"]), page_limit=args.limit
        )

        try:
            validate_snapshot(src, titles, list_meta)
        except RuntimeError as e:
            print(f"\nFETCH ABORTED: {e}\nCatalog file not updated.", file=sys.stderr)
            sys.exit(1)

    with_imdb = [t for t in titles if t.get("imdb_id")]
    movies = [t for t in titles if t.get("object_type") == "MOVIE"]
    shows = [t for t in titles if t.get("object_type") == "SHOW"]

    catalog = {
        "provider": "britbox-us",
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
