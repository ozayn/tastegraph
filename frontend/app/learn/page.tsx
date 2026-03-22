"use client";

import Link from "next/link";
import { TasteGraphFlowchart } from "../components/TasteGraphFlowchart";

/**
 * Learn page: living project explanation.
 * Update when major recommender, ML, or LLM features are added.
 */

export default function LearnPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-10 sm:px-8 sm:pt-12 sm:pb-32 md:max-w-3xl md:px-10 md:pt-14 md:pb-40 lg:max-w-4xl lg:px-12">
        <header className="mb-14 sm:mb-16 md:mb-20">
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--foreground)] sm:text-[28px] md:text-[32px]">
            How it works
          </h1>
          <p className="mt-3 max-w-lg text-[15px] leading-[1.6] text-[var(--muted-soft)] sm:text-[16px]">
            TasteGraph&apos;s recommender logic, signals, and how to interpret results. Updated as the system evolves.
          </p>
        </header>

        <div className="space-y-12 sm:space-y-16">
          {/* 0. How the pipeline works — flowchart */}
          <section className="rounded-xl border border-[var(--section-border)] border-t-2 border-t-[var(--mondrian-yellow)] bg-[var(--section-bg)] px-5 py-6 sm:px-6 sm:py-8">
            <h2 className="mb-6 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              How the pipeline works
            </h2>
            <TasteGraphFlowchart />
            <p className="mt-6 text-[13px] leading-[1.55] text-[var(--muted-soft)]">
              The same data feeds both heuristic and ML paths, which surface across Home, Insights, Studies, and Model Lab. High-Fit uses explicit overlap with your 8+ taste signals; ML learns weights from past ratings.
            </p>
            <p className="mt-2 text-[12px] text-[var(--muted-subtle)]">
              Future: similarity model, blended heuristic + ML, grounded conversational assistant.
            </p>
          </section>

          {/* 1. Current system */}
          <section>
            <h2 className="mb-3 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              1. Current system
            </h2>
            <div className="space-y-3 text-[14px] leading-[1.65] text-[var(--muted-soft)]">
              <p>
                <strong>Active recommendation methods:</strong> Explore your favorites (browse titles you&apos;ve already rated 8+). Watchlist and High-Fit use heuristic content-overlap. <strong>ML mode</strong> uses a logistic-regression model trained on your ratings to predict strong-favorite (8+) likelihood for watchlist items. <strong>Search mode</strong> is grounded natural-language search over your real watchlist—Groq interprets your query into structured intent; the backend retrieves and ranks only from your actual data.
              </p>
              <p>
                <strong>Signals & data sources:</strong> Your IMDb ratings (8+ = strong positive / highly likely favorite; 7 is still a good rating). Watchlist, optional curated favorites list. Metadata: genres, countries, release decade, directors/actors/writers. No collaborative filtering—all from your own data.
              </p>
            </div>
          </section>

          {/* 1b. Current ML snapshot */}
          <section className="rounded-xl border border-[var(--section-border)] bg-[var(--section-bg)] px-5 py-5 sm:px-6 sm:py-6">
            <h2 className="mb-4 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              Current ML snapshot
            </h2>
            <div className="space-y-4 text-[14px] leading-[1.65] text-[var(--muted-soft)]">
              <div>
                <p className="font-medium text-[var(--foreground)]">What it is</p>
                <p className="mt-1">Logistic regression baseline. Predicts P(rate 8+ | title). Trained on your rated history. Used for ML recommendation mode.</p>
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">Features</p>
                <p className="mt-1">Genres, countries, decade, title type (min-support filtered). Taste flags: favorite_people_match, in_favorite_list.</p>
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">Good for</p>
                <p className="mt-1">Learned preference ranking. Interpretable coefficients. Contrast with heuristic High-Fit. Strong baseline for future blending.</p>
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">Not for</p>
                <p className="mt-1">Semantic similarity. &quot;Similar to X&quot; reasoning. Collaborative filtering. Full rating-scale nuance.</p>
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">Next step</p>
                <p className="mt-1">Current model answers &quot;what am I likely to rate 8+?&quot; The next model answers &quot;what is semantically similar to this?&quot; — a different question requiring embeddings.</p>
              </div>
            </div>
            <p className="mt-4 text-[12px] text-[var(--muted-subtle)]">
              See <Link href="/model-lab" className="underline underline-offset-2 hover:text-[var(--foreground)]">Model Lab</Link> for coefficients and comparison. Technical details in docs/ml-current-snapshot.md.
            </p>
          </section>

          {/* 2. How to interpret results */}
          <section>
            <h2 className="mb-3 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              2. How to interpret results
            </h2>
            <div className="space-y-4 text-[14px] leading-[1.65] text-[var(--muted-soft)]">
              <div>
                <p className="font-medium text-[var(--foreground)]">Heuristic recommendations</p>
                <p className="mt-1">Content overlap with your 8+ history. Higher overlap suggests stronger fit, but it&apos;s not predictive—your next favorite might surprise you.</p>
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">Studies / lift / support thresholds</p>
                <p className="mt-1">Lift = (8+ rate for a feature) ÷ (your global 8+ rate). Lift &gt; 1 means you tend to rate higher when that feature is present. Min-support filters out noisy small-n signals. Association ≠ causation.</p>
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">ML model outputs</p>
                <p className="mt-1">ML mode shows predicted P(rate 8+ | title) for watchlist items—i.e. likelihood of a strong favorite. 8+ means highly likely favorite; 7 is still a good rating, not a negative. Logistic-regression baseline on genres, countries, decade, title type, and taste-derived features. Interpret as likelihood, not certainty. Requires trained model (run <code>python -m app.ml.train_8plus_baseline</code>).</p>
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">Search mode</p>
                <p className="mt-1">Natural-language search over your <strong>watchlist</strong> or <strong>watched</strong> history. Groq parses your query into structured intent—genres, countries, decades, &quot;similar to&quot;, min rating (e.g. 8+). Retrieval is always from real data only. Watchlist: unrated items to discover. Watched: titles you&apos;ve rated (e.g. &quot;documentaries I rated 8+&quot;, &quot;movies from Japan in the 2000s&quot;). Requires <code>GROQ_API_KEY</code> in backend .env.</p>
              </div>
            </div>
          </section>

          {/* 2b. How Search works */}
          <section className="rounded-xl border border-[var(--section-border)] bg-[var(--section-bg)] px-5 py-6 sm:px-6 sm:py-8">
            <h2 className="mb-4 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              How Search works
            </h2>
            <ol className="space-y-3 text-[14px] leading-[1.65] text-[var(--muted-soft)] list-decimal pl-5">
              <li><strong className="text-[var(--foreground)]">Scope</strong> — Watchlist (unrated items) or Watched (your rated history).</li>
              <li><strong className="text-[var(--foreground)]">Interpretation</strong> — Groq turns the query into structured filters: genres, countries, decade, title type, similar-to, min rating (watched), disagreed-with-critics (watched).</li>
              <li><strong className="text-[var(--foreground)]">Retrieval</strong> — Backend queries IMDbWatchlistItem (watchlist) or IMDbRating (watched) with TitleMetadata. Only real rows; no invented titles.</li>
              <li><strong className="text-[var(--foreground)]">Similar-to</strong> — For &quot;similar to X&quot;, we look up X in ratings or watchlist and reuse its genres, country, decade as signals.</li>
              <li><strong className="text-[var(--foreground)]">Ranking</strong> — Items scored by metadata and taste signals (genre overlap, favorite directors, user rating).</li>
              <li><strong className="text-[var(--foreground)]">Explanations</strong> — Matched genres, countries, people—all from actual metadata.</li>
            </ol>
            <p className="mt-4 text-[13px] text-[var(--muted-subtle)]">
              <strong className="text-[var(--foreground)]">Reliability:</strong> The LLM does not invent titles. Results come only from your real data. If <code>GROQ_API_KEY</code> is missing, the system falls back to heuristic search. Retrieval-first design—not a freeform chatbot.
            </p>
          </section>

          {/* 3. Recent additions */}
          <section>
            <h2 className="mb-3 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              3. Recent additions
            </h2>
            <ul className="space-y-1.5 text-[14px] leading-[1.5] text-[var(--muted-soft)] list-disc pl-5">
              <li>LLM search: grounded natural-language search over watchlist and watched history</li>
              <li>ML recommendation mode: watchlist ranked by predicted 8+ probability</li>
              <li>Learning layer: &quot;How to read this&quot; help on key sections (Insights, Studies, recommendations)</li>
              <li>High-fit watchlist with explainable reasons per item</li>
              <li>Studies: taste evolution, 8+ predictors, genre combinations, favorite creators</li>
            </ul>
          </section>

          {/* 4. What&apos;s next */}
          <section>
            <h2 className="mb-3 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              4. What&apos;s next
            </h2>
            <ul className="space-y-1.5 text-[14px] leading-[1.5] text-[var(--muted-soft)] list-disc pl-5">
              <li>Search: semantic similarity, blended ML + search ranking, grounded conversational assistant</li>
              <li>Richer ML model (e.g. XGBoost, more features) and model comparison</li>
              <li>Alternative targets: 7+ model for &quot;likely to like&quot;; multi-tier / ordinal rating model</li>
            </ul>
          </section>

          <section className="pt-8 border-t border-[var(--section-border)]">
            <p className="text-[13px] text-[var(--muted-soft)]">
              <Link href="/model-lab" className="underline underline-offset-2 hover:text-[var(--foreground)]">Model Lab</Link> — internal page for inspecting ML coefficients, prediction comparison, and learning notes.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
