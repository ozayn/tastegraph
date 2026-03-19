"""Predict 8+ likelihood for watchlist candidates.

Usage:
  cd backend && python -m app.ml.predict_8plus_baseline [--top N] [--explain]

Loads saved model if present, scores watchlist titles, prints top N.
"""

import argparse
import warnings

import joblib
import numpy as np

from app.ml.datasets import build_watchlist_candidates
from app.ml.features import MODELS_DIR, build_feature_matrix

# Suppress sklearn transform warnings for unseen categories (we filter them)
warnings.filterwarnings("ignore", message="unknown class")


def _top_contributing_features(X_scaled: np.ndarray, coef: np.ndarray, names: list[str], k: int = 3) -> list[tuple[str, float]]:
    """Return top k features contributing positively to the score for this row."""
    contrib = coef * X_scaled
    ranked = sorted(zip(names, contrib), key=lambda x: x[1], reverse=True)
    return [(n, c) for n, c in ranked[:k] if c > 0.01]


def main() -> None:
    parser = argparse.ArgumentParser(description="Predict 8+ likelihood for watchlist")
    parser.add_argument("--top", type=int, default=15, help="Number of top predictions to show")
    parser.add_argument("--explain", action="store_true", help="Show top contributing features per title")
    args = parser.parse_args()

    model_path = MODELS_DIR / "8plus_baseline_model.joblib"
    artifact_path = MODELS_DIR / "8plus_baseline_artifacts.joblib"

    if not model_path.exists() or not artifact_path.exists():
        print("No trained model found. Run: python -m app.ml.train_8plus_baseline")
        return

    print("Loading model and artifacts...")
    model = joblib.load(model_path)
    loaded = joblib.load(artifact_path)
    artifacts = loaded["artifacts"]

    print("Building watchlist candidates...")
    df = build_watchlist_candidates()
    if len(df) == 0:
        print("No unrated watchlist items.")
        return

    print("Building features...")
    X, _ = build_feature_matrix(
        df,
        genre_mlb=artifacts["genre_mlb"],
        country_mlb=artifacts["country_mlb"],
        decade_categories=artifacts["decade_categories"],
        title_type_categories=artifacts["title_type_categories"],
        fit=False,
    )

    # Support both Pipeline (new) and raw LogisticRegression (legacy)
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

    top = df.head(args.top)
    print(f"\nTop {args.top} predicted 8+ likelihood:")
    print("-" * 70)
    for idx, row in top.iterrows():
        title = (row.get("title") or "").strip() or row["imdb_title_id"]
        year = row.get("year", "")
        year_str = f" ({int(year)})" if year and not (isinstance(year, float) and np.isnan(year)) else ""
        prob = row["prob_8plus"]
        print(f"\n  {prob:.2f}  {title}{year_str}")
        print(f"      {row['imdb_title_id']}  |  {row.get('genres', '')[:50]}")
        if args.explain and names:
            contribs = _top_contributing_features(X_for_pred[idx], coef, names, k=3)
            if contribs:
                parts = [f"{n}({c:.2f})" for n, c in contribs]
                print(f"      → {', '.join(parts)}")

    # Brief assessment
    tt = top["title_type"].fillna("").astype(str)
    short_doc_anim = tt.str.contains("Short|Documentary|Animation", case=False, na=False).sum()
    if short_doc_anim >= len(top) * 0.5:
        print(f"\n  Note: Top predictions are {short_doc_anim}/{len(top)} Short/Documentary/Animation. Model may overweight these types.")


if __name__ == "__main__":
    main()
