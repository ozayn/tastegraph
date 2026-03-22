# Current ML Snapshot

Technical reference for the existing ML recommender. For product understanding, resume use, and interview discussion.

---

## 1. What the current ML model is

- **Logistic regression baseline** — L2-regularized, class-weighted for imbalanced 8+ vs non-8+
- **Target:** Predicts probability of rating a title 8+ (strong favorite)
- **Training:** User's own rated history only (one row per rated title)
- **Output:** P(rate 8+ | title) for each watchlist item

---

## 2. Data and features

| Feature type | Source | Support threshold |
|--------------|--------|-------------------|
| Genres | Title metadata (multi-hot) | ≥3 titles |
| Countries | Enriched metadata (multi-hot) | ≥5 titles |
| Decade | Year (one-hot, e.g. 2010s) | ≥3 titles |
| Title type | movie, series, etc. (one-hot) | ≥3 titles |
| Year | Numeric (normalized) | — |
| favorite_people_match | Binary: has director/actor/writer in favorites | — |
| in_favorite_list | Binary: title in curated favorite list | — |

**Support thresholds** filter sparse categories — rare genres or countries with few titles get noisy coefficients, so they are excluded. This keeps the model stable and interpretable.

---

## 3. What it is good for

- **Learned preference ranking** — Weights derived from your past ratings, not hand-tuned rules
- **ML recommendation mode** — Watchlist ranked by predicted 8+ probability
- **Comparison with heuristic High-Fit** — ML vs rule-based overlap; disagreement is informative
- **Interpretable** — Inspectable coefficients; positive = associated with 8+, negative = less associated
- **Strong baseline** — Simple, fast, interpretable; good foundation for future blending

---

## 4. What it is not for

- **Not semantic similarity** — Cannot reason about "like The Lobster" conceptually; metadata only
- **Not "similar to X"** — No embedding or concept-level matching
- **Not collaborative filtering** — Single-user; no cross-user signals
- **Not a general-purpose recommender** — Trained on one user's data; not applicable to all users
- **Not a full rating-scale model** — Binary 8+ vs not; does not model 7 vs 8 vs 9+

---

## 5. Why it still matters

- **Strong baseline** — Competes with heuristic ranking; useful contrast
- **Interpretable ML layer** — Coefficients and top-features visible in Model Lab
- **Blending-ready** — Can be combined with heuristic scores or future similarity scores
- **Portfolio-ready** — Clean, honest, technically grounded explanation

---

## 6. Why the next ML step is different

| Current model | Next model |
|---------------|------------|
| Answers: "What am I likely to rate 8+?" | Answers: "What is semantically similar to this?" |
| Content-based: genres, countries, decade, type | Semantic: plot, concept, theme |
| Trained on your ratings | Uses embeddings / similarity search |
| Predicts preference from metadata overlap | Matches conceptual likeness |

The current model learns *your preferences* from metadata. The next model will capture *conceptual similarity* between titles (e.g. "movies like The Lobster") — a different question that requires embeddings or semantic signals.

---

## 7. Quick reference

- **Train:** `python -m app.ml.train_8plus_baseline`
- **Predict:** Used by `/recommendations/watchlist-ml`
- **Artifacts:** `backend/data/ml/models/`
- **Model Lab:** Coefficient inspection, ML vs High-Fit comparison
