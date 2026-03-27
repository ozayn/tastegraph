"""Provider catalog loading, matching, and scoring (Watchmode snapshots: BritBox, MUBI, …).

Candidate pool = IMDb IDs in the on-disk catalog JSON only, intersected with TitleMetadata.
BritBox high-fit flow: default series (catalog ``object_type`` SHOW), exclude IMDb watchlist IDs
from the pool while still blending watchlist genres/decades into taste via
load_taste_signals_for_provider_catalog.
Availability is not live-verified—only as accurate as the snapshot in data/<provider>/catalog.json.
"""

import json
import statistics
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.imdb_rating import IMDbRating
from app.models.imdb_watchlist_item import IMDbWatchlistItem
from app.models.title_metadata import TitleMetadata
from app.services.country_normalize import parse_and_normalize_countries
from app.services.favorite_boost import _load_favorites_by_role, _parse_names, compute_favorite_boost
from app.services.recommendation_filters import (
    any_recommendation_filter_active,
    parse_decade_bounds,
    resolve_similar_to_genre_set,
    title_metadata_matches_pool_filters,
)
from app.services.taste_signals import load_taste_signals_for_provider_catalog, score_title_by_taste_signals

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"

# SQLite often limits bound variables (~999). Catalog IN queries must be chunked.
_SQL_IN_CHUNK = 400


def _provider_catalog_label(provider_slug: str) -> str:
    s = (provider_slug or "").strip().lower().replace("-us", "").replace("-uk", "")
    return s.replace("-", " ").title() or provider_slug


def _catalog_fetch_hint(provider_slug: str) -> str:
    low = (provider_slug or "").lower()
    if "mubi" in low:
        return " Run: cd backend && python -m app.scripts.fetch_mubi_catalog"
    return " Run: cd backend && python -m app.scripts.fetch_britbox_catalog"


def _normalize_catalog_imdb_id(raw: str | int | float | None) -> str | None:
    """Align catalog IMDb ids with TitleMetadata.imdb_title_id (tt + digits)."""
    if raw is None:
        return None
    s = str(raw).strip()
    if not s or s.upper() in ("N/A", "NULL", "NONE"):
        return None
    if len(s) >= 3 and s[:2].lower() == "tt" and s[2:].isdigit():
        return "tt" + s[2:]
    if s.isdigit():
        return f"tt{s}"
    return s


def _jw_object_kind(entry: dict) -> str | None:
    """Normalize catalog ``object_type`` SHOW / MOVIE (snapshot casing may vary)."""
    ot = entry.get("object_type")
    if ot is None:
        return None
    u = str(ot).strip().upper()
    if u in ("SHOW", "SERIES", "TV_SHOW", "TV SERIES"):
        return "SHOW"
    if u in ("MOVIE", "FILM"):
        return "MOVIE"
    return None


def _iter_id_chunks(imdb_ids: set[str]) -> list[list[str]]:
    ids = sorted(imdb_ids)
    return [ids[i : i + _SQL_IN_CHUNK] for i in range(0, len(ids), _SQL_IN_CHUNK)]


def _sanitize_imdb_candidate_set(imdb_ids: set[str]) -> set[str]:
    """Canonicalize every candidate id the same way as catalog keys (defensive for stray types/spacing)."""
    out: set[str] = set()
    for x in imdb_ids:
        if x is None:
            continue
        n = _normalize_catalog_imdb_id(x if isinstance(x, str) else str(x))
        if n:
            out.add(n)
    return out


def _normalize_db_imdb_id(raw: str | None) -> str | None:
    """Match ORM-stored ids to catalog keys (strip padding, tt + digits)."""
    if raw is None:
        return None
    return _normalize_catalog_imdb_id(str(raw).strip())


def _exclude_rated(db: Session, imdb_ids: set[str]) -> tuple[set[str], int]:
    if not imdb_ids:
        return imdb_ids, 0
    rated_ids: set[str] = set()
    for chunk in _iter_id_chunks(imdb_ids):
        rows = db.query(IMDbRating.imdb_title_id).filter(IMDbRating.imdb_title_id.in_(chunk)).all()
        for r in rows:
            nid = _normalize_db_imdb_id(r.imdb_title_id)
            if nid:
                rated_ids.add(nid)
    removed = imdb_ids & rated_ids
    return imdb_ids - rated_ids, len(removed)


def _exclude_watchlist(db: Session, imdb_ids: set[str]) -> tuple[set[str], int]:
    """Remove IMDb watchlist titles from the candidate pool (taste only, not rec pool)."""
    if not imdb_ids:
        return imdb_ids, 0
    wl_ids: set[str] = set()
    for chunk in _iter_id_chunks(imdb_ids):
        rows = db.query(IMDbWatchlistItem.imdb_title_id).filter(
            IMDbWatchlistItem.imdb_title_id.in_(chunk)
        ).all()
        for r in rows:
            nid = _normalize_db_imdb_id(r.imdb_title_id)
            if nid:
                wl_ids.add(nid)
    removed = imdb_ids & wl_ids
    return imdb_ids - wl_ids, len(removed)


def _query_title_metadata_for_ids(db: Session, imdb_ids: set[str]) -> list[TitleMetadata]:
    imdb_ids = _sanitize_imdb_candidate_set(imdb_ids)
    if not imdb_ids:
        return []
    out: list[TitleMetadata] = []
    for chunk in _iter_id_chunks(imdb_ids):
        stmt = select(TitleMetadata).where(TitleMetadata.imdb_title_id.in_(chunk))
        out.extend(db.scalars(stmt).all())
    return out


