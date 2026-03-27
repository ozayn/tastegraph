"use client";

import {
  CATALOG_PROVIDERS,
  type CatalogProviderModeId,
} from "../config/catalogProviders";

/**
 * Segmented control for recommendation modes.
 * Catalog provider tabs are driven by CATALOG_PROVIDERS in ../config/catalogProviders.
 */
export type RecommendationMode =
  | "for-you"
  | "watchlist"
  | "high-fit"
  | "ml"
  | "search"
  | CatalogProviderModeId;

const BASE_MODES: { id: RecommendationMode; label: string }[] = [
  { id: "for-you", label: "Explore your favorites" },
  { id: "watchlist", label: "Watchlist" },
  { id: "high-fit", label: "High-Fit" },
  { id: "ml", label: "ML" },
  { id: "search", label: "Search" },
];

export const MODES: { id: RecommendationMode; label: string }[] = [
  ...BASE_MODES,
  ...CATALOG_PROVIDERS.map((p) => ({ id: p.modeId, label: p.label })),
];

const BASE_MODE_ACCENT: Partial<Record<RecommendationMode, string>> = {
  "for-you": "var(--mondrian-yellow)",
  watchlist: "var(--mondrian-yellow)",
  "high-fit": "var(--mondrian-red)",
  ml: "var(--mondrian-blue)",
  search: "var(--mondrian-yellow)",
};

export const MODE_ACCENT: Record<RecommendationMode, string> = {
  ...(BASE_MODE_ACCENT as Record<RecommendationMode, string>),
  ...Object.fromEntries(
    CATALOG_PROVIDERS.map((p) => [p.modeId, p.switcherAccentVar])
  ) as Record<CatalogProviderModeId, string>,
};

export function RecommendationModeSwitcher({
  mode,
  onChange,
}: {
  mode: RecommendationMode;
  onChange: (mode: RecommendationMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Recommendation mode"
      className="flex flex-wrap gap-1 rounded-md border border-[var(--card-border)] bg-[var(--control-track-bg)] p-0.5"
    >
      {MODES.map(({ id, label }) => (
        <button
          key={id}
          role="tab"
          aria-selected={mode === id}
          onClick={() => onChange(id)}
          className={`shrink-0 rounded-md px-3 py-2 text-[13px] transition-colors sm:px-4 sm:py-2.5 sm:text-[14px] ${
            mode === id
              ? "bg-[var(--control-surface)] font-semibold text-[var(--foreground)] shadow-sm ring-1 ring-[var(--card-border)]"
              : "font-medium text-[var(--muted)] hover:bg-[var(--card-hover)] hover:text-[var(--foreground)]"
          }`}
          style={
            mode === id
              ? { boxShadow: `inset 0 -3px 0 0 ${MODE_ACCENT[id]}` }
              : undefined
          }
        >
          {label}
        </button>
      ))}
    </div>
  );
}
