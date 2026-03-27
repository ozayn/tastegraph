"""Shared Watchmode ``/v1`` helpers for provider catalog snapshot scripts (BritBox, MUBI, …)."""

from __future__ import annotations

import time

import httpx

from app.core.config import settings

WATCHMODE_V1 = "https://api.watchmode.com/v1"
DEFAULT_REGIONS = "US"
PAGE_LIMIT_MAX = 250


def normalize_imdb_id(raw: str | None) -> str | None:
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


def watchmode_type_to_object_type(wm_type: str | None) -> str | None:
    if not wm_type:
        return None
    u = str(wm_type).strip().lower()
    if u in ("tv_series", "tv", "tv show", "show"):
        return "SHOW"
    if u in ("movie", "film"):
        return "MOVIE"
    return None


def get_json(client: httpx.Client, path: str, params: dict) -> dict | list:
    url = f"{WATCHMODE_V1}{path}"
    q = {"apiKey": settings.WATCHMODE_API_KEY, **params}
    resp = client.get(url, params=q, timeout=120.0)
    resp.raise_for_status()
    data = resp.json()
    if isinstance(data, dict) and data.get("success") is False:
        raise RuntimeError(data.get("errorMessage") or str(data))
    return data


def load_us_sources(client: httpx.Client) -> list[dict]:
    data = get_json(client, "/sources/", {"regions": DEFAULT_REGIONS})
    if not isinstance(data, list):
        raise RuntimeError(f"Unexpected /sources/ payload type: {type(data)}")
    return data


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
        data = get_json(client, "/list-titles/", params)
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
            imdb_n = normalize_imdb_id(str(imdb_raw).strip() if imdb_raw is not None else None)
            object_type = watchmode_type_to_object_type(row.get("type"))
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

        print(
            f"  Page {page}/{max(total_pages, 1)}: +{len(block_titles)} rows "
            f"(unique imdb: {len(seen_imdb)}, kept: {len(titles_out)})"
        )

        if not block_titles:
            break
        if total_pages and page >= total_pages:
            break
        page += 1
        time.sleep(0.25)

    return titles_out, meta