def _count_title_metadata_hits(db: Session, imdb_ids: set[str]) -> int:
    imdb_ids = _sanitize_imdb_candidate_set(imdb_ids)
    if not imdb_ids:
        return 0
    total = 0
    for chunk in _iter_id_chunks(imdb_ids):
        stmt = (
            select(func.count())
            .select_from(TitleMetadata)
            .where(TitleMetadata.imdb_title_id.in_(chunk))
        )
        total += int(db.scalar(stmt) or 0)
    return total


def _metadata_pk_lookup_sample(db: Session, candidate_ids: list[str]) -> dict[str, object]:
    """Small diagnostic: do the same IN lookup as the bulk fetch for a few ids."""
    if not candidate_ids:
        return {"raw_pks": [], "normalized_pks": []}
    stmt = select(TitleMetadata.imdb_title_id).where(TitleMetadata.imdb_title_id.in_(candidate_ids))
    raw = list(db.scalars(stmt).all())
    return {
        "raw_pks": raw,
        "normalized_pks": [x for x in (_normalize_db_imdb_id(p) for p in raw) if x],
    }


def _catalog_path(provider_slug: str) -> Path:
    folder = provider_slug.replace("-us", "").replace("-uk", "")
    return DATA_DIR / folder / "catalog.json"


def load_catalog(provider_slug: str = "britbox-us") -> dict | None:
    path = _catalog_path(provider_slug)
    if not path.exists():
        return None
    return json.loads(path.read_text())


def get_catalog_imdb_ids(catalog: dict) -> set[str]:
    out: set[str] = set()
    for t in catalog.get("titles", []):
        nid = _normalize_catalog_imdb_id(t.get("imdb_id"))
        if nid:
            out.add(nid)
    return out


def _catalog_lookup(catalog: dict) -> dict[str, dict]:
    by_id: dict[str, dict] = {}
    for t in catalog.get("titles", []):
        nid = _normalize_catalog_imdb_id(t.get("imdb_id"))
        if not nid:
            continue
        by_id[nid] = {**t, "imdb_id": nid}
    return by_id


def _filter_by_type(imdb_ids: set[str], lookup: dict[str, dict], title_type: str | None) -> set[str]:
    if not title_type or title_type.lower() == "all":
        return imdb_ids
    want = "MOVIE" if title_type.lower() == "movie" else "SHOW"
    return {
        iid
        for iid in imdb_ids
        if _jw_object_kind(lookup.get(iid, {})) == want
    }


def _catalog_jw_counts_with_imdb(catalog: dict) -> tuple[int, int]:
    """SHOW vs MOVIE rows in snapshot that have an IMDb id."""
    shows = movies = 0
    for t in catalog.get("titles", []):
        if not _normalize_catalog_imdb_id(t.get("imdb_id")):
            continue
        kind = _jw_object_kind(t)
        if kind == "SHOW":
            shows += 1
        elif kind == "MOVIE":
            movies += 1
    return shows, movies


def _britbox_matched_pool_by_jw_type(
    db: Session,
    all_imdb_ids: set[str],
    lookup: dict[str, dict],
    *,
    exclude_rated: bool,
) -> tuple[int, int, int]:
    """After rated + watchlist exclusions, how many catalog titles have TitleMetadata, per JW type.

    Returns (matched_shows, matched_movies, matched_total).
    """
    show_ids = {i for i in all_imdb_ids if _jw_object_kind(lookup.get(i, {})) == "SHOW"}
    movie_ids = {i for i in all_imdb_ids if _jw_object_kind(lookup.get(i, {})) == "MOVIE"}

    def _eligible(pool: set[str]) -> set[str]:
        s = set(pool)
        if exclude_rated:
            s, _ = _exclude_rated(db, s)
        s, _ = _exclude_watchlist(db, s)
        return s

    es = _eligible(show_ids)
    em = _eligible(movie_ids)
    if not es and not em:
        return 0, 0, 0

    n_show = _count_title_metadata_hits(db, es) if es else 0
    n_movie = _count_title_metadata_hits(db, em) if em else 0
    return n_show, n_movie, n_show + n_movie


def _britbox_catalog_stats_extras(
    db: Session,
    catalog: dict,
    all_imdb_ids: set[str],
    lookup: dict[str, dict],
    *,
    exclude_rated: bool,
) -> dict:
    cat_shows, cat_movies = _catalog_jw_counts_with_imdb(catalog)
    m_show, m_movie, m_total = _britbox_matched_pool_by_jw_type(
        db, all_imdb_ids, lookup, exclude_rated=exclude_rated
    )
    overlap = _count_title_metadata_hits(db, all_imdb_ids)
    sample = sorted(all_imdb_ids)[:5]
    show_ids = {i for i in all_imdb_ids if _jw_object_kind(lookup.get(i, {})) == "SHOW"}
    movie_ids = {i for i in all_imdb_ids if _jw_object_kind(lookup.get(i, {})) == "MOVIE"}
    ov_show = _count_title_metadata_hits(db, show_ids)
    ov_movie = _count_title_metadata_hits(db, movie_ids)

    return {
        "catalog_jw_shows": cat_shows,
        "catalog_jw_movies": cat_movies,
        "matched_pool_shows": m_show,
        "matched_pool_movies": m_movie,
        "matched_pool_total": m_total,
        "matching_diagnostic": {
            "distinct_catalog_imdb_ids": len(all_imdb_ids),
            "catalog_imdb_id_sample": sample,
            "title_metadata_rows_hitting_catalog": overlap,
            "overlap_metadata_catalog_shows": ov_show,
            "overlap_metadata_catalog_movies": ov_movie,
        },
    }


