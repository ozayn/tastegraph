"""One-time (or occasional) login: save Playwright storage state for IMDb.

**Local developer machine only — not for Railway/production containers** (those
do not install Playwright). See ``docs/imdb-playwright-local-only.md``.

Run **interactively** in a visible browser, sign in to IMDb/Amazon as you normally
would, then press Enter in the terminal. Cookies/local storage are written to a
JSON file used by ``refresh_imdb_exports``.

Keep the output file **private** (gitignored by default). Refresh it if exports
start failing with auth errors.

Usage (local):
  cd backend
  pip install -r requirements-imdb-browser.txt && playwright install chromium
  python -m app.scripts.imdb_playwright_save_storage --output ../data/imdb/.playwright_storage_state.json
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


def main() -> None:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print(
            "Local only — install: pip install -r requirements-imdb-browser.txt && playwright install chromium",
            file=sys.stderr,
        )
        raise SystemExit(1) from None

    p = argparse.ArgumentParser(
        description="[Local only] Save IMDb session for Playwright export refresh"
    )
    p.add_argument(
        "--output",
        "-o",
        type=Path,
        default=Path(__file__).resolve().parent.parent.parent.parent
        / "data"
        / "imdb"
        / ".playwright_storage_state.json",
        help="Where to write storage state JSON",
    )
    args = p.parse_args()
    out: Path = args.output
    out.parent.mkdir(parents=True, exist_ok=True)

    print("Opening Chromium. Log in to IMDb in the window.")
    print("Tip: open Ratings or Watchlist once to confirm the session.")
    print("When finished, return here and press Enter…")

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=False)
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()
        page.goto("https://www.imdb.com/registration/signin", wait_until="domcontentloaded")
        try:
            input()
        except EOFError:
            print("No stdin; use an interactive terminal.", file=sys.stderr)
            browser.close()
            raise SystemExit(1)
        context.storage_state(path=str(out))
        browser.close()

    print(f"Saved storage state to {out}")


if __name__ == "__main__":
    main()
