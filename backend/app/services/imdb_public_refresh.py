"""
Defensive **public-page** refresh for IMDb-derived CSVs (Railway / cron, no browser).

Fetches configured URLs with httpx, extracts title ids (``tt…``) and optionally
people (``nm…``) from embedded JSON and/or raw HTML. Writes CSV files compatible
with existing importers, then **validation** must pass before atomically
replacing ``data/imdb/*.csv``.

**Limitations (read this)**

- IMDb is largely **client-rendered** and may **block datacenter IPs** or return
  empty shells. This path may **often fail validation** in production; official
  CSV export or authenticated automation remains more reliable.
- Layout and embedded JSON **change without notice**; extraction is **best-effort**.
- **Ratings**: mirror import needs real scores. If this module cannot extract a
  numeric rating for **every** scraped title row, it **does not write**
  ``ratings.csv`` (so mirror sync cannot wipe your DB with empty ratings).

State file: ``data/imdb/.scrape_refresh_state.json`` (counts from last **accepted** run).
"""

from __future__ import annotations

import csv
import json
import logging
import os
import re
import tempfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import httpx

_LOG = logging.getLogger(__name__)

TT_RE = re.compile(r"\b(tt\d{7,9})\b")
NM_RE = re.compile(r"\b(nm\d{7,9})\b")
# Embedded JSON blobs (Next.js / IMDb widgets)
_SCRIPT_JSON = re.compile(
    r'<script[^>]+(?:id="__NEXT_DATA__"|type="application/json")[^>]*>(.*?)</script>',
    re.IGNORECASE | re.DOTALL,
)

DEFAULT_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)


@dataclass
class RefreshConfig:
    """Env-driven URLs; unset URL => skip that target."""

    output_dir: Path
    state_path: Path
    list_url: str | None = None
    watchlist_url: str | None = None
    ratings_url: str | None = None
    favorite_people_url: str | None = None
    # Validation
    min_counts: dict[str, int] = field(
        default_factory=lambda: {
            "favorite_list": 1,
            "watchlist": 1,
            "ratings": 1,
            "favorite_people": 1,
        }
    )
    min_drop_ratio: float = 0.5  # reject if new_count < floor(prev * ratio) when prev > 0
    prev_min_for_ratio: int = 1  # only apply ratio when prev count >= this (default: always)

    @classmethod
    def from_env(cls, output_dir: Path, state_path: Path) -> RefreshConfig:
        def _min(key: str, default: int) -> int:
            raw = os.environ.get(f"IMDB_SCRAPE_MIN_{key.upper()}", "")
            if not raw.strip():
                return default
            try:
                return max(0, int(raw))
            except ValueError:
                return default

        return cls(
            output_dir=output_dir,
            state_path=state_path,
            list_url=os.environ.get("IMDB_SCRAPE_LIST_URL", "").strip() or None,
            watchlist_url=os.environ.get("IMDB_SCRAPE_WATCHLIST_URL", "").strip() or None,
            ratings_url=os.environ.get("IMDB_SCRAPE_RATINGS_URL", "").strip() or None,
            favorite_people_url=os.environ.get(
                "IMDB_SCRAPE_FAVORITE_PEOPLE_URL", ""
            ).strip()
            or None,
            min_counts={
                "favorite_list": _min("FAVORITE_LIST", 1),
                "watchlist": _min("WATCHLIST", 1),
                "ratings": _min("RATINGS", 1),
                "favorite_people": _min("FAVORITE_PEOPLE", 1),
            },
            min_drop_ratio=float(os.environ.get("IMDB_SCRAPE_MIN_DROP_RATIO", "0.5")),
            prev_min_for_ratio=int(os.environ.get("IMDB_SCRAPE_PREV_MIN_FOR_RATIO", "1")),
        )


def fetch_html(url: str, *, timeout_s: float = 45.0) -> str:
    headers = {"User-Agent": os.environ.get("IMDB_SCRAPE_USER_AGENT", DEFAULT_UA)}
    with httpx.Client(follow_redirects=True, timeout=timeout_s, headers=headers) as client:
        r = client.get(url)
        r.raise_for_status()
        return r.text


