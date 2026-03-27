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

function ModeTabButton({
  id,
  label,
  mode,
  onChange,
}: {
  id: RecommendationMode;
  label: string;
  mode: RecommendationMode;
  onChange: (mode: RecommendationMode) => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={mode === id}
      onClick={() => onChange(id)}
      className={`max-w-full shrink-0 rounded-md px-2.5 py-2 text-left text-[13px] leading-snug transition-colors sm:px-3.5 sm:py-2.5 sm:text-[14px] lg:px-4 ${
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
  );
}

export function RecommendationModeSwitcher({
  mode,
  onChange,
}: {
  mode: RecommendationMode;
  onChange: (mode: RecommendationMode) => void;
}) {
  return (
    <div className="flex w-full max-w-full flex-col gap-2.5 rounded-md border border-[var(--card-border)] bg-[var(--control-track-bg)] p-1 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-2 lg:gap-y-1.5">
      <div
        role="tablist"
        aria-label="Library recommendation modes"
        className="flex min-w-0 w-full flex-wrap gap-x-0.5 gap-y-1"
      >
        {BASE_MODES.map(({ id, label }) => (
          <ModeTabButton
            key={id}
            id={id}
            label={label}
            mode={mode}
            onChange={onChange}
          />
        ))}
      </div>

      <div
        role="group"
        aria-label="Catalog providers"
        className="flex min-w-0 w-full flex-col gap-2 border-t border-[var(--card-border)]/55 pt-2 lg:flex-1 lg:flex-row lg:items-center lg:gap-2 lg:border-l lg:border-t-0 lg:pt-0 lg:pl-2.5"
      >
        <span className="shrink-0 pl-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted-soft)] lg:pl-0">
          Providers
        </span>
        <div
          role="tablist"
          aria-label="Catalog providers"
          className="flex min-w-0 w-full flex-wrap gap-x-0.5 gap-y-1"
        >
          {CATALOG_PROVIDERS.map((p) => (
            <ModeTabButton
              key={p.modeId}
              id={p.modeId}
              label={p.label}
              mode={mode}
              onChange={onChange}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
