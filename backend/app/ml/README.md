# ML Workspace

First baseline: **8+ likelihood model** — predicts likelihood of a strong favorite (8+).

## Target

- `target = 1` if `user_rating >= 8`, else `0`
- 8+ = strong positive / highly likely favorite. 7 is still a good rating—not a negative judgment.
- Trained on rated titles only

## Future model directions

- 7+ model for "likely to like" (broader than strong favorites)
- Multi-tier / ordinal rating model

## Run locally

**Train:**
```bash
cd backend && python -m app.ml.train_8plus_baseline
```

**Predict (score watchlist):**
```bash
cd backend && python -m app.ml.predict_8plus_baseline --top 15
```

## Artifacts

- `backend/data/ml/models/` — saved model and feature artifacts
- `backend/data/ml/outputs/` — for future outputs (e.g. evaluation reports)

Add `data/ml/models/*.joblib` to `.gitignore` if you don't want to commit trained models.

## Extending

- `datasets.py` — add more raw fields
- `features.py` — add feature groups, tune vectorizers
- `train_8plus_baseline.py` — try other models (e.g. XGBoost), cross-validation
- `predict_8plus_baseline.py` — integrate into API when ready