def _walk_json_for_ids(obj: Any, tt_out: list[str], nm_out: list[str], seen_tt: set, seen_nm: set) -> None:
    if isinstance(obj, str):
        for m in TT_RE.finditer(obj):
            tid = m.group(1)
            if tid not in seen_tt:
                seen_tt.add(tid)
                tt_out.append(tid)
        for m in NM_RE.finditer(obj):
            nid = m.group(1)
            if nid not in seen_nm:
                seen_nm.add(nid)
                nm_out.append(nid)
    elif isinstance(obj, dict):
        for v in obj.values():
            _walk_json_for_ids(v, tt_out, nm_out, seen_tt, seen_nm)
    elif isinstance(obj, list):
        for v in obj:
            _walk_json_for_ids(v, tt_out, nm_out, seen_tt, seen_nm)


def extract_tt_ordered(html: str) -> list[str]:
    """All tt ids in document order (first occurrence wins per id)."""
    seen: set[str] = set()
    out: list[str] = []
    for m in TT_RE.finditer(html):
        t = m.group(1)
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out


def extract_tt_from_json_scripts(html: str) -> list[str]:
    """Prefer structured JSON (often denser than visible HTML)."""
    tt: list[str] = []
    nm: list[str] = []
    seen_tt: set[str] = set()
    seen_nm: set[str] = set()
    for m in _SCRIPT_JSON.finditer(html):
        raw = m.group(1).strip()
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        _walk_json_for_ids(data, tt, nm, seen_tt, seen_nm)
    return tt


def extract_tt_combined(html: str) -> list[str]:
    """JSON scripts first (order), then regex pass for any missed."""
    from_json = extract_tt_from_json_scripts(html)
    if from_json:
        return from_json
    return extract_tt_ordered(html)


def _walk_json_people(obj: Any, out: list[tuple[str, str]], seen: set[str]) -> None:
    """Collect (nm_id, display_name) from dicts that carry both."""
    if isinstance(obj, dict):
        vals = {str(k).lower(): v for k, v in obj.items()}
        nm: str | None = None
        for key in ("nconst", "const", "id"):
            v = vals.get(key)
            if isinstance(v, str):
                m = NM_RE.search(v)
                if m:
                    nm = m.group(1)
                    break
        name: str | None = None
        for key in ("name", "primaryname", "primarytext", "text", "label"):
            v = vals.get(key)
            if isinstance(v, str):
                t = v.strip()
                if t and not NM_RE.search(t):
                    name = t
                    break
        if nm and name and nm not in seen:
            seen.add(nm)
            out.append((nm, name))
        for v in obj.values():
            _walk_json_people(v, out, seen)
    elif isinstance(obj, list):
        for v in obj:
            _walk_json_people(v, out, seen)


def extract_people_from_json_scripts(html: str) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    for m in _SCRIPT_JSON.finditer(html):
        raw = m.group(1).strip()
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        _walk_json_people(data, out, seen)
    return out


def extract_people_combined(html: str) -> list[tuple[str, str]]:
    """Prefer visible name links; fall back to embedded JSON name + nconst pairs."""
    people = extract_nm_with_labels(html)
    if people:
        return people
    return extract_people_from_json_scripts(html)


def extract_ratings_pairs(html: str) -> dict[str, int]:
    """
    Best-effort map tt -> integer rating (1–10).
    Looks for JSON-like fragments: tt near yourRating / userRating / ratingValue.
    """
    pairs: dict[str, int] = {}
    # Windowed regex: tt id within ~400 chars of a small integer 1–10
    for m in re.finditer(
        r"(tt\d{7,9}).{0,400}?(?:yourRating|userRating|\"rating\")\s*[:\"]\s*(\d{1,2})\b",
        html,
        re.IGNORECASE | re.DOTALL,
    ):
        tid, rs = m.group(1), m.group(2)
        try:
            v = int(rs)
            if 1 <= v <= 10:
                pairs.setdefault(tid, v)
        except ValueError:
            pass
    # Simpler: "titleId":"tt..." with rating nearby in same object-ish slice
    for m in re.finditer(
        r'"title(Id|Text)":\s*"(tt\d{7,9})".{0,300}?"(\d)"',
        html,
        re.IGNORECASE | re.DOTALL,
    ):
        tid = m.group(2)
        try:
            v = int(m.group(3))
            if 1 <= v <= 10:
                pairs.setdefault(tid, v)
        except ValueError:
            pass
    return pairs


