# TasteGraph Recommender Roadmap

A planning and architecture note for the recommender system: current status, ML/data-science methods in use, and recommended future work.

---

## 1. Current recommender status

The current system is:

- **Single-user** — All recommendations are for one user (you). No multi-user or collaborative data.
- **Content-based** — Recommendations are driven by item attributes (genres, country, directors, etc.) and how they match your taste profile.
- **Rule-based / weighted scoring** — No trained model. A fixed scoring formula adds points for each matching signal.
- **Interpretable** — Every recommendation can be explained: "Strong genre: Drama", "Favorite director: Yorgos Lanthimos", etc.
- **Not yet a trained recommender model** — No supervised learning, embeddings, or learned weights.

### Signals currently used

| Signal | Source | How it's used |
|--------|--------|---------------|
| Ratings | IMDb export | 8+ ratings define strong preferences; used to build taste profile |
| Watchlist | IMDb export | Candidate pool for watchlist recommendations |
| Favorite people | CSV (simple or IMDb-style) | Boost titles featuring these directors/actors/writers |
| Favorite list | IMDb list export | Genres, countries, decades merged into strong signals; titles excluded from underwatched candidates |
| Title metadata | OMDb | Country, genres, directors, actors, plot, poster for filtering and ranking |
| Strong genres | 8+ ratings + favorite list | Top 15 by count; match adds +2 to score |
| Strong countries | Lift-based | Only countries where 8+ rate exceeds baseline (lift > 1.01); min 5 titles |
| Strong decades | 8+ ratings + favorite list | Top 10 by count; match adds +1 |
| Strong directors | 8+ ratings | Directors with ≥2 titles rated 8+; match adds +2 |
| Favorite people weighting | Manual list | Director +3, writer +2, actor +1 |
| Support thresholds | Various | Min 5–15 titles per feature to avoid one-off noise |

### What each recommendation section does

**Homepage — Recommendations for you** — Titles you rated 8+, filtered by genre/country/type/year. Sorted by rating and date. Favorite-people matches add a small boost. Explanations cite genres, country, decade, and favorite people.

**Homepage — From your watchlist** — Unrated watchlist titles matching your filters. Favorite-people matches boost ranking. Sorted by that boost, then by list position.

**Underwatched high-fit watchlist** — Unrated watchlist titles ranked by taste alignment. Excludes rated titles and favorite list titles. Scores by matching strong genres, countries, decades, favorite people, and strong directors. Each card shows chips explaining why it fits.

---

## 2. What ML / recommender techniques we are currently using

**Content-based recommendation** — We use item attributes (genres, country, directors, etc.) to match items to a user taste profile. No user–item interaction matrix.

**Heuristic weighted ranking** — A fixed formula assigns points per signal. No learned weights.

**Support-thresholded association analysis** — Lift-based logic (e.g. for countries) and minimum-support thresholds (e.g. 15 titles) to avoid spurious associations. This is association-rule style analysis, not a learned model.

**Explainable recommendation logic** — Every score component maps to a human-readable reason. No black box.

### What we are NOT using yet

- **Collaborative filtering** — No "users like you also liked" (single-user only).
- **Matrix factorization** — No latent factor model.
- **Learned embeddings** — No vector representations of titles or users.
- **Learning-to-rank** — No trained ranking model.
- **Supervised predictive recommender models** — No model trained to predict ratings or preferences.

---

## 3. Why the current system is still valuable

- **Interpretable** — Users see why each title was recommended. Good for trust and debugging.
- **Product-friendly** — Simple logic, fast, no training pipeline.
- **Strong for single-user data** — Collaborative filtering needs many users; content-based works well with one user's history.
- **Good for feature engineering** — The current signals (genres, countries, directors, lift-based countries) are a solid feature set for future models.
- **Useful as a baseline** — Any learned model can be compared against this heuristic. Easy to A/B test.

---

## 4. Recommended roadmap for recommender-system learning and improvement

### Stage 1: Stronger content-based recommender

**Goal:** Replace or augment heuristic scoring with structured feature vectors and similarity.

**Approach:**
- Build item vectors from metadata (genres, country, decade, directors, etc.).
- Build a user taste profile from 8+ ratings, favorite list, and favorite people.
- Rank by cosine similarity or nearest-neighbor style matching.

**Why:** Keeps interpretability while moving toward a more principled content-based setup. Good stepping stone before supervised models.

### Stage 2: Supervised model for 8+ likelihood

**Goal:** Train a model to predict probability of rating 8+.

**Target:** Binary — rating ≥ 8 vs &lt; 8.

