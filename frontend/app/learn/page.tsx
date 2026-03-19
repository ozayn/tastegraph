"use client";

import Link from "next/link";

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
          {/* 0. How the pipeline works */}
          <section className="rounded-xl border border-[var(--section-border)] bg-[var(--section-bg)] px-5 py-5 sm:px-6 sm:py-6">
            <h2 className="mb-4 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              How the pipeline works
            </h2>
            <div className="space-y-0">
              {/* 1. Data sources */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <p className="w-24 shrink-0 text-[11px] font-medium uppercase tracking-wider text-[var(--overview-muted)]">1. Data</p>
                <div className="flex flex-wrap gap-1.5">
                  {["ratings", "watchlist", "favorite people", "favorite list", "title metadata"].map((label) => (
                    <span key={label} className="rounded-md border border-[var(--section-border)] bg-[var(--card-bg)] px-2 py-0.5 text-[12px] text-[var(--muted-soft)]">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="ml-6 h-3 w-px bg-[var(--section-border)] sm:ml-28" aria-hidden />
              {/* 2. Features */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                <p className="w-24 shrink-0 text-[11px] font-medium uppercase tracking-wider text-[var(--overview-muted)]">2. Features</p>
                <div className="flex flex-wrap gap-1.5">
                  {["genres", "countries", "decades", "title type", "favorite matches", "strong directors", "support-thresholded"].map((label) => (
                    <span key={label} className="rounded-md border border-[var(--section-border)] bg-[var(--card-bg)] px-2 py-0.5 text-[12px] text-[var(--muted-soft)]">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="ml-6 h-3 w-px bg-[var(--section-border)] sm:ml-28" aria-hidden />
              {/* 3. Recommendation paths */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                <p className="w-24 shrink-0 text-[11px] font-medium uppercase tracking-wider text-[var(--overview-muted)]">3. Paths</p>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-lg border border-[var(--section-border)] bg-[var(--card-bg)] px-2.5 py-1 text-[12px] font-medium text-[var(--foreground)]">High-Fit: rule-based</span>
                  <span className="rounded-lg border border-[var(--section-border)] bg-[var(--card-bg)] px-2.5 py-1 text-[12px] font-medium text-[var(--foreground)]">ML: P(8+)</span>
                  <span className="rounded-lg border border-[var(--section-border)] bg-[var(--card-bg)] px-2.5 py-1 text-[12px] text-[var(--muted-soft)]">Explore favorites</span>
                  <span className="rounded-lg border border-[var(--section-border)] bg-[var(--card-bg)] px-2.5 py-1 text-[12px] text-[var(--muted-soft)]">Watchlist</span>
                </div>
              </div>
              <div className="ml-6 h-3 w-px bg-[var(--section-border)] sm:ml-28" aria-hidden />
              {/* 4. Comparison */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <p className="w-24 shrink-0 text-[11px] font-medium uppercase tracking-wider text-[var(--overview-muted)]">4. Compare</p>
                <div className="flex flex-wrap gap-1.5">
                  {["overlap", "ML-only", "High-Fit-only", "coefficients", "explanations", "studies"].map((label) => (
                    <span key={label} className="rounded-md border border-[var(--section-border)] bg-[var(--card-bg)] px-2 py-0.5 text-[12px] text-[var(--muted-soft)]">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="ml-6 h-3 w-px bg-[var(--section-border)] sm:ml-28" aria-hidden />
              {/* 5. Outputs */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <p className="w-24 shrink-0 text-[11px] font-medium uppercase tracking-wider text-[var(--overview-muted)]">5. Outputs</p>
                <div className="flex flex-wrap gap-1.5">
                  {["homepage modes", "insights", "studies", "model lab"].map((label) => (
                    <span key={label} className="rounded-md border border-[var(--section-border)] bg-[var(--card-bg)] px-2 py-0.5 text-[12px] text-[var(--muted-soft)]">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-4 text-[13px] leading-[1.55] text-[var(--muted-soft)]">
              The same data feeds both heuristic and ML paths, which surface in different parts of the product—homepage recommendations, Insights, Studies, and Model Lab. High-Fit uses explicit overlap with your 8+ taste signals; ML learns weights from past ratings.
            </p>
            <p className="mt-2 text-[12px] text-[var(--muted-subtle)]">
              Future: similarity model, blended heuristic + ML, grounded LLM watchlist search.
            </p>
          </section>

          {/* 1. Current system */}
          <section>
            <h2 className="mb-3 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              1. Current system
            </h2>
            <div className="space-y-3 text-[14px] leading-[1.65] text-[var(--muted-soft)]">
              <p>
                <strong>Active recommendation methods:</strong> Explore your favorites (browse titles you&apos;ve already rated 8+). Watchlist and High-Fit use heuristic content-overlap. <strong>ML mode</strong> uses a logistic-regression model trained on your ratings to predict strong-favorite (8+) likelihood for watchlist items.
              </p>
              <p>
                <strong>Signals & data sources:</strong> Your IMDb ratings (8+ = strong positive / highly likely favorite; 7 is still a good rating). Watchlist, optional curated favorites list. Metadata: genres, countries, release decade, directors/actors/writers. No collaborative filtering—all from your own data.
              </p>
            </div>
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
                <p className="font-medium text-[var(--foreground)]">Future LLM search</p>
                <p className="mt-1">Natural-language queries and explanations planned. Will supplement, not replace, heuristic and ML signals.</p>
              </div>
            </div>
          </section>

          {/* 3. Recent additions */}
          <section>
            <h2 className="mb-3 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              3. Recent additions
            </h2>
            <ul className="space-y-1.5 text-[14px] leading-[1.5] text-[var(--muted-soft)] list-disc pl-5">
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
              <li>LLM search: natural-language queries over your library and watchlist</li>
              <li>LLM-generated &quot;why this fits&quot; explanations</li>
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
