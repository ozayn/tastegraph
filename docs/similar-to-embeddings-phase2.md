# Phase 2: Embedding-Based Similarity for "similar to X"

Design for adding semantic similarity to grounded Search mode when `similar_to` is present.

## Problem

Metadata/keyword-based similar_to ranking has hit its limit. Queries like "movies similar to The Lobster" or "movies similar to Black Mirror" still surface generic prestige films rather than conceptually similar titles. The system resolves titles correctly and uses plot word overlap, but broad genres (Drama, Crime) and country (UK) dominate. Semantic/concept-level similarity needs embeddings.

## Constraints

- **Grounded first**: Results only from real watchlist/rated data
- **Minimal**: No redesign of Search mode
- **Practical**: Fit existing architecture
- **Explicit constraints intact**: movie/series/decade/genre filters stay hard

---

## 1. What Text to Embed

| Option | Pros | Cons |
|--------|------|------|
| **Plot only** | Plot captures premise, tone, themes | Some titles have no/short plot |
| **Title + plot** | Title adds context; short fallback | Title alone is weak (e.g. "Black Mirror") |
| **Title + plot + genres** | Genres add structure | Genres can misrepresent concept-heavy titles |

**Recommendation: Title + plot (concatenated)**

- Format: `"{title}. {plot}"` with fallback to `"{title}"` when plot is missing
- Keep genres out of the embedding text — they are broad and often wrong for concept titles
- Plot is the primary semantic signal; title anchors identity
- Example: `"Black Mirror. An anthology series exploring a twisted, high-tech world..."`

---

## 2. Where Embeddings Are Stored / Generated

### Option A: New DB column on `title_metadata`

```python
# Alembic migration
embedding: Mapped[bytes | None]  # 1536 floats * 4 bytes = 6KB for OpenAI small
# Or: ARRAY(Float) in PostgreSQL, or pgvector extension
```

- **Pros**: One source of truth; joins natural; updates when metadata changes
- **Cons**: Migration; need batch job to backfill; pgvector or manual cosine in app

### Option B: Separate table `title_embeddings(imdb_title_id, embedding)`

- **Pros**: Clean separation; can rebuild without touching metadata
- **Cons**: Extra join; same migration complexity

### Option C: Precomputed artifact (NumPy/pickle/Parquet)

- **Pros**: No DB migration; easy to regenerate; can use memory-mapped files
- **Cons**: Must keep in sync with metadata; load at startup or on demand

**Recommendation: Option A or C**

- **Start with C** (artifact file) for Phase 2 — fastest path: no migration, easy iteration
- Store: `data/embeddings/title_embeddings.npy` (shape `(n, dim)`) + `title_ids.json` for ordering
- Or: SQLite `embeddings.db` with `imdb_title_id -> vector` for simple lookup
- **Later**: Move to DB column or pgvector if usage grows

### Generation

- **Batch script**: `scripts/generate_title_embeddings.py`
  - Query all `imdb_title_id` from `title_metadata` (or join with watchlist/ratings for smaller set)
  - For each: `embed(title + " " + plot)` or fallback to title
  - Write to artifact
- **On metadata change**: Regenerate embedding for that title (append/update in artifact or run full batch periodically)

---

## 3. How Ranking Would Work

### Current flow (simplified)

1. Parse intent (similar_to, title_type, etc.)
2. Resolve reference title → get metadata (genres, country, plot_words)
3. Query watchlist (with filters)
4. Score each item: `fit_score * taste_weight + plot_boost + similar_to_boost + recency`
5. Sort, return top N

### Phase 2 flow (additive)

1. **Resolve reference** (unchanged)
2. **Embed reference** (when similar_to present and embedding available):
   - Ref text = `"{resolved_title}. {plot}"` or title only
   - Call embedding API/model → `ref_embedding`
3. **Query watchlist** (unchanged)
4. **Score each item**:
   - Existing: `fit_score * taste_weight + plot_boost + similar_to_boost + recency`
   - **New**: `+ embedding_similarity(ref_embedding, candidate_embedding) * weight`
5. Sort, return top N

### Embedding similarity

- **Cosine similarity**: `np.dot(a, b) / (norm(a) * norm(b))` → [-1, 1], typically [0, 1] for text
- Scale into score band: e.g. `(cos_sim + 1) / 2` → [0, 1], then `* 3` so max +3 to total_score
- Or: `cos_sim * 2.5` ( cap contribution so metadata still matters)

