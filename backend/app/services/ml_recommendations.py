"""ML-based watchlist recommendations: 8+ likelihood model."""

import warnings
from pathlib import Path

import joblib
import numpy as np

from app.ml.datasets import build_watchlist_candidates
from app.ml.features import MODELS_DIR, build_feature_matrix
from app.services.recommendation_filters import (
    WATCHLIST_RECENCY_WEIGHT_ML_PROB,
    any_recommendation_filter_active,
    default_watchlist_recency_fraction,
    normalize_year_value,
    parse_decade_bounds,
    pool_row_matches_filters,
    resolve_similar_to_genre_set,
)

warnings.filterwarnings("ignore", message="unknown class")


def _top_contributing_features(
    X_scaled: np.ndarray, coef: np.ndarray, names: list[str], k: int = 3
) -> list[str]:
    """Return top k feature names contributing positively to the score."""
    if not names or len(names) != len(coef):
        return []
    contrib = coef * X_scaled
    ranked = sorted(zip(names, contrib), key=lambda x: x[1], reverse=True)
    return [n for n, c in ranked[:k] if c > 0.01]


def get_ml_watchlist_recommendations(
    db,
    limit: int = 15,
    *,
    decade: str | None = None,
    year_min: int | None = None,
    country: str | None = None,
    similar_to: str | None = None,
) -> list[dict] | None:
    """Score watchlist items with 8+ likelihood model. Returns None if model missing.

    Optional pool filters match :func:`recommendations_watchlist_high_fit` (pre-ranking only;
    model weights and scoring unchanged). When no pool filters are active, final ordering adds
    a small release-year term on top of ``prob_8plus`` (see ``default_watchlist_recency_fraction``).
    Returns list of dicts: imdb_title_id, title, year, title_type, prob_8plus, top_features.
    """
    model_path = MODELS_DIR / "8plus_baseline_model.joblib"
    artifact_path = MODELS_DIR / "8plus_baseline_artifacts.joblib"

    if not model_path.exists() or not artifact_path.exists():
        return None

    model = joblib.load(model_path)
    loaded = joblib.load(artifact_path)
    artifacts = loaded["artifacts"]

    decade_bounds = parse_decade_bounds(decade)
    ref_genres, _ = resolve_similar_to_genre_set(db, similar_to)
    filter_active = any_recommendation_filter_active(
        decade_bounds=decade_bounds,
        year_min=year_min,
        country_contains=country,
        ref_genres=ref_genres,
    )

    df = build_watchlist_candidates(db)
    if len(df) == 0:
        return []

    if filter_active:
        keep_mask = []
        for _, row in df.iterrows():
            y = normalize_year_value(row.get("year"))
            ok = pool_row_matches_filters(
                year=y,
                genres_csv=row.get("genres") if row.get("genres") else None,
                country=row.get("country") if row.get("country") else None,
                decade_bounds=decade_bounds,
                year_min=year_min,
                country_contains=country,
                ref_genres=ref_genres,
            )
            keep_mask.append(ok)
        df = df[keep_mask].reset_index(drop=True)
        if len(df) == 0:
            return []

    X, _ = build_feature_matrix(
        df,
        genre_mlb=artifacts["genre_mlb"],
        country_mlb=artifacts["country_mlb"],
        decade_categories=artifacts["decade_categories"],
        title_type_categories=artifacts["title_type_categories"],
        fit=False,
    )

    if hasattr(model, "named_steps"):
        X_for_pred = model.named_steps["scaler"].transform(X)
        lr = model.named_steps["clf"]
    else:
        X_for_pred = X
        lr = model

    proba = model.predict_proba(X_for_pred)[:, 1]
    df = df.copy()
    df["prob_8plus"] = proba
    # Default pool only: tiny release-year nudge on top of model prob (see recommendation_filters).
    if not filter_active:
        rf = df["year"].map(
            lambda y: default_watchlist_recency_fraction(normalize_year_value(y))
        )
        df["_rank"] = df["prob_8plus"] + WATCHLIST_RECENCY_WEIGHT_ML_PROB * rf
    else:
        df["_rank"] = df["prob_8plus"]
    df = df.sort_values("_rank", ascending=False, kind="mergesort").reset_index(drop=True)

    coef = lr.coef_[0]
    names = artifacts.get("feature_names", [])

    results = []
    for idx, row in df.head(limit).iterrows():
        top_feats = _top_contributing_features(
            X_for_pred[idx], coef, names, k=3
        ) if names else []
        y = row.get("year")
        year_val = None
        if y is not None and not (isinstance(y, float) and np.isnan(y)):
            try:
                year_val = int(y)
            except (ValueError, TypeError):
                pass

        results.append({
            "imdb_title_id": row["imdb_title_id"],
            "title": (row.get("title") or "").strip() or row["imdb_title_id"],
            "year": year_val,
            "title_type": row.get("title_type") or None,
            "prob_8plus": round(float(row["prob_8plus"]), 3),
            "top_features": top_feats,
        })
    return results
