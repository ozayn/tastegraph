"use client";

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
          {/* 1. Current system */}
          <section>
            <h2 className="mb-3 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              1. Current system
            </h2>
            <div className="space-y-3 text-[14px] leading-[1.65] text-[var(--muted-soft)]">
              <p>
                <strong>Active recommendation methods:</strong> Heuristic content-overlap only. Explore your favorites lets you browse titles you&apos;ve already rated 8+ (exploration, not discovery). High-fit watchlist ranks unrated watchlist items by overlap with your strongest taste signals.
              </p>
              <p>
                <strong>Signals & data sources:</strong> Your IMDb ratings (8+ as strong signal), watchlist, optional curated favorites list. Metadata: genres, countries, release decade, directors/actors/writers. No collaborative filtering—all from your own data.
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
                <p className="mt-1">Not yet integrated. When present: scores will indicate predicted P(rate 8+ | title). Interpret as likelihood, not certainty.</p>
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
              <li>Learning layer: &quot;How to read this&quot; help on key sections (Insights, Studies, recommendations)</li>
              <li>High-fit watchlist with explainable reasons per item</li>
              <li>Studies: taste evolution, 8+ predictors, genre combinations, favorite creators</li>
              <li>8+ likelihood model (train/predict scripts) in backend; not yet wired to API</li>
            </ul>
          </section>

          {/* 4. What&apos;s next */}
          <section>
            <h2 className="mb-3 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              4. What&apos;s next
            </h2>
            <ul className="space-y-1.5 text-[14px] leading-[1.5] text-[var(--muted-soft)] list-disc pl-5">
              <li>Integrate 8+ ML model into watchlist ranking and recommendations</li>
              <li>LLM search: natural-language queries over your library and watchlist</li>
              <li>LLM-generated &quot;why this fits&quot; explanations</li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