def _year_value_for_pool_profile(meta: TitleMetadata, cat: dict) -> int | None:
    """Pick a sensible release year from TitleMetadata or catalog row."""
    for candidate in (meta.year, cat.get("year")):
        if candidate is None:
            continue
        if isinstance(candidate, float) and np.isnan(candidate):
            continue
        try:
            y = int(candidate)
        except (ValueError, TypeError):
            continue
        if 1870 <= y <= 2035:
            return y
    return None


def _britbox_matched_pool_year_profile(
    meta_by_id: dict[str, TitleMetadata],
    lookup: dict[str, dict],
) -> dict[str, object]:
    """Year/decade spread for the pool that actually has TitleMetadata (same ids High-Fit can score)."""
    if not meta_by_id:
        return {
            "matched_count": 0,
            "shows": 0,
            "movies": 0,
            "unknown_kind": 0,
            "with_year": 0,
            "without_year": 0,
            "mean_year": None,
            "median_year": None,
            "decade_counts": {},
            "newest_titles_sample": [],
            "oldest_titles_sample": [],
        }

    shows = movies = unknown_kind = 0
    for iid in meta_by_id:
        kind = _jw_object_kind(lookup.get(iid, {}))
        if kind == "SHOW":
            shows += 1
        elif kind == "MOVIE":
            movies += 1
        else:
            unknown_kind += 1

    row_info: list[tuple[int, str, str]] = []
    without_year = 0
    for iid, meta in meta_by_id.items():
        cat = lookup.get(iid, {})
        y = _year_value_for_pool_profile(meta, cat)
        title = (meta.title or cat.get("title") or iid).strip() or iid
        if y is None:
            without_year += 1
        else:
            row_info.append((y, iid, title))

    decade_counts: dict[str, int] = {}
    years_only = [r[0] for r in row_info]
    for y in years_only:
        decade = f"{y // 10 * 10}s"
        decade_counts[decade] = decade_counts.get(decade, 0) + 1

    row_info.sort(key=lambda x: x[0])
    oldest = [{"imdb_title_id": iid, "title": t, "year": y} for y, iid, t in row_info[:5]]
    newest = [{"imdb_title_id": iid, "title": t, "year": y} for y, iid, t in row_info[-5:][::-1]]

    mean_year = round(statistics.mean(years_only), 1) if years_only else None
    median_y = statistics.median(years_only) if years_only else None
    median_year: int | float | None
    if median_y is None:
        median_year = None
    elif isinstance(median_y, float) and median_y.is_integer():
        median_year = int(median_y)
    else:
        median_year = median_y

    return {
        "matched_count": len(meta_by_id),
        "shows": shows,
        "movies": movies,
        "unknown_kind": unknown_kind,
        "with_year": len(years_only),
        "without_year": without_year,
        "mean_year": mean_year,
        "median_year": median_year,
        "decade_counts": dict(sorted(decade_counts.items())),
        "newest_titles_sample": newest,
        "oldest_titles_sample": oldest,
    }


def get_britbox_matched_pool_profile(
    db: Session,
    *,
    provider_slug: str = "britbox-us",
    title_type: str | None = "show",
    exclude_rated: bool = True,
) -> dict | None:
    """Year/decade summary for titles in the metadata-matched pool (same filters as High-Fit / ML)."""
    catalog = load_catalog(provider_slug)
    if catalog is None:
        return None
    all_imdb_ids = get_catalog_imdb_ids(catalog)
    lookup = _catalog_lookup(catalog)
    cand_after_type = _filter_by_type(all_imdb_ids, lookup, title_type)
    cand_after_rated = set(cand_after_type)
    if exclude_rated:
        cand_after_rated, _ = _exclude_rated(db, cand_after_rated)
    cand_final, _ = _exclude_watchlist(db, cand_after_rated)
    meta_rows = _query_title_metadata_for_ids(db, cand_final)
    meta_by_id: dict[str, TitleMetadata] = {}
    for m in meta_rows:
        nk = _normalize_db_imdb_id(m.imdb_title_id)
        if nk:
            meta_by_id[nk] = m
    return _britbox_matched_pool_year_profile(meta_by_id, lookup)


def _has_uk_origin(country: str | None) -> bool:
    if not country:
        return False
    return bool(parse_and_normalize_countries(country) & {"United Kingdom"})


def _britbox_uk_catalog_bonus(
    *,
    is_britbox: bool,
    country: str | None,
    strong_countries: set[str],
) -> int:
    """+3 only when the title is UK-origin and the user already has UK as a lift-based strong country."""
    if not is_britbox:
        return 0
    if "United Kingdom" not in strong_countries:
        return 0
    if not _has_uk_origin(country):
        return 0
    return 3


def _overlap_genre_display_names(genres_csv: str | None, ref_genres: set[str]) -> list[str]:
    """Human-readable genre labels from metadata that intersect similar-to ref genres."""
    if not genres_csv or not ref_genres:
        return []
    ref_l = {g.lower() for g in ref_genres}
    out: list[str] = []
    for part in genres_csv.split(","):
        s = part.strip()
        if s and s.lower() in ref_l:
            out.append(s)
    return out[:4]


def _recency_bucket_for_provider_line(year: int | None) -> str | None:
    """Label for compact genre+recency copy (provider catalog cards only)."""
    if year is None:
        return None
    if year >= 2020:
        return "recent"
    if year >= 2015:
        return "newer"
    return None


def _genre_overlap_line(matched_genres: list[str], year: int | None) -> str | None:
    """One line for genre fit; folds in recency when the release year is recent (prefers newer picks)."""
    if not matched_genres:
        return None
    g = ", ".join(matched_genres[:3])
    bucket = _recency_bucket_for_provider_line(year)
    if bucket == "recent":
        return f"Recent {g}—aligned with your taste"
    if bucket == "newer":
        return f"Newer {g}—fits genres you rate highly"
    return f"Genres you love: {g}"