def extract_nm_with_labels(html: str) -> list[tuple[str, str]]:
    """(nm_id, label) from href=/name/nm.../ and link text; order preserved."""
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    for m in re.finditer(
        r'href="/name/(nm\d{7,9})/[^"]*"[^>]*>([^<]{1,200})</a>',
        html,
        re.IGNORECASE,
    ):
        nm_id, label = m.group(1), re.sub(r"\s+", " ", m.group(2)).strip()
        if nm_id in seen or not label:
            continue
        seen.add(nm_id)
        out.append((nm_id, label))
    return out


def _load_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, OSError):
        return {}


def _save_state(path: Path, state: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _validate_count(
    key: str,
    new_count: int,
    state: dict[str, Any],
    cfg: RefreshConfig,
) -> tuple[bool, str]:
    mn = cfg.min_counts.get(key, 1)
    if new_count < mn:
        return False, f"{key}: count {new_count} < minimum {mn}"

    prev_entry = state.get("sources", {}).get(key, {})
    prev_n = int(prev_entry.get("count", 0) or 0)

    if prev_n >= cfg.prev_min_for_ratio:
        floor = max(mn, int(prev_n * cfg.min_drop_ratio))
        if new_count < floor:
            return (
                False,
                f"{key}: count {new_count} < floor({floor}) from previous {prev_n} "
                f"(ratio {cfg.min_drop_ratio})",
            )

    return True, f"{key}: ok ({new_count} rows)"


def _atomic_write_csv(path: Path, rows: Iterable[dict[str, Any]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(suffix=".csv.part", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            w.writeheader()
            for row in rows:
                w.writerow(row)
        Path(tmp).replace(path)
    except Exception:
        Path(tmp).unlink(missing_ok=True)
        raise


def write_favorite_list_csv(path: Path, tt_ids: list[str]) -> None:
    rows = [
        {
            "Const": tt,
            "Position": str(i),
            "Title": "",
            "Title Type": "",
            "Year": "",
            "Genres": "",
        }
        for i, tt in enumerate(tt_ids, start=1)
    ]
    _atomic_write_csv(
        path,
        rows,
        ["Const", "Position", "Title", "Title Type", "Year", "Genres"],
    )


def write_watchlist_csv(path: Path, tt_ids: list[str]) -> None:
    rows = []
    for i, tt in enumerate(tt_ids, start=1):
        rows.append(
            {
                "Const": tt,
                "Position": str(i),
                "Created": "",
                "Modified": "",
                "Title": "",
                "Title Type": "",
                "Year": "",
                "Genres": "",
                "Your Rating": "",
                "Date Rated": "",
            }
        )
    _atomic_write_csv(
        path,
        rows,
        [
            "Const",
            "Position",
            "Created",
            "Modified",
            "Title",
            "Title Type",
            "Year",
            "Genres",
            "Your Rating",
            "Date Rated",
        ],
    )


def write_ratings_rich_csv(path: Path, tt_order: list[str], pairs: dict[str, int]) -> None:
    """Const + Your Rating required for rich importer; other columns empty."""
    rows = []
    for tt in tt_order:
        if tt not in pairs:
            continue
        rows.append(
            {
                "Const": tt,
                "Your Rating": str(pairs[tt]),
                "Date Rated": "",
                "Title": "",
                "Title Type": "",
                "Year": "",
                "Genres": "",
                "IMDb Rating": "",
                "Runtime (mins)": "",
                "Num Votes": "",
                "Release Date": "",
                "Directors": "",
                "URL": "",
            }
        )
    _atomic_write_csv(
        path,
        rows,
        [
            "Const",
            "Your Rating",
            "Date Rated",
            "Title",
            "Title Type",
            "Year",
            "Genres",
            "IMDb Rating",
            "Runtime (mins)",
            "Num Votes",
            "Release Date",
            "Directors",
            "URL",
        ],
    )


def write_favorite_people_simple_csv(path: Path, people: list[tuple[str, str]]) -> None:
    """name,role — role defaults to actor (scraped pages rarely distinguish)."""
    rows = [{"name": name, "role": "actor"} for _, name in people]
    _atomic_write_csv(path, rows, ["name", "role"])


def run_public_refresh(cfg: RefreshConfig) -> dict[str, Any]:
    """
    Fetch, validate, write CSVs. Updates state only for **accepted** writes.

    Returns summary dict for logging.
    """
    summary: dict[str, Any] = {"written": [], "skipped": [], "errors": []}
    state = _load_state(cfg.state_path)
    state.setdefault("sources", {})

    targets: list[tuple[str, str | None, Any]] = [
        ("favorite_list", cfg.list_url, "list"),
        ("watchlist", cfg.watchlist_url, "watchlist"),
        ("ratings", cfg.ratings_url, "ratings"),
        ("favorite_people", cfg.favorite_people_url, "people"),
    ]

    for key, url, kind in targets:
        if not url:
            summary["skipped"].append(f"{key}: no URL configured")
            continue
        out_path = cfg.output_dir / {
            "favorite_list": "favorite_list.csv",
            "watchlist": "watchlist.csv",
            "ratings": "ratings.csv",
            "favorite_people": "favorite_people.csv",
        }[key]
        try:
            html = fetch_html(url)
        except Exception as e:
            msg = f"{key}: fetch failed: {e}"
            _LOG.error(msg)
            summary["errors"].append(msg)
            continue

        if len(html) < 500:
            msg = f"{key}: response too small ({len(html)} bytes), likely block or error page"
            _LOG.error(msg)
            summary["errors"].append(msg)
            continue

        try:
            if kind in ("list", "watchlist"):
                tt_ids = extract_tt_combined(html)
                ok, reason = _validate_count(key, len(tt_ids), state, cfg)
                if not ok:
                    _LOG.error("reject %s", reason)
                    summary["errors"].append(reason)
                    continue
                if kind == "list":
                    write_favorite_list_csv(out_path, tt_ids)
                else:
                    write_watchlist_csv(out_path, tt_ids)
                summary["written"].append(f"{key}: {len(tt_ids)} titles -> {out_path}")
                state["sources"][key] = {
                    "count": len(tt_ids),
                    "source": "public_scrape",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }

            elif kind == "ratings":
                tt_ids = extract_tt_combined(html)
                pairs = extract_ratings_pairs(html)
                if not tt_ids:
                    summary["errors"].append(f"{key}: no title ids found")
                    continue
                missing = [t for t in tt_ids if t not in pairs]
                if missing:
                    msg = (
                        f"{key}: refuse to write — no rating extracted for "
                        f"{len(missing)} title(s) (anti wipe). Example: {missing[:3]}"
                    )
                    _LOG.error(msg)
                    summary["errors"].append(msg)
                    continue
                ordered_pairs = {t: pairs[t] for t in tt_ids}
                ok, reason = _validate_count(key, len(ordered_pairs), state, cfg)
                if not ok:
                    _LOG.error("reject %s", reason)
                    summary["errors"].append(reason)
                    continue
                write_ratings_rich_csv(out_path, tt_ids, ordered_pairs)
                summary["written"].append(f"{key}: {len(ordered_pairs)} rated -> {out_path}")
                state["sources"][key] = {
                    "count": len(ordered_pairs),
                    "source": "public_scrape",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }

            else:  # people
                people = extract_people_combined(html)
                if not people:
                    msg = f"{key}: no people with display names found (HTML/JSON)"
                    _LOG.error(msg)
                    summary["errors"].append(msg)
                    continue
                ok, reason = _validate_count(key, len(people), state, cfg)
                if not ok:
                    _LOG.error("reject %s", reason)
                    summary["errors"].append(reason)
                    continue
                write_favorite_people_simple_csv(out_path, people)
                summary["written"].append(f"{key}: {len(people)} people -> {out_path}")
                state["sources"][key] = {
                    "count": len(people),
                    "source": "public_scrape",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }

        except Exception as e:
            msg = f"{key}: {e}"
            _LOG.exception(msg)
            summary["errors"].append(msg)
            continue

    _save_state(cfg.state_path, state)
    summary["state_path"] = str(cfg.state_path)
    return summary
