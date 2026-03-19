"use client";

/**
 * Segmented control for recommendation modes.
 * To add ML, Similarity, AI Search: extend RecommendationMode and MODES,
 * then add the corresponding content block in RecommendationsContainer.
 */
export type RecommendationMode = "for-you" | "watchlist" | "high-fit";
// Future: "ml" | "similarity" | "ai-search"

export const MODES: { id: RecommendationMode; label: string }[] = [
  { id: "for-you", label: "Explore your favorites" },
  { id: "watchlist", label: "Watchlist" },
  { id: "high-fit", label: "High-Fit" },
];

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
      className="inline-flex rounded-lg border border-[var(--section-border)] bg-[var(--section-bg)] p-0.5"
    >
      {MODES.map(({ id, label }) => (
        <button
          key={id}
          role="tab"
          aria-selected={mode === id}
          onClick={() => onChange(id)}
          className={`rounded-md px-4 py-2 text-[14px] font-medium transition-colors ${
            mode === id
              ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm"
              : "text-[var(--muted-soft)] hover:text-[var(--foreground)]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
