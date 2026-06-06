#!/usr/bin/env python3
"""EXPERIMENTAL / best-effort: fetch public IMDb pages, write defensive CSVs under data/imdb/.

**Not the supported production refresh path.** IMDb often blocks automated HTTP
(``202`` + empty body); validation then refuses to overwrite CSVs. For real source
refresh use manual Export or local ``refresh_imdb_exports`` (Playwright); Railway
should only run ``cron_sync_imdb`` downstream. See ``docs/imdb-export-sync.md``.

Does **not** touch the database. If scrape succeeds, run ``cron_sync_imdb`` to mirror-import.

Environment (URLs — omit to skip that source; set in ``backend/.env`` or the process env; defined on ``app.core.config.Settings``):

- ``IMDB_SCRAPE_LIST_URL`` → ``favorite_list.csv``
- ``IMDB_SCRAPE_WATCHLIST_URL`` → ``watchlist.csv``
- ``IMDB_SCRAPE_RATINGS_URL`` → ``ratings.csv`` (only if a rating is parsed for every title)
- ``IMDB_SCRAPE_FAVORITE_PEOPLE_URL`` → ``favorite_people.csv``

Optional:

- ``IMDB_SCRAPE_MIN_FAVORITE_LIST``, ``IMDB_SCRAPE_MIN_WATCHLIST``, ``IMDB_SCRAPE_MIN_RATINGS``,
  ``IMDB_SCRAPE_MIN_FAVORITE_PEOPLE`` — absolute minimum row counts (default 1 each).
- ``IMDB_SCRAPE_MIN_DROP_RATIO`` — reject when ``new_count < max(min, int(prev * ratio))`` (default 0.5).
- ``IMDB_SCRAPE_PREV_MIN_FOR_RATIO`` — only apply ratio if previous count ≥ this (default 1).
- ``IMDB_SCRAPE_USER_AGENT`` — override default browser UA.

Exit code **1** if any configured source errors (fetch, validation, parse). Skipped sources
(no URL) do not count as errors.

See ``app.services.imdb_public_refresh`` module docstring for limitations.
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from app.services.imdb_public_refresh import RefreshConfig, run_public_refresh

_LOG = logging.getLogger(__name__)


_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent


def _default_output_dir() -> Path:
    # Match ``imdb_sync_cron_lib.default_data_dir()`` (repo ``data/imdb`` next to ``backend/``).
    return _BACKEND_ROOT.parent / "data" / "imdb"


def _default_state_path() -> Path:
    return _default_output_dir() / ".scrape_refresh_state.json"


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    p = argparse.ArgumentParser(description="Refresh IMDb CSVs from public pages (defensive).")
    p.add_argument(
        "--data-dir",
        type=Path,
        default=_default_output_dir(),
        help="Directory for ratings.csv, watchlist.csv, etc.",
    )
    p.add_argument(
        "--state-file",
        type=Path,
        default=_default_state_path(),
        help="JSON file with last accepted counts per source",
    )
    args = p.parse_args()

    cfg = RefreshConfig.from_env(output_dir=args.data_dir.resolve(), state_path=args.state_file.resolve())
    summary = run_public_refresh(cfg)

    for line in summary.get("skipped", []):
        _LOG.info("skip: %s", line)
    for line in summary.get("written", []):
        _LOG.info("wrote: %s", line)
    for line in summary.get("errors", []):
        _LOG.error("error: %s", line)

    configured = sum(
        1
        for u in (
            cfg.list_url,
            cfg.watchlist_url,
            cfg.ratings_url,
            cfg.favorite_people_url,
        )
        if u
    )
    errs = summary.get("errors", [])
    if configured == 0:
        _LOG.warning("no IMDB_SCRAPE_*_URL set; nothing to do")
        return 0
    if errs:
        _LOG.error(
            "imdb public scrape finished with %d error(s); CSVs unchanged for failed sources",
            len(errs),
        )
        return 1
    _LOG.info("imdb public scrape ok; state %s", summary.get("state_path"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