def _decade_line_when_no_genre_overlap(matched_decade: str | None) -> str | None:
    """Decade only when genre overlap is absent—compact, not the old generic filler."""
    if not matched_decade:
        return None
    return f"{matched_decade}—an era you lean toward in your ratings"


def _country_fit_line(matched_countries: list[str], *, is_britbox: bool) -> str | None:
    """One line for country overlap. BritBox: UK is implicit—skip UK-only; prefer a non-UK match."""
    if not matched_countries:
        return None
    if is_britbox:
        for c in matched_countries:
            if c != "United Kingdom":
                return f"From {c}—a country you rate highly"
        return None
    return f"From {matched_countries[0]}—a country you rate highly"


def _build_provider_surface_taste_lines(
    explanation: dict, year: int | None, *, is_britbox: bool = False
) -> list[str]:
    """Build taste lines for catalog provider cards: genre+recency before generic decade.

    Omits the watchlist-style decade sentence when genre overlap exists; prefers recency-aware
    genre phrasing for newer titles. People and country follow—decade only when genres do not match.
    On BritBox, United Kingdom is not surfaced as a country line (expected catalog bias).
    """
    lines: list[str] = []
    if explanation.get("in_favorite_list"):
        lines.append("On your curated favorites list")

    matched_genres = explanation.get("matched_genres") or []
    if not isinstance(matched_genres, list):
        matched_genres = []
    genre_line = _genre_overlap_line(matched_genres, year)
    if genre_line:
        lines.append(genre_line)

    matched_strong_directors = explanation.get("matched_strong_directors") or []
    for d in matched_strong_directors:
        lines.append(f"Director you rate strongly elsewhere: {d}")

    for p in explanation.get("matched_people") or []:
        role = p.get("role", "")
        name = p.get("name", "")
        if not name:
            continue
        role_label = {"director": "Director", "actor": "Actor", "writer": "Writer"}.get(
            role, role
        )
        lines.append(f"{role_label} you follow: {name}")

    matched_countries = explanation.get("matched_countries") or []
    ctry = _country_fit_line(matched_countries, is_britbox=is_britbox)
    if ctry:
        lines.append(ctry)

    matched_decade = explanation.get("matched_decade")
    if matched_decade and not matched_genres:
        dline = _decade_line_when_no_genre_overlap(matched_decade)
        if dline:
            lines.append(dline)

    return lines[:8]


def _uk_catalog_bonus_line_redundant_with_taste(
    taste_lines: list[str],
    matched_countries: list[str],
) -> bool:
    """True when a taste line already states UK country fit—skip duplicate BritBox UK catalog line."""
    if any(c == "United Kingdom" for c in matched_countries):
        return True
    for line in taste_lines:
        if "United Kingdom" in line:
            return True
    return False


def _enrich_explanation_for_provider_surface(
    explanation: dict,
    *,
    uk_bonus: int,
    is_britbox: bool,
    ref_genres: set[str] | None,
    similar_resolved_title: str | None,
    meta_genres: str | None,
    year: int | None,
) -> dict:
    """Merge pool filters (similar-to), taste reasons, and optional BritBox UK catalog note.

    Taste lines are rebuilt for provider surfaces so newer titles get recency-aware genre copy,
    decade-only filler is avoided when genres match, and the UK catalog note stays last when used.
    """
    out = dict(explanation)
    similar_prefix: list[str] = []
    if ref_genres and similar_resolved_title:
        overlap = _overlap_genre_display_names(meta_genres, ref_genres)
        if overlap:
            similar_prefix.append(
                f'Shares {", ".join(overlap)} with {similar_resolved_title} in your library'
            )
        else:
            similar_prefix.append(f'In the "similar to" lane you set ({similar_resolved_title})')

    tr = _build_provider_surface_taste_lines(out, year, is_britbox=is_britbox)

    uk_line: str | None = None
    if (
        uk_bonus > 0
        and is_britbox
        and not _uk_catalog_bonus_line_redundant_with_taste(tr, out.get("matched_countries") or [])
    ):
        uk_line = "UK-origin title (+3 BritBox catalog lift)"

    ordered = similar_prefix + tr
    if uk_line:
        ordered.append(uk_line)
    out["top_reasons"] = ordered[:8]
    return out


def _provider_high_fit_total(fit_score: int, favorite_boost: float) -> float:
    """Taste fit plus one favorite-people boost pass (ROLE_WEIGHT sum, not doubled)."""
    return float(fit_score) + float(favorite_boost)


def _year_int_for_ranking(y: object) -> int | None:
    if y is None:
        return None
    if isinstance(y, float) and np.isnan(y):
        return None
    try:
        iy = int(y)
    except (ValueError, TypeError):
        return None
    if 1870 <= iy <= 2035:
        return iy
    return None


def _high_fit_year_tiebreak_key(year: object) -> int:
    """Sort key fragment when High-Fit totals tie: prefer newer release years first.

    Valid years map to ``-year`` so ascending sort orders larger years before smaller ones.
    Missing or invalid years use ``0``, which sorts after any valid year (valid keys are <= -1870).
    """
    iy = _year_int_for_ranking(year)
    if iy is None:
        return 0
    return -iy


