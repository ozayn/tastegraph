"""Predict 8+ likelihood for watchlist candidates.

Usage:
  cd backend && python -m app.ml.predict_8plus_baseline [--top N]

Loads saved model if present, scores watchlist titles, prints top N.
"""

import argparse
from pathlib import Path

import joblib

from app.ml.datasets import build_watchlist_candidates
from app.ml.features import MODELS_DIR, build_feature_matrix


def main() -> None:
    parser = argparse.ArgumentParser(description="Predict 8+ likelihood for watchlist")
    parser.add_argument("--top", type=int, default=15, help="Number of top predictions to show")
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

    proba = model.predict_proba(X)[:, 1]
    df = df.copy()
    df["prob_8plus"] = proba
    df = df.sort_values("prob_8plus", ascending=False).reset_index(drop=True)

    top = df.head(args.top)
    print(f"\nTop {args.top} predicted 8+ likelihood:")
    print("-" * 60)
    for i, row in top.iterrows():
        title = row.get("title", row["imdb_title_id"])
        print(f"  {row['prob_8plus']:.2f}  {row['imdb_title_id']}  {row.get('year', '')}  {row.get('genres', '')[:40]}")


if __name__ == "__main__":
    main()
