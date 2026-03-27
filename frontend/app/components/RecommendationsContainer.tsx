"use client";

import { useState } from "react";
import {
  CATALOG_PROVIDERS,
  catalogProviderByModeId,
  isCatalogProviderMode,
  type CatalogProviderModeId,
} from "../config/catalogProviders";
import {
  RecommendationMode,
  RecommendationModeSwitcher,
} from "./RecommendationModeSwitcher";
import { SectionHelp } from "./SectionHelp";
import { HighFitWatchlist } from "./HighFitWatchlist";
import { LLMWatchlistSearch } from "./LLMWatchlistSearch";
import { MLRecommendations } from "./MLRecommendations";
import { ProviderCatalogRecommendations } from "./ProviderCatalogRecommendations";
import { RecommendationComparison } from "./RecommendationComparison";
import { SimpleRecommendations } from "./SimpleRecommendations";
import { WatchlistRecommendations } from "./WatchlistRecommendations";
import { RECO_MODE_INTRO } from "./recommendationModeStyles";

const CATALOG_PROVIDER_NAMES = CATALOG_PROVIDERS.map((p) => p.label).join(" and ");

export function RecommendationsContainer() {
  const [mode, setMode] = useState<RecommendationMode>("for-you");

  return (
    <section aria-labelledby="home-recommendations-heading">
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--panel-bg)] p-4 shadow-sm sm:p-5">
        <div className="max-w-2xl border-l-2 border-[var(--accent)] pl-4 sm:pl-5">
          <h2 id="home-recommendations-heading" className="font-display text-[26px] font-medium leading-[1.2] tracking-[-0.02em] text-[var(--foreground)] sm:text-[30px]">
            Recommendations
            <SectionHelp title="How this works">
              <p>
                <strong>Favorites</strong> = 8+ you rated. <strong>Watchlist</strong> /{" "}
                <strong>High-Fit</strong> / <strong>ML</strong> rank or filter saved titles.{" "}
                <strong>Search</strong> is natural language over your list—grounded, no invented titles.{" "}
                <strong>{CATALOG_PROVIDER_NAMES}</strong> use streaming snapshots (not your watchlist as the pool).
              </p>
            </SectionHelp>
          </h2>
          <p className="mt-1.5 max-w-2xl text-[14px] leading-[1.5] text-[var(--muted)] sm:mt-2">
            What to watch next, grounded in your library—pick a mode; same data, different lenses.
          </p>
        </div>

        <div className="mt-5 sm:mt-6">
          <RecommendationModeSwitcher mode={mode} onChange={setMode} />
        </div>
        <div className="mt-5 min-h-[12rem] sm:mt-6">
          {mode === "for-you" && <SimpleRecommendations embedded />}
          {mode === "watchlist" && <WatchlistRecommendations embedded />}
          {mode === "high-fit" && <HighFitModeContent />}
          {mode === "ml" && <MLModeContent />}
          {mode === "ml" && <RecommendationComparison />}
          {mode === "search" && <LLMWatchlistSearch />}
          {isCatalogProviderMode(mode) && (
            <ProviderCatalogModeShell modeId={mode} />
          )}
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

function ProviderCatalogModeShell({ modeId }: { modeId: CatalogProviderModeId }) {
  const cfg = catalogProviderByModeId(modeId);
  return (
    <div>
      <p className={RECO_MODE_INTRO}>
        {cfg.intro}
        <SectionHelp title="How this works">
          <p>{cfg.helpPool}</p>
          <p className="text-[13px] leading-relaxed">
            Refresh:{" "}
            <code className="rounded border border-[var(--card-border)] bg-[var(--control-surface)] px-1.5 py-0.5 text-[12px] text-[var(--muted-soft)]">
              cd backend && {cfg.fetchModule}
            </code>
            {cfg.enrichModule ? (
              <>
                {" "}
                · Enrich gaps:{" "}
                <code className="rounded border border-[var(--card-border)] bg-[var(--control-surface)] px-1.5 py-0.5 text-[12px] text-[var(--muted-soft)]">
                  {cfg.enrichModule}
                </code>
              </>
            ) : null}
          </p>
        </SectionHelp>
      </p>
      <ProviderCatalogRecommendations provider={modeId} />
    </div>
  );
}