def _high_fit_ranking_diagnostics(
    top: list[dict],
    pool_profile: dict[str, object],
) -> dict[str, object]:
    """Compare top High-Fit rows to the matched pool decade profile; summarize years / tie-break."""
    n = len(top)
    years: list[int] = []
    for it in top:
        iy = _year_int_for_ranking(it.get("year"))
        if iy is not None:
            years.append(iy)

    top_dc = Counter()
    for iy in years:
        top_dc[f"{iy // 10 * 10}s"] += 1

    pool_dc_raw = pool_profile.get("decade_counts")
    pool_dc: dict[str, int] = dict(pool_dc_raw) if isinstance(pool_dc_raw, dict) else {}
    pool_with_year = int(pool_profile.get("with_year") or 0) or sum(pool_dc.values()) or 1

    def _pct_share(counts: dict[str, int], denom: int) -> dict[str, float]:
        keys = sorted(set(counts) | set(pool_dc))
        return {d: round(100.0 * counts.get(d, 0) / denom, 1) for d in keys if counts.get(d, 0) or pool_dc.get(d, 0)}

    top_mean = round(statistics.mean(years), 1) if years else None
    top_median_y = statistics.median(years) if years else None
    top_median: int | float | None
    if top_median_y is None:
        top_median = None
    elif isinstance(top_median_y, float) and top_median_y.is_integer():
        top_median = int(top_median_y)
    else:
        top_median = top_median_y

    pool_median = pool_profile.get("median_year")
    hints: list[str] = []
    if isinstance(pool_median, (int, float)) and isinstance(top_median, (int, float)):
        if float(top_median) < float(pool_median) - 12:
            hints.append(
                f"Top-{n} median year ({top_median}) is notably below matched-pool median ({pool_median}); "
                "genre/country/decade fit or tie-breaks may be lifting older titles."
            )
    if n >= 2:
        totals = [it.get("scoring", {}).get("total") for it in top if isinstance(it.get("scoring"), dict)]
        if totals and len([t for t in totals if t == totals[0]]) >= max(2, n // 2):
            hints.append(
                "Several top rows share the same total score; ties prefer newer release years, "
                "then ascending imdb_title_id for a stable order."
            )

    uk_hits = sum(
        1
        for it in top
        if isinstance(it.get("scoring"), dict) and int(it["scoring"].get("uk_catalog_bonus") or 0) > 0
    )
    if uk_hits and n and uk_hits >= max(2, (n + 1) // 3):
        hints.append(
            f"{uk_hits}/{n} top results include the +3 BritBox UK catalog bonus (UK-origin title + UK in strong countries)."
        )

    fav_boost_hits = sum(
        1
        for it in top
        if isinstance(it.get("scoring"), dict) and float(it["scoring"].get("favorite_boost") or 0) > 0
    )
    if fav_boost_hits and n and fav_boost_hits >= max(2, (n + 1) // 3):
        hints.append(f"{fav_boost_hits}/{n} top results have a non-zero favorite-people boost.")

    decade_fit_hits = sum(
        1
        for it in top
        if (it.get("explanation") or {}).get("matched_decade")
    )
    if decade_fit_hits and n and decade_fit_hits >= max(2, (n + 1) // 3):
        hints.append(
            f"{decade_fit_hits}/{n} top results matched a strong decade from your 8+ history (+1 fit each)."
        )

    return {
        "top_n": n,
        "top_with_year": len(years),
        "top_mean_year": top_mean,
        "top_median_year": top_median,
        "top_decade_counts": dict(sorted(top_dc.items())),
        "decade_compare": {
            "matched_pool_decade_counts": pool_dc,
            "top_results_decade_counts": dict(sorted(top_dc.items())),
            "matched_pool_decade_share_pct": _pct_share(pool_dc, pool_with_year),
            "top_results_decade_share_pct": _pct_share(dict(top_dc), max(len(years), 1)),
        },
        "sort_note": (
            "Descending total (fit + favorite_boost + uk_catalog_bonus); equal totals prefer newer "
            "release year, then ascending imdb_title_id. Titles without a usable year sort after dated "
            "titles at the same total."
        ),
        "hints": hints,
    }


def get_provider_high_fit(
    db: Session,
    provider_slug: str = "britbox-us",
    limit: int = 15,
    exclude_rated: bool = True,
    title_type: str | None = "show",
    decade: str | None = None,
    year_min: int | None = None,
    country: str | None = None,
    similar_to: str | None = None,
) -> dict:
    """Rank catalog titles by taste-signal overlap. Default ``title_type='show'`` (TV series in snapshot).

    Score: ``fit_score + favorite_boost`` where ``fit_score`` comes from
    ``score_title_by_taste_signals`` (genres/countries/decades/favorite-list/strong-directors/favorite-role weights)
    and ``favorite_boost`` is the sum of ``ROLE_WEIGHT`` from ``compute_favorite_boost`` (not doubled).
    BritBox UK catalog bonus (+3) applies only if ``United Kingdom`` is in the user's lift-based ``strong_countries``.
    Tie-break: higher total first, then newer ``year`` (missing year last among ties), then ascending ``imdb_title_id``.

    Optional ``decade`` (e.g. ``2020`` / ``2020s``), ``year_min``, ``country`` (substring), and ``similar_to`` (title
    hint resolved via your rated/watchlist titles) narrow the pool **before** scoring.
    """
    catalog = load_catalog(provider_slug)
    if catalog is None:
        label = _provider_catalog_label(provider_slug)
        msg = f"{label} catalog snapshot is not available."
        if settings.DEBUG:
            msg += _catalog_fetch_hint(provider_slug)
        return {"error": "no_catalog", "message": msg}

    is_britbox = "britbox" in provider_slug.lower()

    all_imdb_ids = get_catalog_imdb_ids(catalog)
    lookup = _catalog_lookup(catalog)
    cand_after_type = _filter_by_type(all_imdb_ids, lookup, title_type)

    rated_count = 0
    cand_after_rated = set(cand_after_type)
    if exclude_rated:
        cand_after_rated, rated_count = _exclude_rated(db, cand_after_rated)

    cand_final, _watchlist_excluded = _exclude_watchlist(db, cand_after_rated)

    meta_rows = _query_title_metadata_for_ids(db, cand_final)
    meta_by_id: dict[str, TitleMetadata] = {}
    skipped_bad_meta_pk = 0
    for m in meta_rows:
        nk = _normalize_db_imdb_id(m.imdb_title_id)
        if nk:
            meta_by_id[nk] = m
        else:
            skipped_bad_meta_pk += 1
    matched_ids_all = set(meta_by_id.keys())
    decade_bounds = parse_decade_bounds(decade)
    ref_genres, similar_resolved_title = resolve_similar_to_genre_set(db, similar_to)
    filter_active = any_recommendation_filter_active(
        decade_bounds=decade_bounds,
        year_min=year_min,
        country_contains=country,
        ref_genres=ref_genres,
    )
    matched_ids = matched_ids_all
    if filter_active:
        matched_ids = {
            iid
            for iid in matched_ids_all
            if title_metadata_matches_pool_filters(
                meta_by_id[iid],
                lookup.get(iid, {}),
                decade_bounds=decade_bounds,
                year_min=year_min,
                country_contains=country,
                ref_genres=ref_genres,
            )
        }

    favorites_by_role = _load_favorites_by_role(db)
    signals = load_taste_signals_for_provider_catalog(db)

    scored = []
    for imdb_id in matched_ids:
        meta = meta_by_id[imdb_id]
        cat = lookup.get(imdb_id, {})

        boost, matches = compute_favorite_boost(
            meta.actors, meta.directors, meta.writer, favorites_by_role
        )
        fit_score, explanation = score_title_by_taste_signals(
            imdb_id, meta.genres, meta.country, meta.year, meta.directors, matches, signals
        )
        uk_bonus = _britbox_uk_catalog_bonus(
            is_britbox=is_britbox,
            country=meta.country,
            strong_countries=signals.get("strong_countries", set()),
        )
        total = _provider_high_fit_total(fit_score, boost) + uk_bonus

        release_year = _year_int_for_ranking(meta.year) or _year_int_for_ranking(cat.get("year"))
        explanation_out = _enrich_explanation_for_provider_surface(
            explanation,
            uk_bonus=uk_bonus,
            is_britbox=is_britbox,
            ref_genres=ref_genres,
            similar_resolved_title=similar_resolved_title,
            meta_genres=meta.genres,
            year=release_year,
        )

        scored.append({
            "imdb_title_id": imdb_id,
            "title": meta.title or cat.get("title") or imdb_id,
            "year": meta.year or cat.get("year"),
            "title_type": (cat.get("object_type") or "").capitalize() or meta.title_type,
            "poster": meta.poster if meta.poster and meta.poster != "N/A" else None,
            "explanation": explanation_out,
            "_score": total,
            "_fit_score": fit_score,
            "_favorite_boost": boost,
            "_uk_bonus": uk_bonus,
        })

    scored.sort(
        key=lambda x: (-x["_score"], _high_fit_year_tiebreak_key(x["year"]), x["imdb_title_id"])
    )
    top_raw = scored[:limit]
    top: list[dict] = []
    for row in top_raw:
        item = {k: v for k, v in row.items() if not k.startswith("_")}
        item["scoring"] = {
            "fit_score": row["_fit_score"],
            "favorite_boost": round(float(row["_favorite_boost"]), 4),
            "uk_catalog_bonus": row["_uk_bonus"],
            "total": round(float(row["_score"]), 4),
        }
        top.append(item)

    meta_for_pool_profile = {iid: meta_by_id[iid] for iid in matched_ids}
    pool_profile = _britbox_matched_pool_year_profile(meta_for_pool_profile, lookup)
    high_fit_ranking = _high_fit_ranking_diagnostics(top, pool_profile)

    pool_breakdown = _britbox_catalog_stats_extras(
        db, catalog, all_imdb_ids, lookup, exclude_rated=exclude_rated
    )
    sample_cand = sorted(_sanitize_imdb_candidate_set(cand_final))[:5]
    pk_sample = _metadata_pk_lookup_sample(db, sample_cand)
    pipe = {
        "candidate_ids_after_type_filter": len(cand_after_type),
        "candidate_ids_after_rated_exclusions": len(cand_after_rated),
        "candidate_ids_after_watchlist_exclusions": len(cand_final),
        "final_metadata_rows_fetched": len(meta_rows),
        "metadata_matched_before_pool_filters": len(matched_ids_all),
        "final_scored_ids_count": len(matched_ids),
        "sample_candidate_ids_after_watchlist": sample_cand,
        "metadata_pk_lookup_for_sample_candidates": pk_sample["raw_pks"],
        "normalized_metadata_pk_lookup_for_sample": pk_sample["normalized_pks"],
        "title_metadata_rows_skipped_bad_pk": skipped_bad_meta_pk,
    }
    md = pool_breakdown.get("matching_diagnostic") or {}
    rec_filter_echo = {
        "decade": decade,
        "year_min": year_min,
        "country_contains": country,
        "similar_to": similar_to,
        "similar_to_resolved_title": similar_resolved_title,
        "pool_filters_active": filter_active,
        "pool_size_after_filters": len(matched_ids),
    }
    pool_breakdown = {
        **pool_breakdown,
        "matching_diagnostic": {
            **md,
            "pipeline": pipe,
            "matched_pool_profile": pool_profile,
            "high_fit_ranking": high_fit_ranking,
        },
        "recommendation_filters": rec_filter_echo,
    }

    return {
        "provider": provider_slug,
        "provider_name": catalog.get("provider_clear_name", provider_slug),
        "fetched_at": catalog.get("fetched_at"),
        "catalog_stats": {
            "total_in_catalog": catalog.get("stats", {}).get("total", 0),
            "with_imdb_id": len(all_imdb_ids),
            "matched_metadata": len(matched_ids_all),
            "unmatched": len(cand_final) - len(matched_ids_all),
            "already_rated": rated_count,
            "excluded_watchlist": _watchlist_excluded,
            **pool_breakdown,
        },
        "items": top,
    }


def _provider_candidates_dataframe_from_tm_rows(db: Session, tm_rows: list[TitleMetadata]) -> pd.DataFrame:
    """Build ML feature DataFrame from TitleMetadata rows already loaded for candidate ids."""
    from app.models.favorite_list_item import FavoriteListItem

    rows: list[tuple] = []
    for m in tm_rows:
        nk = _normalize_db_imdb_id(m.imdb_title_id)
        if not nk:
            continue
        rows.append(
            (
                nk,
                m.title,
                m.title_type,
                m.year,
                m.genres,
                m.country,
                m.languages,
                m.directors,
                m.actors,
                m.writer,
            )
        )

    fav_ids: set[str] = set()
    for r in db.query(FavoriteListItem.imdb_title_id).all():
        fn = _normalize_db_imdb_id(r.imdb_title_id)
        if fn:
            fav_ids.add(fn)
    favs = _load_favorites_by_role(db)

    records = []
    for imdb_id, title, tt, year, genres, country, langs, dirs, actors, writer in rows:
        actor_set = _parse_names(actors)
        dir_set = _parse_names(dirs)
        writer_set = _parse_names(writer)
        fav_match = any(
            (favs.get(role) or set()) & names
            for role, names in [("actor", actor_set), ("director", dir_set), ("writer", writer_set)]
        )
        records.append({
            "imdb_title_id": imdb_id,
            "title": title or "",
            "title_type": tt or "",
            "year": year,
            "decade": f"{year // 10 * 10}s" if year else "",
            "genres": genres or "",
            "country": country or "",
            "languages": langs or "",
            "directors": dirs or "",
            "actors": actors or "",
            "writer": writer or "",
            "favorite_people_match": fav_match,
            "in_favorite_list": imdb_id in fav_ids,
        })
    return pd.DataFrame(records)


def _build_provider_candidates(db: Session, imdb_ids: set[str]) -> pd.DataFrame:
    """Build ML feature DataFrame for a set of IMDb IDs from TitleMetadata."""
    tm_rows = _query_title_metadata_for_ids(db, imdb_ids)
    return _provider_candidates_dataframe_from_tm_rows(db, tm_rows)


def get_provider_ml(
    db: Session,
    provider_slug: str = "britbox-us",
    limit: int = 15,
    exclude_rated: bool = True,
    title_type: str | None = "show",
    decade: str | None = None,
    year_min: int | None = None,
    country: str | None = None,
    similar_to: str | None = None,
) -> dict:
    """ML-ranked catalog titles. Same candidate rules as high-fit (default series; watchlist IDs excluded).

    Optional pool filters match :func:`get_provider_high_fit` (applied before ML scoring).
    """
    import warnings

    import joblib
    from app.ml.features import MODELS_DIR, build_feature_matrix

    warnings.filterwarnings("ignore", message="unknown class")

    catalog = load_catalog(provider_slug)
    if catalog is None:
        label = _provider_catalog_label(provider_slug)
        msg = f"{label} catalog snapshot is not available."
        if settings.DEBUG:
            msg += _catalog_fetch_hint(provider_slug)
        return {"error": "no_catalog", "message": msg}

    all_imdb_ids = get_catalog_imdb_ids(catalog)
    lookup = _catalog_lookup(catalog)

    model_path = MODELS_DIR / "8plus_baseline_model.joblib"
    artifact_path = MODELS_DIR / "8plus_baseline_artifacts.joblib"
    base_resp = {
        "provider": provider_slug,
        "provider_name": catalog.get("provider_clear_name", provider_slug),
        "fetched_at": catalog.get("fetched_at"),
    }

    if not model_path.exists() or not artifact_path.exists():
        pool_breakdown = _britbox_catalog_stats_extras(
            db, catalog, all_imdb_ids, lookup, exclude_rated=exclude_rated
        )
        return {
            **base_resp,
            "items": [],
            "model_available": False,
            "catalog_stats": {
                "total_in_catalog": catalog.get("stats", {}).get("total", 0),
                "with_imdb_id": len(all_imdb_ids),
                **pool_breakdown,
            },
        }
    cand_after_type = _filter_by_type(all_imdb_ids, lookup, title_type)

    rated_count = 0
    cand_after_rated = set(cand_after_type)
    if exclude_rated:
        cand_after_rated, rated_count = _exclude_rated(db, cand_after_rated)

    cand_final, wl_excluded = _exclude_watchlist(db, cand_after_rated)

    tm_rows = _query_title_metadata_for_ids(db, cand_final)
    decade_bounds_ml = parse_decade_bounds(decade)
    ref_genres_ml, similar_resolved_ml = resolve_similar_to_genre_set(db, similar_to)
    filter_active_ml = any_recommendation_filter_active(
        decade_bounds=decade_bounds_ml,
        year_min=year_min,
        country_contains=country,
        ref_genres=ref_genres_ml,
    )
    if filter_active_ml:
        filtered_ml: list[TitleMetadata] = []
        for m in tm_rows:
            nk = _normalize_db_imdb_id(m.imdb_title_id)
            if not nk:
                continue
            if title_metadata_matches_pool_filters(
                m,
                lookup.get(nk, {}),
                decade_bounds=decade_bounds_ml,
                year_min=year_min,
                country_contains=country,
                ref_genres=ref_genres_ml,
            ):
                filtered_ml.append(m)
        tm_rows = filtered_ml
    skipped_bad = sum(1 for m in tm_rows if not _normalize_db_imdb_id(m.imdb_title_id))
    df = _provider_candidates_dataframe_from_tm_rows(db, tm_rows)
    meta_by_id_ml: dict[str, TitleMetadata] = {}
    for m in tm_rows:
        nk = _normalize_db_imdb_id(m.imdb_title_id)
        if nk:
            meta_by_id_ml[nk] = m
    pool_profile_ml = _britbox_matched_pool_year_profile(meta_by_id_ml, lookup)
    pool_breakdown = _britbox_catalog_stats_extras(
        db, catalog, all_imdb_ids, lookup, exclude_rated=exclude_rated
    )
    sample_cand = sorted(_sanitize_imdb_candidate_set(cand_final))[:5]
    pk_sample = _metadata_pk_lookup_sample(db, sample_cand)
    pipe_ml = {
        "candidate_ids_after_type_filter": len(cand_after_type),
        "candidate_ids_after_rated_exclusions": len(cand_after_rated),
        "candidate_ids_after_watchlist_exclusions": len(cand_final),
        "final_metadata_rows_fetched": len(tm_rows),
        "final_scored_ids_count": int(len(df)),
        "sample_candidate_ids_after_watchlist": sample_cand,
        "metadata_pk_lookup_for_sample_candidates": pk_sample["raw_pks"],
        "normalized_metadata_pk_lookup_for_sample": pk_sample["normalized_pks"],
        "title_metadata_rows_skipped_bad_pk": skipped_bad,
    }
    rec_filter_ml = {
        "decade": decade,
        "year_min": year_min,
        "country_contains": country,
        "similar_to": similar_to,
        "similar_to_resolved_title": similar_resolved_ml,
        "pool_filters_active": filter_active_ml,
        "pool_size_after_filters": int(len(df)),
    }
    md0 = pool_breakdown.get("matching_diagnostic") or {}
    pool_breakdown_merged = {
        **pool_breakdown,
        "matching_diagnostic": {
            **md0,
            "pipeline": pipe_ml,
            "matched_pool_profile": pool_profile_ml,
        },
        "recommendation_filters": rec_filter_ml,
    }
    if len(df) == 0:
        return {
            **base_resp,
            "items": [],
            "model_available": True,
            "catalog_stats": {
                "matched_metadata": 0,
                "excluded_watchlist": wl_excluded,
                "total_in_catalog": catalog.get("stats", {}).get("total", 0),
                "with_imdb_id": len(all_imdb_ids),
                **pool_breakdown_merged,
            },
        }

    model = joblib.load(model_path)
    loaded = joblib.load(artifact_path)
    artifacts = loaded["artifacts"]

    X, _ = build_feature_matrix(
        df,
        genre_mlb=artifacts["genre_mlb"],
        country_mlb=artifacts["country_mlb"],
        decade_categories=artifacts["decade_categories"],
        title_type_categories=artifacts["title_type_categories"],
        fit=False,
    )

    if hasattr(model, "named_steps"):
        X_scaled = model.named_steps["scaler"].transform(X)
        lr = model.named_steps["clf"]
    else:
        X_scaled = X
        lr = model

    proba = model.predict_proba(X_scaled)[:, 1]
    df = df.copy()
    df["prob_8plus"] = proba
    df = df.sort_values("prob_8plus", ascending=False).reset_index(drop=True)

    coef = lr.coef_[0]
    feat_names = artifacts.get("feature_names", [])

    def _top_feats(idx: int) -> list[str]:
        if not feat_names or len(feat_names) != len(coef):
            return []
        contrib = coef * X_scaled[idx]
        ranked = sorted(zip(feat_names, contrib), key=lambda x: x[1], reverse=True)
        return [n for n, c in ranked[:3] if c > 0.01]

    poster_ids = list(df.head(limit)["imdb_title_id"])
    poster_map = {}
    if poster_ids:
        for iid, poster in db.query(TitleMetadata.imdb_title_id, TitleMetadata.poster).filter(
            TitleMetadata.imdb_title_id.in_(poster_ids)
        ).all():
            poster_map[iid] = poster if poster and poster != "N/A" else None

    results = []
    for idx, row in df.head(limit).iterrows():
        cat = lookup.get(row["imdb_title_id"], {})
        y = row.get("year")
        year_val = None
        if y is not None and not (isinstance(y, float) and np.isnan(y)):
            try:
                year_val = int(y)
            except (ValueError, TypeError):
                pass
        results.append({
            "imdb_title_id": row["imdb_title_id"],
            "title": (row.get("title") or "").strip() or cat.get("title") or row["imdb_title_id"],
            "year": year_val,
            "title_type": (cat.get("object_type") or "").capitalize() or row.get("title_type") or None,
            "poster": poster_map.get(row["imdb_title_id"]),
            "prob_8plus": round(float(row["prob_8plus"]), 3),
            "top_features": _top_feats(idx),
        })

    return {
        **base_resp,
        "catalog_stats": {
            "total_in_catalog": catalog.get("stats", {}).get("total", 0),
            "with_imdb_id": len(all_imdb_ids),
            "matched_metadata": len(df),
            "already_rated": rated_count,
            "excluded_watchlist": wl_excluded,
            **pool_breakdown_merged,
        },
        "items": results,
        "model_available": True,
    }
