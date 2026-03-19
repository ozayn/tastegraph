"""Train 8+ likelihood baseline (logistic regression).

Usage:
  cd backend && python -m app.ml.train_8plus_baseline

Saves model and artifacts to data/ml/models/
"""

from pathlib import Path

import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from app.ml.datasets import build_rated_dataset
from app.ml.features import MODELS_DIR, OUTPUTS_DIR, build_feature_matrix


def main() -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

    print("Building dataset...")
    df = build_rated_dataset()
    if len(df) < 20:
        print(f"Not enough rated titles ({len(df)}). Need at least 20 for training.")
        return

    y = df["target"].values
    print(f"Dataset: {len(df)} rows, {y.sum():.0f} positive (8+), {len(y) - y.sum():.0f} negative")

    print("Building features...")
    X, artifacts = build_feature_matrix(df, fit=True)
    print(f"Feature matrix: {X.shape}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print("Training logistic regression...")
    model = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(max_iter=2000, random_state=42, class_weight="balanced")),
    ])
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]
    acc = accuracy_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_proba) if len(np.unique(y_test)) > 1 else 0.0

    print(f"\nMetrics (test set):")
    print(f"  Accuracy: {acc:.3f}")
    print(f"  AUC-ROC:  {auc:.3f}")

    # Coefficient inspection (use underlying LR; coefs are post-scaler)
    lr = model.named_steps["clf"]
    coef = lr.coef_[0]
    names = artifacts["feature_names"]
    ranked = sorted(zip(names, coef), key=lambda x: x[1], reverse=True)
    print(f"\nTop 10 positive coefficients (predict 8+):")
    for name, c in ranked[:10]:
        print(f"  {c:+.3f}  {name}")
    print(f"\nTop 10 negative coefficients (predict <8):")
    for name, c in ranked[-10:]:
        print(f"  {c:+.3f}  {name}")

    # Brief sensibility check
    top_pos = [n for n, _ in ranked[:15]]
    if any("Short" in n or "Documentary" in n or "Animation" in n for n in top_pos):
        print("\n  Note: Documentary/Short/Animation appear in top positive features. Top predictions may skew toward these types.")

    # Save
    artifact_path = MODELS_DIR / "8plus_baseline_artifacts.joblib"
    model_path = MODELS_DIR / "8plus_baseline_model.joblib"
    joblib.dump({"artifacts": artifacts, "feature_dim": X.shape[1]}, artifact_path)
    joblib.dump(model, model_path)
    print(f"\nSaved to {MODELS_DIR}")


if __name__ == "__main__":
    main()
