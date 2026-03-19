"use client";

import { useState } from "react";
import {
  RecommendationMode,
  RecommendationModeSwitcher,
} from "./RecommendationModeSwitcher";
import { SectionHelp } from "./SectionHelp";
import { SimpleRecommendations } from "./SimpleRecommendations";
import { WatchlistRecommendations } from "./WatchlistRecommendations";
import { HighFitWatchlist } from "./HighFitWatchlist";

export function RecommendationsContainer() {
  const [mode, setMode] = useState<RecommendationMode>("for-you");

  return (
    <section className="rounded-xl border border-[var(--section-border)] bg-[var(--section-bg)] px-6 py-7 sm:px-8 sm:py-8">
      <div className="flex flex-col gap-6 sm:gap-7">
        <div>
          <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--foreground)] sm:text-[19px]">
            Recommendations
            <SectionHelp title="How this works">
              <p>Compare different strategies. <strong>Explore your favorites</strong> lets you browse titles you&apos;ve already rated 8+. <strong>Watchlist</strong> filters your saved titles by taste. <strong>High-Fit</strong> ranks unrated watchlist items by overlap with your strongest signals.</p>
              <p>More modes (ML, similarity, AI search) will appear here as they&apos;re added.</p>
            </SectionHelp>
          </h2>
          <p className="mt-1.5 text-[14px] leading-[1.5] text-[var(--muted-soft)]">
            Explore different ways to find what to watch
          </p>
        </div>

        <RecommendationModeSwitcher mode={mode} onChange={setMode} />

        <div className="min-h-[12rem]">
          {mode === "for-you" && <SimpleRecommendations embedded />}
          {mode === "watchlist" && <WatchlistRecommendations embedded />}
          {mode === "high-fit" && (
            <HighFitModeContent />
          )}
        </div>
      </div>
    </section>
  );
}

function HighFitModeContent() {
  return (
    <div>
      <p className="mb-4 text-[14px] leading-[1.5] text-[var(--muted-soft)]">
        Unrated watchlist items ranked by alignment with your 8+ taste signals. Each card explains why it fits.
        <SectionHelp title="How this works">
          <p>Items you saved but haven&apos;t rated, ranked by overlap with your <strong>8+ taste signals</strong>: genres, countries, decades, and creators that appear in titles you loved.</p>
          <p>Each card explains <em>why</em> it fits. Higher overlap suggests stronger fit, but it&apos;s heuristic—your next favorite might surprise you.</p>
        </SectionHelp>
      </p>
      <HighFitWatchlist />
    </div>
  );
}
