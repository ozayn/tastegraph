#!/usr/bin/env python3
"""Cron-friendly IMDb CSV sync: detect file changes, import only what changed, enrich selectively.

Compares SHA-256 of each export under ``--data-dir`` (or overrides) to
``data/sync/imdb_cron_state.json``. If all match, exits 0 without DB or OMDb work.

When a file changes: mirror-import that source only, update its hash in state on
success, then run a **bounded** OMDb enrichment batch for missing/incomplete
metadata (ratings + watchlist + favorite_list). Optional: regenerate embeddings
or run ML training (off by default; heavy).

Assumes CSVs already exist (manual Export, local Playwright refresh, sync_remote, or
admin import). This is the **downstream** step for Railway/production; it does not
refresh IMDb source files. See docs/imdb-export-sync.md.

Examples:
  cd backend && python -m app.scripts.cron_sync_imdb
  cd backend && python -m app.scripts.cron_sync_imdb --dry-run
  cd backend && python -m app.scripts.cron_sync_imdb --enrich-limit 40 --embeddings

Weekly metadata backlog (no new CSV):
  cd backend && python -m app.scripts.cron_sync_imdb --enrich-if-unchanged --enrich-limit 25

See docs/imdb-export-sync.md.
"""

from __future__ import annotations

import argparse
import logging
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from app.core.database import SessionLocal
from app.scripts.enrich_missing_metadata import (
    collect_enrichment_candidates,
    enrich_imdb_ids_batch,
)
from app.scripts.imdb_sync_cron_lib import (
    SOURCE_FILES,
    default_data_dir,
    default_state_path,
    load_state,
    resolve_paths,
    run_import_for_source,
    save_state,
    sha256_file,
)

_LOG = logging.getLogger(__name__)


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Sync IMDb CSV exports when files change; optional enrich/embed/train."
    )
    p.add_argument(
        "--data-dir",
        type=Path,
        default=default_data_dir(),
        help="Directory with ratings.csv, watchlist.csv, favorite_list.csv, favorite_people.csv, title_metadata.csv",
    )
    p.add_argument("--state-file", type=Path, default=default_state_path(), help="JSON hash state")
    p.add_argument("--ratings", type=Path, default=None)
    p.add_argument("--watchlist", type=Path, default=None)
    p.add_argument("--favorite-list", type=Path, default=None)
    p.add_argument("--favorite-people", type=Path, default=None)
    p.add_argument("--title-metadata", type=Path, default=None)
    p.add_argument("--dry-run", action="store_true", help="Print plan only; no DB or state writes")
    p.add_argument(
        "--skip-enrich",
        action="store_true",
        help="After imports, do not call OMDb enrichment (not recommended)",
    )
    p.add_argument(
        "--enrich-limit",
        type=int,
        default=30,
        help="Max titles to enrich when imports ran (or with --enrich-if-unchanged)",
    )
    p.add_argument(
        "--enrich-if-unchanged",
        action="store_true",
        help="Run enrichment batch even when no CSV changed (e.g. weekly backlog)",
    )
    p.add_argument(
        "--embeddings",
        action="store_true",
        help="After successful imports this run, regenerate title_embeddings.npz (heavy)",
    )
    p.add_argument(
        "--train-ml",
        action="store_true",
        help="After this run, run app.ml.train_8plus_baseline (heavy; rare)",
    )
    p.add_argument("-q", "--quiet", action="store_true", help="Less logging")
    return p.parse_args()


def main() -> None:
    args = _parse_args()
    logging.basicConfig(
        level=logging.WARNING if args.quiet else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )

    overrides = {
        "ratings": args.ratings,
        "watchlist": args.watchlist,
        "favorite_list": args.favorite_list,
        "favorite_people": args.favorite_people,
        "title_metadata": args.title_metadata,
    }
    paths = resolve_paths(args.data_dir, overrides)
    state_path: Path = args.state_file
    state = load_state(state_path)

    # Drop state entries for sources whose files disappeared (optional hygiene)
    for key in list(state["sources"].keys()):
        if key not in SOURCE_FILES:
            del state["sources"][key]
    for key, p in paths.items():
        if p is None and key in state["sources"]:
            _LOG.info("source %s: file missing, clearing stored hash", key)
            del state["sources"][key]

    changed: list[tuple[str, Path, str]] = []
    for key, p in paths.items():
        if p is None:
            continue
        h = sha256_file(p)
        old = (state["sources"].get(key) or {}).get("sha256")
        if old != h:
            changed.append((key, p, h))

    if not changed and not args.enrich_if_unchanged:
        if not args.dry_run:
            save_state(state_path, state)
        _LOG.info(
            "imdb_cron: no CSV changes for present files; skipping imports and enrichment"
        )
        sys.exit(0)

    if args.dry_run:
        if changed:
            _LOG.info("dry-run: would import changed sources: %s", [c[0] for c in changed])
        if args.enrich_if_unchanged:
            _LOG.info("dry-run: would run enrichment (enrich-if-unchanged)")
        elif changed and not args.skip_enrich:
            _LOG.info("dry-run: would run enrichment limit=%s", args.enrich_limit)
        sys.exit(0)

    imports_ran = False
    db = SessionLocal()
    try:
        for key, path, new_hash in changed:
            try:
                stats = run_import_for_source(db, key, path)
                _LOG.info("import %s: %s", key, stats)
                state["sources"][key] = {"sha256": new_hash}
                save_state(state_path, state)
                imports_ran = True
            except Exception:
                _LOG.exception("import failed for %s (path=%s); state not updated for this source", key, path)
                sys.exit(1)
    finally:
        db.close()

    run_enrich = (imports_ran and not args.skip_enrich) or (
        args.enrich_if_unchanged and not args.skip_enrich
    )
    if run_enrich:
        db = SessionLocal()
        try:
            ids, title_lookup, skipped_fail, counts = collect_enrichment_candidates(
                db, limit=args.enrich_limit, retry_failed=False
            )
        finally:
            db.close()
        if not ids:
            _LOG.info(
                "enrichment: no candidates (skipped_recent_failures=%s)", skipped_fail
            )
        else:
            _LOG.info(
                "enrichment: %s candidates ratings=%s watchlist=%s favorite_list=%s",
                len(ids),
                counts["from_ratings"],
                counts["from_watchlist"],
                counts["from_favorite_list"],
            )
            att, ins, upd, failed = enrich_imdb_ids_batch(ids, title_lookup=title_lookup)
            _LOG.info(
                "enrichment: attempted=%s inserted=%s updated=%s failed=%s",
                att,
                ins,
                upd,
                failed,
            )

    backend_root = Path(__file__).resolve().parent.parent.parent
    py = sys.executable

    if args.embeddings and imports_ran:
        _LOG.info("running title embeddings generation (subprocess)")
        r = subprocess.run(
            [py, "-m", "app.scripts.generate_title_embeddings"],
            cwd=str(backend_root),
        )
        if r.returncode != 0:
            _LOG.error("embeddings subprocess exited %s", r.returncode)
            sys.exit(r.returncode)

    if args.train_ml:
        _LOG.info("running ML training (subprocess)")
        r = subprocess.run(
            [py, "-m", "app.ml.train_8plus_baseline"],
            cwd=str(backend_root),
        )
        if r.returncode != 0:
            _LOG.error("train_8plus_baseline exited %s", r.returncode)
            sys.exit(r.returncode)

    state["last_run_utc"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    save_state(state_path, state)
    _LOG.info("imdb_cron: done")
    sys.exit(0)


if __name__ == "__main__":
    main()
