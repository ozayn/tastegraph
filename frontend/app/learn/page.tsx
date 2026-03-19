"use client";

export default function LearnPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-10 sm:px-8 sm:pt-12 sm:pb-32 md:max-w-3xl md:px-10 md:pt-14 md:pb-40 lg:max-w-4xl lg:px-12">
        <header className="mb-14 sm:mb-16 md:mb-20">
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--foreground)] sm:text-[28px] md:text-[32px]">
            How it works
          </h1>
          <p className="mt-3 max-w-lg text-[15px] leading-[1.6] text-[var(--muted-soft)] sm:text-[16px]">
            A brief overview of TasteGraph&apos;s recommender logic and analytical studies.
          </p>
        </header>

        <div className="space-y-12 sm:space-y-16">
          <section>
            <h2 className="mb-3 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              Current recommender (heuristic)
            </h2>
            <div className="space-y-3 text-[14px] leading-[1.65] text-[var(--muted-soft)]">
              <p>
                Recommendations are based on <strong>content overlap</strong> with your 8+ ratings: genres, countries, release decades, and favorite creators. No collaborative filtering—everything derives from your own ratings and watchlist.
              </p>
              <p>
                <strong>Simple recommendations</strong> filter from titles you rated 8+ by genre, country, and year. <strong>High-fit watchlist</strong> scores unrated watchlist items by how much they overlap with your strongest taste signals and explains why each item fits.
              </p>
              <p>
                Support thresholds (min n titles) filter out noisy signals. Association ≠ causation: a high lift for a genre means you tend to rate it higher, not that you will always love it.
              </p>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              Studies
            </h2>
            <div className="space-y-3 text-[14px] leading-[1.65] text-[var(--muted-soft)]">
              <p>
                <strong>Insights</strong> aggregate your viewing history: counts, averages, genres, countries, decades, and people. <strong>Studies</strong> go deeper: taste evolution over time, features associated with 8+ ratings (lift analysis), watchlist taste alignment, genre combinations, and favorite creators.
              </p>
              <p>
                All studies use your data only. Lift is computed as (8+ rate for a feature) ÷ (your global 8+ rate). Genre shifts compare first vs second half of your rating history to detect drift.
              </p>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              Future: ML and LLM
            </h2>
            <div className="space-y-3 text-[14px] leading-[1.65] text-[var(--muted-soft)]">
              <p>
                An <strong>8+ likelihood model</strong> (e.g. logistic regression on genre/country/decade features) is in development. It would predict P(rate 8+ | title) for watchlist items and could be used to rank or blend with heuristic scores.
              </p>
              <p>
                LLM-based explanations could generate natural-language &quot;why this fits&quot; summaries. Both would remain optional—the heuristic recommender is interpretable and works without training data.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
