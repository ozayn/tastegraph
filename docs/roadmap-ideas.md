# TasteGraph Roadmap & Ideas

Working ideas and next-steps list. Not polished marketing copy.

---

## 1. How TasteGraph Works Today

### Implemented
- **Grounded Search mode** — retrieval-first, only from watchlist/rated data
- **Groq-based query interpretation** — intent parsing for search
- **Watchlist search** — search within watchlist
- **Watched search** — search within rated titles
- **Prompt inspector** (dev only) — visibility into intent parsing
- **similar_to resolution/debugging** — improved reference-title resolution
- **Improved title-type handling** — movie/series/episode normalization
- **year_min / recency parsing** — e.g. "recent", "newer", "made after 2019"
- **Prompt-injection-resistant intent parsing** — validation, sanitization, clamping
- **Optional slide/scroll mode** — Studies and Insights (vertical scroll default)
- **Outgrew / grew into study** — early vs recent viewing share shifts (share-only, 5 per side)

---

## 2. Immediate Next Improvements

- Test search with a compact QA query set
- Expand structured metadata support in search (languages, runtime, maybe rated)
- Continue improving mobile responsiveness
- Cleaner hierarchy on Insights / Studies if needed

---

## 3. Similarity Search Recommendations

- Current metadata/keyword-based similar_to has limits
- Concept-heavy titles like *The Lobster* and *Black Mirror* expose those limits
- similar_to should rely less on generic metadata and more on semantic similarity
- Explicit user constraints (movie/series/decade/genre) should stay hard filters
- Reference-title resolution/debugging should remain visible in dev

---

## 4. Phase 2: Embedding-Based Similarity

See `docs/similar-to-embeddings-phase2.md` for full design. Summary:

- **Text to embed**: title + plot (concatenated), fallback to title when plot missing
- **Storage**: Artifact file first (no DB migration) — e.g. `data/embeddings/title_embeddings.npz`
- **Model**: Local sentence-transformers preferred first (`all-MiniLM-L6-v2`); OpenAI fallback
- **Fallback**: Metadata-only when embeddings missing
- **Usage**: Semantic similarity mainly for similar_to queries; add to scoring, keep explicit constraints strict
- **Debug**: Visibility for when embedding similarity is used vs skipped

---

## 5. Personal Similarity / "Similar for Me"

### Distinction
- **Standard similarity** — metadata, plot overlap, or semantic embeddings (generic)
- **Personal similarity** — what feels similar *to the user* may differ from generic signals

### Example
- *The Lobster* and *Two People Exchanging Saliva* may belong together for the user even if metadata does not strongly connect them

### Roadmap ideas
- "Similar by metadata" vs "Similar for me" as distinct modes
- Allow user to define small personal clusters of titles
- Cluster-based search: pick 2–5 titles and find watchlist items similar to that cluster
- Use favorites/canon/personal groupings as a future similarity signal

---

## 6. Study / Analytics Ideas

- **Outgrew / grew into** (implemented) — focus on significant viewing-share shifts, not rating detail
- Keep only the strongest directional changes (1+ pct point, max 5 per side)
- Continue favoring question-driven studies over generic descriptive dashboards

---

## 7. Design / UX Notes

- Keep vertical scrolling as default
- Optional slide mode is good for Studies (and Insights) — not a fully horizontal site
- Search should return fewer, stronger results by default
- Dev/debug visibility is valuable for prompt and similar_to behavior
- Maps make more sense for geographic coverage than for taste-signal precision

---

## 8. Suggested Prioritization

| When | Focus |
|------|-------|
| **Near term** | QA query set for search; expand metadata (languages, runtime); mobile tweaks |
| **Next** | Embedding infrastructure; artifact-based storage; integrate into similar_to scoring |
| **Later / exploratory** | Personal similarity; cluster-based search; favorites as similarity signal |
