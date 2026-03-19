"""Model Lab: internal endpoints for ML and recommender inspection. No auth."""

import joblib
from fastapi import APIRouter

from app.ml.features import MODELS_DIR

router = APIRouter(prefix="/model-lab", tags=["model-lab"])


def _group_coefficients(names: list[str], coef: list[float]) -> dict[str, list[tuple[str, float]]]:
    """Group (name, coef) by feature type for readability."""
    groups: dict[str, list[tuple[str, float]]] = {
        "genre": [],
        "country": [],
        "decade": [],
        "title_type": [],
        "taste": [],
        "other": [],
    }
    for n, c in zip(names, coef):
        if n.startswith("genre:"):
            groups["genre"].append((n.replace("genre:", ""), c))
        elif n.startswith("country:"):
            groups["country"].append((n.replace("country:", ""), c))
        elif n.startswith("decade:"):
            groups["decade"].append((n.replace("decade:", ""), c))
        elif n.startswith("title_type:"):
            groups["title_type"].append((n.replace("title_type:", ""), c))
        elif n in ("favorite_people_match", "in_favorite_list", "year"):
            groups["taste"].append((n, c))
        else:
            groups["other"].append((n, c))
    return {k: v for k, v in groups.items() if v}


@router.get("/ml-diagnostics")
def model_lab_ml_diagnostics():
    """ML model diagnostics for Model Lab. Internal use for understanding models and recommendation logic."""
    artifact_path = MODELS_DIR / "8plus_baseline_artifacts.joblib"
    if not artifact_path.exists():
        return {
            "available": False,
            "model_type": "logistic_regression",
            "target": "rating >= 8",
            "target_note": "8+ = strong favorites; 7 is still a good rating.",
            "message": "No trained model. Run: python -m app.ml.train_8plus_baseline",
        }

    loaded = joblib.load(artifact_path)
    artifacts = loaded.get("artifacts", {})
    model_path = MODELS_DIR / "8plus_baseline_model.joblib"
    if not model_path.exists():
        return {"available": False, "message": "Model file missing."}

    model = joblib.load(model_path)
    lr = model.named_steps["clf"] if hasattr(model, "named_steps") else model
    coef = lr.coef_[0].tolist()
    names = artifacts.get("feature_names", [])

    ranked = sorted(zip(names, coef), key=lambda x: x[1], reverse=True)
    top_positive = [{"name": n, "coef": round(c, 4)} for n, c in ranked[:15]]
    top_negative = [{"name": n, "coef": round(c, 4)} for n, c in ranked[-15:]]

    grouped = _group_coefficients(names, coef)
    grouped_positive = {
        k: [{"name": n, "coef": round(c, 4)} for n, c in sorted(v, key=lambda x: -x[1])[:8]]
        for k, v in grouped.items()
        if any(c > 0 for _, c in v)
    }
    grouped_negative = {
        k: [{"name": n, "coef": round(c, 4)} for n, c in sorted(v, key=lambda x: x[1])[:8]]
        for k, v in grouped.items()
        if any(c < 0 for _, c in v)
    }

    return {
        "available": True,
        "model_type": "logistic_regression",
        "target": "rating >= 8",
        "target_note": "8+ = strong favorites; 7 is still a good rating.",
        "dataset_stats": loaded.get("dataset_stats"),
        "eval_metrics": loaded.get("eval_metrics"),
        "feature_count": loaded.get("feature_dim", len(names)),
        "top_positive": top_positive,
        "top_negative": top_negative,
        "grouped_positive": grouped_positive,
        "grouped_negative": grouped_negative,
        "training_notes": "Min-support filters sparse categories (countries: 5, genres: 3). Association ≠ causation.",
    }