### Blending rules

| Signal | Weight (when similar_to) | Rationale |
|--------|--------------------------|-----------|
| Embedding similarity | 2.0–3.0 | Primary semantic signal |
| Metadata similar_to_boost | existing (cap 5) | Genres, people, plot words still useful |
| Taste fit | 0.3 | Secondary |
| Mood plot match | 0.3x | Demoted when similar_to |
| Recency | 0.15 | Tie-breaker |

**Fallback**: If no embedding for ref or candidate → skip embedding term, use metadata-only (current behavior).

---

## 4. Minimal Phase 2 Implementation Plan

### Step 1: Embedding infrastructure (1–2 days)

- [ ] Add `openai` or `sentence_transformers` to backend deps
- [ ] Config: `EMBEDDING_MODEL` / `EMBEDDING_PROVIDER` (or use OpenAI-compatible endpoint)
- [ ] `app/services/embeddings.py`: `embed(text: str) -> list[float]`
- [ ] Optional: `embed_batch(texts: list[str])` for efficiency

### Step 2: Artifact generation (1 day)

- [ ] `scripts/generate_title_embeddings.py`:
  - Load titles with plot from `title_metadata` (optionally filter to watchlist+ratings IDs)
  - Build `title + " " + plot` for each
  - Call embed, store in `data/embeddings/title_embeddings.npz` (ids + vectors)
- [ ] Add to README: how to run, when to re-run (after metadata import)

### Step 3: Lookup helper (0.5 day)

- [ ] `app/services/embeddings.py`: `get_embedding(imdb_title_id: str) -> list[float] | None`
- [ ] `cosine_similarity(a, b) -> float`
- [ ] Load artifact at startup (or lazy-load on first similar_to query)

### Step 4: Integrate into llm_search (1 day)

- [ ] When `similar_to_signals` present and ref has `imdb_title_id`:
  - `ref_emb = get_embedding(ref_imdb_id)`
  - If None → skip (metadata-only path)
- [ ] In scoring loop: for each candidate with plot
  - `cand_emb = get_embedding(r.imdb_title_id)`
  - If None → no embedding term
  - `sim = cosine_similarity(ref_emb, cand_emb)`
  - `total_score += sim * 2.5` (tunable)
- [ ] Add `embedding_similarity` to explanation when used
- [ ] DEBUG: log when embedding used vs skipped

### Step 5: Regeneration on metadata change (optional)

- [ ] After enrichment script updates plot: mark title for re-embed, or
- [ ] Periodic full regeneration (e.g. nightly) if metadata changes often

---

## 5. Model / Provider Recommendations

### Option 1: OpenAI `text-embedding-3-small` (or `ada-002`)

- **Cost**: ~$0.02 / 1M tokens
- **Dim**: 1536 (small) or 3072 (large)
- **Pros**: Excellent quality; simple API; you may already have key
- **Cons**: API dependency; rate limits

### Option 2: Sentence Transformers (local)

- **Model**: `all-MiniLM-L6-v2` (384 dim) or `all-mpnet-base-v2` (768 dim)
- **Cost**: Free; runs on CPU/GPU
- **Pros**: No API; fast; good for plot similarity
- **Cons**: Extra dep (`sentence-transformers`); model download (~80–420 MB)

### Option 3: Groq / Cohere / Voyage

- Check if Groq offers embeddings (often inference-only)
- Cohere `embed-english-v3` is strong
- Voyage has good movie/domain models

**Recommendation**: Start with **OpenAI text-embedding-3-small** if you have an API key (unified with possible future OpenAI usage), or **sentence-transformers all-MiniLM-L6-v2** for zero external deps.

---

## Summary

| Decision | Choice |
|----------|--------|
| Text to embed | `title + " " + plot` |
| Storage | Artifact file `data/embeddings/title_embeddings.npz` |
| Generation | Batch script after metadata import |
| Ranking | Add `cos_sim * 2.5` to total_score when both ref and candidate have embeddings |
| Fallback | Metadata-only when embedding missing |
| Model | OpenAI `text-embedding-3-small` or `all-MiniLM-L6-v2` |

This keeps Phase 2 additive, grounded, and easy to tune or revert.
