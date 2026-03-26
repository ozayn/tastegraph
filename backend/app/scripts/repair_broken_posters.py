"""Find titles with broken (404) poster URLs and re-fetch from OMDb.

Also picks up titles with NULL/empty posters.
Uses concurrent HEAD requests for fast checking, then re-enriches broken ones sequentially via OMDb.

Usage:
    python -m app.scripts.repair_broken_posters          # check + fix (default batch of 50 broken)
    python -m app.scripts.repair_broken_posters --dry-run # check only, don't re-fetch
    python -m app.scripts.repair_broken_posters --limit 100
"""

import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

from sqlalchemy import or_

from app.core.database import SessionLocal
from app.models.title_metadata import TitleMetadata
from app.scripts.enrich_one_title import upsert_metadata_result
from app.services.omdb import fetch_title_metadata, is_global_omdb_unavailable, fetch_title_metadata_with_error

_CHECK_TIMEOUT = 5
_CHECK_THREADS = 20
_OMDB_DELAY = 1.0


def _is_url_broken(url: str) -> bool:
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
        resp = urllib.request.urlopen(req, timeout=_CHECK_TIMEOUT)
        return resp.status != 200
    except Exception:
        return True


def _find_broken(rows: list[tuple[str, str, str | None]]) -> list[tuple[str, str]]:
    """Check poster URLs concurrently. Returns [(imdb_id, title), ...] for broken ones."""
    has_url = [(iid, title, url) for iid, title, url in rows if url]
    null_poster = [(iid, title) for iid, title, url in rows if not url]

    broken = list(null_poster)
    if not has_url:
        return broken

    print(f"Checking {len(has_url)} poster URLs ({_CHECK_THREADS} threads)...")
    with ThreadPoolExecutor(max_workers=_CHECK_THREADS) as pool:
        futures = {pool.submit(_is_url_broken, url): (iid, title) for iid, title, url in has_url}
        done = 0
        for future in as_completed(futures):
            done += 1
            if done % 500 == 0:
                print(f"  checked {done}/{len(has_url)}...")
            if future.result():
                broken.append(futures[future])
    return broken


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    limit = 50
    for i, arg in enumerate(sys.argv[1:], 1):
        if arg == "--limit" and i < len(sys.argv) - 1:
            limit = int(sys.argv[i + 1])

    db = SessionLocal()
    try:
        rows = db.query(
            TitleMetadata.imdb_title_id,
            TitleMetadata.title,
            TitleMetadata.poster,
        ).all()
    finally:
        db.close()

    print(f"Total titles in metadata: {len(rows)}")
    broken = _find_broken([(iid, title or iid, poster) for iid, title, poster in rows])
    print(f"Broken/missing posters: {len(broken)}")

    if not broken:
        print("All poster URLs are healthy.")
        return

    for iid, title in broken:
        print(f"  {iid} | {title}")

    if dry_run:
        print("\n--dry-run: skipping OMDb re-fetch.")
        return

    to_fix = broken[:limit]
    print(f"\nRe-fetching {len(to_fix)} titles from OMDb...")
    fixed = 0
    failed = 0
    for i, (iid, title) in enumerate(to_fix):
        result, error = fetch_title_metadata_with_error(iid)
        if result is None:
            reason = error or "unknown"
            if is_global_omdb_unavailable(reason):
                print(f"  OMDb unavailable ({reason}). Stopping.")
                break
            print(f"  FAIL {iid} | {title} — {reason}")
            failed += 1
        else:
            new_poster = "yes" if result.poster else "still null"
            db = SessionLocal()
            try:
                upsert_metadata_result(result, db)
            finally:
                db.close()
            print(f"  OK   {iid} | {title} — poster: {new_poster}")
            fixed += 1
        if i < len(to_fix) - 1:
            time.sleep(_OMDB_DELAY)

    print(f"\nDone: fixed={fixed} failed={failed} remaining={len(broken) - len(to_fix)}")


if __name__ == "__main__":
    main()
