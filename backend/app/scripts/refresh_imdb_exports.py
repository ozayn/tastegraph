"""Download fresh IMDb export CSVs via Playwright (logged-in browser session).

**Local developer machine only — not for Railway, Docker production, or any host
that only installs ``requirements.txt``.** Use ``refresh_imdb_public_scrape`` for
unattended server refresh. See ``docs/imdb-playwright-local-only.md``.

Uses IMDb’s own **Export** UI (no HTML scraping of title rows). Saves files next
to the existing sync pipeline::

  ratings.csv  watchlist.csv  favorite_list.csv  favorite_people.csv

**Auth:** create storage state once with::

  python -m app.scripts.imdb_playwright_save_storage -o ../data/imdb/.playwright_storage_state.json

Then configure page URLs (env or JSON). Typical pattern::

  IMDB_REFRESH_USER_ID=ur12345678
  IMDB_REFRESH_FAVORITE_LIST_ID=ls021795057

Or set full URLs: ``IMDB_REFRESH_RATINGS_URL``, ``IMDB_REFRESH_WATCHLIST_URL``,
``IMDB_REFRESH_FAVORITE_LIST_URL``, ``IMDB_REFRESH_FAVORITE_PEOPLE_URL``.

**After a local run:** copy CSVs or run ``cron_sync_imdb`` where those files live.

Usage (local):
  cd backend && pip install -r requirements-imdb-browser.txt && playwright install chromium
  python -m app.scripts.refresh_imdb_exports
  python -m app.scripts.refresh_imdb_exports --headed --only ratings
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
from pathlib import Path
from typing import Any

_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
_REPO_ROOT = _BACKEND_ROOT.parent
_DEFAULT_OUTPUT_DIR = _REPO_ROOT / "data" / "imdb"
_DEFAULT_STATE = _DEFAULT_OUTPUT_DIR / ".playwright_storage_state.json"

_OUTPUT_NAMES = {
    "ratings": "ratings.csv",
    "watchlist": "watchlist.csv",
    "favorite_list": "favorite_list.csv",
    "favorite_people": "favorite_people.csv",
}

_ENV_URL_KEYS = {
    "ratings": "IMDB_REFRESH_RATINGS_URL",
    "watchlist": "IMDB_REFRESH_WATCHLIST_URL",
    "favorite_list": "IMDB_REFRESH_FAVORITE_LIST_URL",
    "favorite_people": "IMDB_REFRESH_FAVORITE_PEOPLE_URL",
}

_LOG = logging.getLogger(__name__)


def _urls_from_user_id(user_id: str, list_id: str | None) -> dict[str, str]:
    uid = user_id.strip()
    if not uid.startswith("ur"):
        uid = f"ur{uid}"
    base = f"https://www.imdb.com/user/{uid}"
    out = {
        "ratings": f"{base}/ratings/",
        "watchlist": f"{base}/watchlist/",
        "favorite_people": f"{base}/favoritepeople/",
    }
    if list_id and list_id.strip():
        lid = list_id.strip()
        if not lid.startswith("ls"):
            lid = f"ls{lid}"
        out["favorite_list"] = f"https://www.imdb.com/list/{lid}/"
    return out


def _load_config(path: Path | None) -> dict[str, Any]:
    if path is None or not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, OSError) as e:
        _LOG.warning("Could not read config %s: %s", path, e)
        return {}


def _resolve_urls(config: dict[str, Any]) -> dict[str, str]:
    """Merge: config file ``exports`` < env full URLs < env USER_ID + LIST_ID."""
    urls: dict[str, str] = {}
    exports = config.get("exports")
    if isinstance(exports, dict):
        for k, v in exports.items():
            if k in _OUTPUT_NAMES and isinstance(v, str) and v.strip():
                urls[k] = v.strip()

    for key, envk in _ENV_URL_KEYS.items():
        v = os.environ.get(envk, "").strip()
        if v:
            urls[key] = v

    user_id = os.environ.get("IMDB_REFRESH_USER_ID", "").strip() or (
        str(config.get("user_id", "")).strip() if config.get("user_id") else ""
    )
    list_id = os.environ.get("IMDB_REFRESH_FAVORITE_LIST_ID", "").strip() or (
        str(config.get("favorite_list_id", "")).strip()
        if config.get("favorite_list_id")
        else ""
    )
    if user_id:
        built = _urls_from_user_id(user_id, list_id or None)
        for k, v in built.items():
            urls.setdefault(k, v)

    return urls


def _dismiss_cookie_banner(page) -> None:
    for sel in (
        "#onetrust-accept-btn-handler",
        "button:has-text(\"Accept\")",
        "button[aria-label=\"Accept\"]",
    ):
        try:
            loc = page.locator(sel).first
            if loc.count() > 0 and loc.is_visible(timeout=1500):
                loc.click()
                page.wait_for_timeout(500)
                return
        except Exception:
            continue


def _trigger_export_download(page, output: Path, label: str) -> None:
    """Click IMDb’s Export UI and save the CSV. Raises on failure."""
    from playwright.sync_api import TimeoutError as PlaywrightTimeout

    _dismiss_cookie_banner(page)
    try:
        page.wait_for_load_state("networkidle", timeout=45_000)
    except PlaywrightTimeout:
        page.wait_for_load_state("domcontentloaded", timeout=10_000)

    export_getters = [
        lambda: page.get_by_role("button", name=re.compile(r"export", re.I)),
        lambda: page.get_by_role("link", name=re.compile(r"export", re.I)),
        lambda: page.locator("button, a").filter(
            has_text=re.compile(r"^\s*export\s*$", re.I)
        ),
    ]

    last_err: Exception | None = None
    for get_loc in export_getters:
        try:
            loc = get_loc()
            if loc.count() == 0:
                continue
            el = loc.first
            el.wait_for(state="visible", timeout=4000)
        except PlaywrightTimeout:
            continue
        except Exception as e:
            last_err = e
            continue

        try:
            with page.expect_download(timeout=120_000) as dl_info:
                el.click()
                try:
                    csv_item = page.get_by_text(re.compile(r"^\s*csv\s*$", re.I)).first
                    csv_item.wait_for(state="visible", timeout=2500)
                    csv_item.click()
                except PlaywrightTimeout:
                    pass
            download = dl_info.value
            suggested = download.suggested_filename
            if suggested and not suggested.lower().endswith(".csv"):
                _LOG.warning(
                    "%s: download suggests %r (expected .csv); saving anyway",
                    label,
                    suggested,
                )
            download.save_as(str(output))
            _LOG.info("%s: saved %s", label, output)
            return
        except Exception as e:
            last_err = e
            _LOG.debug("%s: export attempt failed: %s", label, e)
            continue

    raise RuntimeError(
        f"{label}: could not trigger an Export download. "
        f"Open the URL in a browser, confirm an Export button exists, "
        f"or try --headed. Last error: {last_err}"
    )


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)s %(message)s",
    )

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print(
            "Local only: pip install -r requirements-imdb-browser.txt && playwright install chromium",
            file=sys.stderr,
        )
        raise SystemExit(1) from None

    p = argparse.ArgumentParser(
        description="[Local only] Refresh IMDb export CSVs via Playwright (not for Railway)"
    )
    p.add_argument(
        "--output-dir",
        type=Path,
        default=_DEFAULT_OUTPUT_DIR,
        help="Directory for ratings.csv, watchlist.csv, …",
    )
    p.add_argument(
        "--storage-state",
        type=Path,
        default=Path(os.environ.get("IMDB_REFRESH_STORAGE_STATE", str(_DEFAULT_STATE))),
        help="Playwright storage state JSON (from imdb_playwright_save_storage)",
    )
    p.add_argument("--config", type=Path, default=None, help="Optional JSON config")
    p.add_argument("--headed", action="store_true", help="Show browser (debug)")
    p.add_argument(
        "--continue-on-error",
        action="store_true",
        help="Download remaining exports if one fails",
    )
    p.add_argument(
        "--only",
        action="append",
        choices=list(_OUTPUT_NAMES.keys()),
        help="Restrict to one or more sources (repeatable)",
    )
    args = p.parse_args()

    cfg = _load_config(args.config)
    state_path: Path = args.storage_state
    if not state_path.exists():
        print(
            f"Missing storage state: {state_path}\n"
            "Create it with:\n"
            f"  python -m app.scripts.imdb_playwright_save_storage -o {state_path}",
            file=sys.stderr,
        )
        raise SystemExit(1)

    urls = _resolve_urls(cfg)
    if args.only:
        urls = {k: v for k, v in urls.items() if k in args.only}
    if not urls:
        print(
            "No URLs configured. Set IMDB_REFRESH_USER_ID (and optionally "
            "IMDB_REFRESH_FAVORITE_LIST_ID) or IMDB_REFRESH_*_URL env vars, "
            "or pass --config with an \"exports\" object.",
            file=sys.stderr,
        )
        raise SystemExit(1)

    out_dir: Path = args.output_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    order = ["ratings", "watchlist", "favorite_list", "favorite_people"]
    to_run = [k for k in order if k in urls]

    failed = False
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=not args.headed)
        context = browser.new_context(
            storage_state=str(state_path),
            accept_downloads=True,
        )
        page = context.new_page()
        try:
            for key in to_run:
                url = urls[key]
                target = out_dir / _OUTPUT_NAMES[key]
                _LOG.info("Fetching %s from %s", key, url)
                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=90_000)
                    _trigger_export_download(page, target, key)
                except Exception as e:
                    _LOG.error("%s: %s", key, e)
                    failed = True
                    if not args.continue_on_error:
                        raise
        finally:
            browser.close()

    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