**Candidate models:** Logistic regression, tree-based (e.g. XGBoost).

**Features:** Metadata (genres, country, decade, directors) plus taste-derived features (overlap with strong genres, favorite-people match, etc.).

**Why:** Strong for portfolio/interview use. Interpretable (especially logistic regression). Directly optimizes the "will I like this?" question.

### Stage 3: Blend heuristic + learned score

**Goal:** Combine rule-based score and model score.

**Approach:** Weighted blend (e.g. 0.5 × heuristic + 0.5 × model probability). Or use model score for ranking and heuristic for explanation.

**Why:** Preserves explainability while improving ranking. Reduces risk of model-only ranking that’s hard to debug.

### Stage 4: Optional later directions

- **Learning-to-rank** — Train a model to order pairs or lists.
- **Embedding-based search** — Use plot text embeddings for semantic similarity.
- **Collaborative filtering** — Only if multi-user data ever exists.

---

## 5. Proposed first ML model for this project

**Best first model:** A simple interpretable classifier for whether a title is likely to receive an 8+ rating.

**Target:** Binary — `rating >= 8` (1) vs `rating < 8` (0). Trained on rated titles only.

**Candidate feature groups:**
- Metadata: genres (one-hot or multi-hot), country, decade, title type, runtime.
- Taste overlap: count of strong-genre matches, strong-country match, strong-decade match.
- People: favorite-people match (any), strong-director match, director/actor count from metadata.
- Derived: overlap with favorite list genres/countries (for unrated candidates).

**Evaluation:** Train on historical ratings (e.g. 80/20 split by time or random). Metrics: AUC-ROC, precision@k, recall@k. Compare against heuristic baseline.

**Why this is the best next step:**
- Directly targets "will I like this?"
- Interpretable (logistic regression) or inspectable (tree-based).
- Reuses existing feature engineering.
- Strong portfolio story: "I built a content-based recommender, then added a supervised 8+ predictor."

---

## 6. LLM-powered watchlist search (next feature after this)

**Goal:** Natural-language search over the watchlist.

**Example queries:**
- "Show me slow psychological thrillers from Europe"
- "Movies in my watchlist similar to The Lobster"
- "Serious political dramas with high fit for me"
- "Which of my watchlist items match my favorite directors?"

### Recommended architecture: retrieval-first, not pure generation

**Principle:** Use structured metadata and taste signals first. The LLM translates user intent into structured filters/ranking hints. The LLM does not invent titles.

**Inputs for search:**
- Watchlist titles and metadata
- Favorite people, favorite list
- Current taste signals (strong genres, countries, decades, directors)
- Optional plot text when available

### Suggested Phase 1 design

1. User enters a natural-language query.
2. Backend parses the query into structured search intent (genres, countries, mood, "similar to X", "high fit", etc.).
3. Apply watchlist filtering and ranking using existing metadata and taste signals.
4. LLM generates a short explanation of why the returned items fit the query.

### Why this is better than a naive chatbot

- **Safer** — No hallucinated titles; results come from the real watchlist.
- **More accurate** — Ranking uses proven signals, not LLM memory.
- **Grounded** — All suggestions are in your data.
- **Portfolio-worthy** — Combines retrieval, structured ranking, and LLM explanation.

---

## 7. Suggested future AI/LLM roadmap

**Phase 1:** Natural-language search over watchlist using structured retrieval + LLM explanation. User query → structured intent → filter/rank → LLM explains results.

**Phase 2:** Semantic similarity using plot embeddings. "Similar to X" uses embedding distance, not just metadata overlap.

**Phase 3:** Conversational watchlist assistant. Multi-turn refinement: "Make it more recent", "Less violent", etc.

---

## 8. Recommended next implementation priority

1. **Document current recommender** — Done via `how-tastegraph-works.md` and this roadmap.
2. **Build 8+ likelihood model OR content-based similarity baseline** — First real ML step. The 8+ classifier is the most direct and interpretable.
3. **Add LLM-powered watchlist search** — Grounded retrieval layer with natural-language input and LLM-generated explanations.

---

## 9. Short summary

TasteGraph today is a single-user, content-based, rule-based recommender. It uses weighted scoring over metadata and taste signals (genres, countries, decades, directors, favorite people, favorite list) with support thresholds and lift-based country logic. It is interpretable and works well for one user's data, but it is not yet a trained ML model.

The smartest next steps are: (1) build an interpretable 8+ likelihood classifier as the first ML model, (2) optionally add content-based similarity as a baseline, and (3) add LLM-powered watchlist search as a retrieval-first feature that keeps results grounded in your data.
