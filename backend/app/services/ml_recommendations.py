"""ML-based watchlist recommendations: 8+ likelihood model."""

import warnings
from pathlib import Path

import joblib
import numpy as np

from app.ml.datasets import build_watchlist_candidates
from app.ml.features import MODELS_DIR, build_feature_matrix

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


def get_ml_watchlist_recommendations(db, limit: int = 15) -> list[dict] | None:
    """Score watchlist items with 8+ likelihood model. Returns None if model missing.

    Returns list of dicts: imdb_title_id, title, year, title_type, prob_8plus, top_features.
    """
    model_path = MODELS_DIR / "8plus_baseline_model.joblib"
    artifact_path = MODELS_DIR / "8plus_baseline_artifacts.joblib"

    if not model_path.exists() or not artifact_path.exists():
        return None

    model = joblib.load(model_path)
    loaded = joblib.load(artifact_path)
    artifacts = loaded["artifacts"]

    df = build_watchlist_candidates(db)
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
    df = df.sort_values("prob_8plus", ascending=False).reset_index(drop=True)

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
