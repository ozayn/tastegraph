"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { TasteGraphFlowchart } from "../components/TasteGraphFlowchart";
import {
  SlideOrScrollContainer,
  ViewModeToggle,
  type ViewMode,
} from "../components/SlideOrScrollView";

/**
 * Learn page: living project explanation.
 * Update when major recommender, ML, or LLM features are added.
 */

export default function LearnPage() {
  const [mode, setMode] = useState<ViewMode>("scroll");
  const [slideIndex, setSlideIndex] = useState(0);

  const handleModeChange = useCallback((m: ViewMode) => {
    setMode(m);
    if (m === "slide") setSlideIndex(0);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-10 sm:px-8 sm:pt-12 sm:pb-32 md:max-w-3xl md:px-10 md:pt-14 md:pb-40 lg:max-w-4xl lg:px-12">
        <header className="mb-10 sm:mb-12 md:mb-14">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-[24px] font-semibold tracking-tight text-[var(--foreground)] sm:text-[28px] md:text-[32px]">
                How it works
              </h1>
              <p className="mt-3 max-w-lg text-[15px] leading-[1.6] text-[var(--muted-soft)] sm:text-[16px]">
                TasteGraph&apos;s recommender logic, signals, and how to interpret results. Updated as the system evolves.
              </p>
            </div>
            <ViewModeToggle mode={mode} onModeChange={handleModeChange} className="shrink-0" />
          </div>
        </header>

        <SlideOrScrollContainer
          mode={mode}
          slideIndex={slideIndex}
          onSlideChange={setSlideIndex}
          ariaLabel="Learn slides"
          scrollClassName="space-y-14 sm:space-y-20"
        >
          {/* 0. How the pipeline works — flowchart */}
          <section>
            <h2 className="mb-6 text-[18px] font-semibold tracking-[-0.01em] text-[var(--foreground)] sm:text-[20px]">
              How the pipeline works
            </h2>
            <TasteGraphFlowchart />
            <p className="mt-6 text-[13px] leading-[1.55] text-[var(--muted-soft)]">
              Your library data (ratings, watchlist, metadata) feeds every mode on Home. High-Fit scores explicit overlap with taste signals; ML learns weights from your rated history; Search and catalogs add grounded retrieval and external snapshot pools.
            </p>
          </section>

          {/* 1. Recommendation modes on Home */}
          <section>
            <h2 className="mb-3 text-[18px] font-semibold tracking-[-0.01em] text-[var(--foreground)] sm:text-[20px]">
              1. Recommendation modes on Home
            </h2>
            <ul className="space-y-2.5 text-[14px] leading-[1.6] text-[var(--muted-soft)] list-disc pl-5">
              <li>
                <strong className="text-[var(--foreground)]">Explore your favorites</strong> — Titles you already rated 8+, browsable by genre, country, decade, and type. Not &quot;new&quot; picks; it&apos;s a filterable view of your strong favorites.
              </li>
              <li>
                <strong className="text-[var(--foreground)]">Watchlist</strong> — Unrated items you saved, filtered the same way. Optional &quot;include rated&quot; for comparison.
              </li>
              <li>
                <strong className="text-[var(--foreground)]">High-Fit</strong> — Rule-based taste alignment: overlap with genres, countries, decades, people, and lists derived from your 8+ history. Explainable scores and reasons per title.
              </li>
              <li>
                <strong className="text-[var(--foreground)]">ML</strong> — Same watchlist pool, ranked by a model that estimates <strong>P(rate 8+ | title)</strong> from your past ratings and metadata. Answers &quot;what might land as a strong favorite?&quot; rather than &quot;what matches these tags?&quot;
              </li>
              <li>
                <strong className="text-[var(--foreground)]">Search</strong> — Natural-language queries over <strong>your</strong> watchlist or watched titles only. Not open web search: results always come from rows already in your library.
              </li>
              <li>
                <strong className="text-[var(--foreground)]">BritBox · MUBI (Providers)</strong> — Separate tabs that rank titles from a <strong>provider catalog snapshot</strong> (e.g. from Watchmode), matched to your local <code>TitleMetadata</code>, then scored with the same taste machinery. High-Fit and ML are both available there as scoring styles (see below).
              </li>
            </ul>
          </section>

          {/* 1b. Provider catalogs */}
          <section>
            <h2 className="mb-3 text-[18px] font-semibold tracking-[-0.01em] text-[var(--foreground)] sm:text-[20px]">
              Provider catalogs (BritBox, MUBI)
            </h2>
            <div className="space-y-3 text-[14px] leading-[1.65] text-[var(--muted-soft)]">
              <p>
                These modes start from an on-disk snapshot of what&apos;s on the service—not your watchlist. Only titles with an IMDb id in the snapshot <em>and</em> matching rows in your database can be ranked. Decade, country, genre, type, and &quot;similar to&quot; narrow that pool before scoring.
              </p>
              <p>
                If a catalog title has no (or thin) local metadata, it contributes less to ranking and may not appear at all. Enrichment improves coverage; snapshots need periodic refresh to stay current with the real catalog.
              </p>
            </div>
          </section>

          {/* 1c. High-Fit vs ML */}
          <section>
            <h2 className="mb-3 text-[18px] font-semibold tracking-[-0.01em] text-[var(--foreground)] sm:text-[20px]">
              High-Fit vs ML (same system, different question)
            </h2>
            <div className="space-y-3 text-[14px] leading-[1.65] text-[var(--muted-soft)]">
              <p>
                <strong className="text-[var(--foreground)]">High-Fit</strong> is interpretable: fixed rules and bonuses for overlap with signals you can see (genres you love, lift-based countries, favorite people, etc.).
              </p>
              <p>
                <strong className="text-[var(--foreground)]">ML</strong> is a logistic model trained on which titles you actually rated 8+. It outputs a probability, not a story—use it when you want a learned ordering from history.
              </p>
              <p>
                On watchlist and on provider tabs, you can <strong>narrow the pool first</strong> (decade, country, genres, type, similar-to where offered), then switch between High-Fit and ML to rank inside that slice. Disagreement between the two is normal and informative.
              </p>
            </div>
          </section>

          {/* 1d. Signals: 8+ and 7 */}
          <section>
            <h2 className="mb-3 text-[18px] font-semibold tracking-[-0.01em] text-[var(--foreground)] sm:text-[20px]">
              Taste signals: 8+ and 7-rated titles
            </h2>
            <div className="space-y-3 text-[14px] leading-[1.65] text-[var(--muted-soft)]">
              <p>
                <strong className="text-[var(--foreground)]">8+</strong> remains the core definition of &quot;strong favorite&quot; for building genres, decades, lift-based countries, and most taste signals.
              </p>
              <p>
                <strong className="text-[var(--foreground)]">7</strong> is still a good rating—not a penalty. In some heuristic paths, titles you rated exactly <strong>7</strong> contribute a <em>softer</em> layer (smaller weights, separate caps) so overlap with &quot;things you found fine&quot; can nudge explanations and scores without diluting how 8+ signals are built.
              </p>
              <p>
                The watchlist <strong>ML</strong> model is still trained as binary <strong>8+ vs not</strong>; it does not treat 7 as a separate class. Watchlist, favorite people, favorite list, and enriched metadata round out the data. No collaborative filtering.
              </p>
            </div>
          </section>

          {/* 1e. Semantic similarity (similar to) */}
          <section>
            <h2 className="mb-3 text-[18px] font-semibold tracking-[-0.01em] text-[var(--foreground)] sm:text-[20px]">
              &quot;Similar to&quot; and embeddings
            </h2>
            <p className="text-[14px] leading-[1.65] text-[var(--muted-soft)]">
              When Search (or similar-to hints) resolve a real title in your data, optional <strong>title + plot embeddings</strong> add cosine-similarity scores on top of metadata and taste overlap. Hard filters (type, decade, etc.) still apply. If embeddings are missing, metadata-backed behavior still runs. Quality is improved over metadata-only for many queries, not perfect; fully personalized &quot;similar for me&quot; is still on the roadmap.
            </p>
          </section>

          {/* 2. Current ML snapshot */}
          <section>
            <h2 className="mb-4 text-[18px] font-semibold tracking-[-0.01em] text-[var(--foreground)] sm:text-[20px]">
              2. Current ML snapshot
            </h2>
            <div className="space-y-4 text-[14px] leading-[1.65] text-[var(--muted-soft)]">
              <div>
                <p className="font-medium text-[var(--foreground)]">What it is</p>
                <p className="mt-1">
                  Logistic regression on <strong>your rated history</strong>, target = rated 8+ vs not. Outputs <strong>P(rate 8+ | title)</strong> for candidates. Used on the <strong>Watchlist ML</strong> tab and, when the model files are present, as the <strong>ML</strong> scoring mode inside <strong>provider catalog</strong> tabs (same trained weights applied to catalog titles that have feature rows).
                </p>
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">Features</p>
                <p className="mt-1">Genres, countries, decade, title type (support-thresholded), plus taste flags such as favorite-people match and favorite-list membership.</p>
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">Not the same as Search similarity</p>
                <p className="mt-1">&quot;Similar to X&quot; in Search uses the embedding layer when available, not this classifier.</p>
              </div>
            </div>
            <p className="mt-4 text-[12px] text-[var(--muted-subtle)]">
              Train: <code className="text-[11px]">python -m app.ml.train_8plus_baseline</code>. Inspect coefficients and ML vs High-Fit overlap on{" "}
              <Link href="/model-lab" className="underline underline-offset-2 hover:text-[var(--foreground)]">Model Lab</Link>
              . Deeper reference: <code className="text-[11px]">docs/ml-current-snapshot.md</code>.
            </p>
          </section>

          {/* 3. How to interpret results */}
          <section>
            <h2 className="mb-3 text-[18px] font-semibold tracking-[-0.01em] text-[var(--foreground)] sm:text-[20px]">
              3. How to interpret results
            </h2>
            <div className="space-y-4 text-[14px] leading-[1.65] text-[var(--muted-soft)]">
              <div>
                <p className="font-medium text-[var(--foreground)]">Heuristic / High-Fit</p>
                <p className="mt-1">Higher overlap with your signals usually means a better <em>story</em> for why something fits—not a guarantee you&apos;ll rate it 8+.</p>
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">ML probabilities</p>
                <p className="mt-1">Treat percentages as <strong>ordering hints</strong> from past behavior, not promises. The model is binary (8+ vs not) and metadata-sparse rows score weaker.</p>
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">Studies / lift</p>
                <p className="mt-1">Lift compares your 8+ rate when a feature appears to your overall 8+ rate. Min-support cuts noise. Association ≠ causation.</p>
              </div>
            </div>
          </section>

          {/* 4. How Search works */}
          <section>
            <h2 className="mb-4 text-[18px] font-semibold tracking-[-0.01em] text-[var(--foreground)] sm:text-[20px]">
              4. How Search works
            </h2>
            <ol className="space-y-2.5 text-[14px] leading-[1.65] text-[var(--muted-soft)] list-decimal pl-5">
              <li><strong className="text-[var(--foreground)]">Scope</strong> — Watchlist or Watched only. Nothing outside your imported library.</li>
              <li><strong className="text-[var(--foreground)]">UI pool</strong> — You can optionally constrain by <strong>release decade</strong> before search runs; that limit applies regardless of wording in the query.</li>
              <li><strong className="text-[var(--foreground)]">Intent</strong> — Groq maps text to filters (genres, countries, type, similar-to, min rating on watched, etc.). If <code>GROQ_API_KEY</code> is missing, a heuristic fallback still searches your data.</li>
              <li><strong className="text-[var(--foreground)]">Similar-to</strong> — Resolves to a real title, then blends metadata/taste overlap with embedding cosine similarity when artifacts exist.</li>
              <li><strong className="text-[var(--foreground)]">Output</strong> — Ranked rows from your DB, with explanations drawn from real metadata. Not a web-wide or open-ended chat.</li>
            </ol>
          </section>

          {/* 5. Where things live */}
          <section>
            <h2 className="mb-3 text-[18px] font-semibold tracking-[-0.01em] text-[var(--foreground)] sm:text-[20px]">
              5. Where else to look
            </h2>
            <ul className="space-y-1.5 text-[14px] leading-[1.5] text-[var(--muted-soft)] list-disc pl-5">
              <li><strong className="text-[var(--foreground)]">Insights &amp; Studies</strong> — Distributions, evolution, lift, and creator stats from your ratings and watchlist.</li>
              <li><strong className="text-[var(--foreground)]">Model Lab</strong> — ML diagnostics, coefficients, side-by-side ML vs High-Fit on watchlist, and notes on embeddings and catalog data.</li>
            </ul>
          </section>

          {/* 6. What&apos;s next (brief) */}
          <section>
            <h2 className="mb-3 text-[18px] font-semibold tracking-[-0.01em] text-[var(--foreground)] sm:text-[20px]">
              6. What&apos;s next
            </h2>
            <ul className="space-y-1.5 text-[14px] leading-[1.5] text-[var(--muted-soft)] list-disc pl-5">
              <li>Richer blending of semantic similarity with personal taste (&quot;similar for me&quot;)</li>
              <li>Stronger or additional models (e.g. ordinal / &quot;likely to enjoy&quot; targets) alongside today&apos;s 8+ baseline</li>
              <li>Tighter integration between Search ranking and catalog/provider modes where it makes sense</li>
            </ul>
          </section>

          <section className="pt-8 border-t border-[var(--section-border)]">
            <p className="text-[13px] text-[var(--muted-soft)]">
              <Link href="/model-lab" className="underline underline-offset-2 hover:text-[var(--foreground)]">Model Lab</Link> — coefficients, ML vs High-Fit comparison, embeddings notes, and catalog snapshot caveats.
            </p>
          </section>
        </SlideOrScrollContainer>
      </main>
    </div>
  );
}
