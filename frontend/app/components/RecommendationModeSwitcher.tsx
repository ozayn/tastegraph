"use client";

/**
 * Segmented control for recommendation modes.
 * To add ML, Similarity, AI Search: extend RecommendationMode and MODES,
 * then add the corresponding content block in RecommendationsContainer.
 */
export type RecommendationMode = "for-you" | "watchlist" | "high-fit" | "ml" | "search";

export const MODES: { id: RecommendationMode; label: string }[] = [
  { id: "for-you", label: "Explore your favorites" },
  { id: "watchlist", label: "Watchlist" },
  { id: "high-fit", label: "High-Fit" },
  { id: "ml", label: "ML" },
  { id: "search", label: "Search" },
];

const MODE_ACCENT: Record<RecommendationMode, string> = {
  "for-you": "var(--mondrian-yellow)",
  watchlist: "var(--mondrian-yellow)",
  "high-fit": "var(--mondrian-red)",
  ml: "var(--mondrian-blue)",
  search: "var(--mondrian-yellow)",
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
      className="flex flex-wrap gap-1 rounded-lg border border-[var(--section-border)] bg-[var(--section-bg)] p-0.5"
    >
      {MODES.map(({ id, label }) => (
        <button
          key={id}
          role="tab"
          aria-selected={mode === id}
          onClick={() => onChange(id)}
          className={`shrink-0 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors sm:px-4 sm:py-2 sm:text-[14px] ${
            mode === id
              ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm"
              : "text-[var(--muted-soft)] hover:text-[var(--foreground)]"
          }`}
          style={
            mode === id
              ? { boxShadow: `inset 0 -2px 0 0 ${MODE_ACCENT[id]}` }
              : undefined
          }
        >
          {label}
        </button>
      ))}
    </div>
  );
}
