"use client";

import { useState } from "react";
import {
  RecommendationMode,
  RecommendationModeSwitcher,
} from "./RecommendationModeSwitcher";
import { SectionHelp } from "./SectionHelp";
import { HighFitWatchlist } from "./HighFitWatchlist";
import { LLMWatchlistSearch } from "./LLMWatchlistSearch";
import { MLRecommendations } from "./MLRecommendations";
import { RecommendationComparison } from "./RecommendationComparison";
import { SimpleRecommendations } from "./SimpleRecommendations";
import { WatchlistRecommendations } from "./WatchlistRecommendations";
import { BritBoxRecommendations } from "./BritBoxRecommendations";
import { RECO_MODE_INTRO } from "./recommendationModeStyles";

export function RecommendationsContainer() {
  const [mode, setMode] = useState<RecommendationMode>("for-you");

  return (
    <section aria-labelledby="home-recommendations-heading">
      <div className="flex flex-col gap-8 sm:gap-10">
        <div className="max-w-2xl border-l-2 border-[var(--accent)] pl-4 sm:pl-5">
          <h2 id="home-recommendations-heading" className="font-display text-[26px] font-medium leading-[1.2] tracking-[-0.02em] text-[var(--foreground)] sm:text-[30px]">
            Recommendations
            <SectionHelp title="How this works">
              <p>Compare different strategies. <strong>Explore your favorites</strong> lets you browse titles you&apos;ve already rated 8+. <strong>Watchlist</strong> filters your saved titles by taste. <strong>High-Fit</strong> ranks unrated watchlist items by overlap with your strongest signals. <strong>ML</strong> uses a logistic-regression model to predict 8+ likelihood. <strong>Search</strong> uses natural language over your watchlist—grounded, no invented titles.</p>
            </SectionHelp>
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)] sm:mt-2.5 sm:text-[16px]">
            Pick a mode and browse titles matched to your taste—same data, different lenses.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--panel-bg)] p-4 shadow-sm sm:p-5">
          <RecommendationModeSwitcher mode={mode} onChange={setMode} />
          <div className="mt-5 min-h-[12rem] sm:mt-6">
            {mode === "for-you" && <SimpleRecommendations embedded />}
            {mode === "watchlist" && <WatchlistRecommendations embedded />}
            {mode === "high-fit" && <HighFitModeContent />}
            {mode === "ml" && <MLModeContent />}
            {mode === "ml" && <RecommendationComparison />}
            {mode === "search" && <LLMWatchlistSearch />}
            {mode === "britbox" && <BritBoxModeContent />}
          </div>
        </div>
      </div>
    </section>
  );
}

function HighFitModeContent() {
  return (
    <div>
      <p className={RECO_MODE_INTRO}>
        Unrated watchlist items ranked by alignment with your 8+ taste signals. Each card explains why it fits. Use the pool filters to narrow by decade, country, or a title similar to one in your rated/watchlist data.
        <SectionHelp title="How this works">
          <p>Items you saved but haven&apos;t rated, ranked by overlap with your <strong>8+ taste signals</strong>: genres, countries, decades, and creators that appear in titles you loved.</p>
          <p>Each card explains <em>why</em> it fits. Higher overlap suggests stronger fit, but it&apos;s heuristic—your next favorite might surprise you.</p>
        </SectionHelp>
      </p>
      <HighFitWatchlist />
    </div>
  );
}

function MLModeContent() {
  return (
    <div>
      <p className={RECO_MODE_INTRO}>
        Ranked by estimated probability you would rate these 8+. Logistic-regression baseline on metadata and taste-derived features.
        <SectionHelp title="How this works">
          <p>Watchlist items scored by a model trained on your rated titles. <strong>Probability</strong> = estimated P(rate 8+ | title). Interpret as likelihood, not a guarantee.</p>
          <p>Requires a trained model. Run <code>python -m app.ml.train_8plus_baseline</code> in the backend if the model isn&apos;t available.</p>
        </SectionHelp>
      </p>
      <MLRecommendations />
    </div>
  );
}

function BritBoxModeContent() {
  return (
    <div>
      <p className={RECO_MODE_INTRO}>
        Full BritBox snapshot (series and films), ranked for you. Watchlist feeds taste only—those titles stay out of the list.
        <SectionHelp title="How this works">
          <p>Pool = the BritBox US snapshot, not your watchlist. Decade and similar-to narrow the pool before ranking.</p>
          <p>Refresh snapshot: <code>cd backend && python -m app.scripts.fetch_britbox_catalog</code></p>
        </SectionHelp>
      </p>
      <BritBoxRecommendations />
    </div>
  );
}
