"""Provider catalog loading, matching, and scoring for prototype provider-aware recommendations.

Loads a snapshot catalog (e.g. from JustWatch), matches entries to TitleMetadata by IMDb ID,
and scores using existing taste-signal and ML pipelines.
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.imdb_rating import IMDbRating
from app.models.title_metadata import TitleMetadata
from app.services.country_normalize import parse_and_normalize_countries
from app.services.favorite_boost import _load_favorites_by_role, _parse_names, compute_favorite_boost
from app.services.taste_signals import load_taste_signals, score_watchlist_item

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"


def _catalog_path(provider_slug: str) -> Path:
    folder = provider_slug.replace("-us", "").replace("-uk", "")
    return DATA_DIR / folder / "catalog.json"


def load_catalog(provider_slug: str = "britbox-us") -> dict | None:
    path = _catalog_path(provider_slug)
    if not path.exists():
        return None
    return json.loads(path.read_text())


def get_catalog_imdb_ids(catalog: dict) -> set[str]:
    return {t["imdb_id"] for t in catalog.get("titles", []) if t.get("imdb_id")}


def _catalog_lookup(catalog: dict) -> dict[str, dict]:
    return {t["imdb_id"]: t for t in catalog.get("titles", []) if t.get("imdb_id")}


def _exclude_rated(db: Session, imdb_ids: set[str]) -> tuple[set[str], int]:
    if not imdb_ids:
        return imdb_ids, 0
    rated_rows = db.query(IMDbRating.imdb_title_id).filter(
        IMDbRating.imdb_title_id.in_(imdb_ids)
    ).all()
    rated_ids = {r.imdb_title_id for r in rated_rows}
    return imdb_ids - rated_ids, len(rated_ids)


def _filter_by_type(imdb_ids: set[str], lookup: dict[str, dict], title_type: str | None) -> set[str]:
    if not title_type:
        return imdb_ids
    jw_type = "MOVIE" if title_type.lower() == "movie" else "SHOW"
    return {iid for iid in imdb_ids if lookup.get(iid, {}).get("object_type") == jw_type}


_UK_VARIANTS = {"united kingdom", "uk", "england", "scotland", "wales", "northern ireland"}


def _has_uk_origin(country: str | None) -> bool:
    if not country:
        return False
    return bool(parse_and_normalize_countries(country) & {"United Kingdom"})


def get_provider_high_fit(
    db: Session,
    provider_slug: str = "britbox-us",
    limit: int = 15,
    exclude_rated: bool = True,
    title_type: str | None = None,
) -> dict:
    catalog = load_catalog(provider_slug)
    if catalog is None:
        msg = f"BritBox catalog snapshot is not available."
        if settings.DEBUG:
            msg += f" Run: cd backend && python -m app.scripts.fetch_britbox_catalog"
        return {"error": "no_catalog", "message": msg}

    is_britbox = "britbox" in provider_slug.lower()

    all_imdb_ids = get_catalog_imdb_ids(catalog)
    lookup = _catalog_lookup(catalog)
    imdb_ids = _filter_by_type(all_imdb_ids, lookup, title_type)

    rated_count = 0
    if exclude_rated:
        imdb_ids, rated_count = _exclude_rated(db, imdb_ids)

    meta_rows = db.query(TitleMetadata).filter(TitleMetadata.imdb_title_id.in_(imdb_ids)).all()
    meta_by_id = {m.imdb_title_id: m for m in meta_rows}
    matched_ids = set(meta_by_id.keys())

    favorites_by_role = _load_favorites_by_role(db)
    signals = load_taste_signals(db)

    scored = []
    for imdb_id in matched_ids:
        meta = meta_by_id[imdb_id]
        cat = lookup.get(imdb_id, {})

        boost, matches = compute_favorite_boost(
            meta.actors, meta.directors, meta.writer, favorites_by_role
        )
        fit_score, explanation = score_watchlist_item(
            imdb_id, meta.genres, meta.country, meta.year, meta.directors, matches, signals
        )
        total = fit_score + boost * 2

        if is_britbox and _has_uk_origin(meta.country):
            total += 3

        scored.append({
            "imdb_title_id": imdb_id,
            "title": meta.title or cat.get("title") or imdb_id,
            "year": meta.year or cat.get("year"),
            "title_type": (cat.get("object_type") or "").capitalize() or meta.title_type,
            "poster": meta.poster if meta.poster and meta.poster != "N/A" else None,
            "explanation": explanation,
            "_score": total,
        })

    scored.sort(key=lambda x: -x["_score"])
    top = scored[:limit]
    for item in top:
        del item["_score"]

    return {
        "provider": provider_slug,
        "provider_name": catalog.get("provider_clear_name", provider_slug),
        "fetched_at": catalog.get("fetched_at"),
        "catalog_stats": {
            "total_in_catalog": catalog.get("stats", {}).get("total", 0),
            "with_imdb_id": len(all_imdb_ids),
            "matched_metadata": len(matched_ids),
            "unmatched": len(imdb_ids) - len(matched_ids),
            "already_rated": rated_count,
        },
        "items": top,
    }


def _build_provider_candidates(db: Session, imdb_ids: set[str]) -> pd.DataFrame:
    """Build ML feature DataFrame for a set of IMDb IDs from TitleMetadata."""
    from app.models.favorite_list_item import FavoriteListItem

    rows = (
        db.query(
            TitleMetadata.imdb_title_id,
            TitleMetadata.title,
            TitleMetadata.title_type,
            TitleMetadata.year,
            TitleMetadata.genres,
            TitleMetadata.country,
            TitleMetadata.languages,
            TitleMetadata.directors,
            TitleMetadata.actors,
            TitleMetadata.writer,
        )
        .filter(TitleMetadata.imdb_title_id.in_(imdb_ids))
        .all()
    )

    fav_ids = {r.imdb_title_id for r in db.query(FavoriteListItem.imdb_title_id).all()}
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


def get_provider_ml(
    db: Session,
    provider_slug: str = "britbox-us",
    limit: int = 15,
    exclude_rated: bool = True,
    title_type: str | None = None,
) -> dict:
    import warnings

    import joblib
    from app.ml.features import MODELS_DIR, build_feature_matrix

    warnings.filterwarnings("ignore", message="unknown class")

    catalog = load_catalog(provider_slug)
    if catalog is None:
        msg = "BritBox catalog snapshot is not available."
        if settings.DEBUG:
            msg += " Run: cd backend && python -m app.scripts.fetch_britbox_catalog"
        return {"error": "no_catalog", "message": msg}

    model_path = MODELS_DIR / "8plus_baseline_model.joblib"
    artifact_path = MODELS_DIR / "8plus_baseline_artifacts.joblib"
    base_resp = {
        "provider": provider_slug,
        "provider_name": catalog.get("provider_clear_name", provider_slug),
        "fetched_at": catalog.get("fetched_at"),
    }

    if not model_path.exists() or not artifact_path.exists():
        return {**base_resp, "items": [], "model_available": False, "catalog_stats": {}}

    all_imdb_ids = get_catalog_imdb_ids(catalog)
    lookup = _catalog_lookup(catalog)
    imdb_ids = _filter_by_type(all_imdb_ids, lookup, title_type)

    rated_count = 0
    if exclude_rated:
        imdb_ids, rated_count = _exclude_rated(db, imdb_ids)

    df = _build_provider_candidates(db, imdb_ids)
    if len(df) == 0:
        return {**base_resp, "items": [], "model_available": True, "catalog_stats": {"matched_metadata": 0}}

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
        },
        "items": results,
        "model_available": True,
    }
