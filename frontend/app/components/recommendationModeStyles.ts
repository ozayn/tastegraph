/**
 * Shared layout + copy styling for home recommendation modes (embedded in RecommendationsContainer).
 * Keeps rhythm: intro → controls well → loading / secondary line → results grid.
 */

/** Intro paragraph under mode tabs (width, size, color, bottom margin). */
export const RECO_MODE_INTRO =
  "mb-4 max-w-2xl text-[14px] leading-[1.5] text-[var(--muted)]";

/** Same typography without margin (e.g. Search intro beside scope toggle). */
export const RECO_MODE_INTRO_TEXT =
  "max-w-2xl text-[14px] leading-[1.5] text-[var(--muted)]";

/** Dashed control well — matches RecommendationPoolFiltersBar default shell. */
export const RECO_CONTROLS_WELL =
  "rounded-lg border border-dashed border-[var(--card-border)] bg-[var(--control-track-bg)] px-3 py-3";

/** Loading row below controls (or below intro when there are no filters). */
export const RECO_LOADING_ROW =
  "mt-5 flex items-center gap-2.5 text-[14px] text-[var(--muted)]";

export const RECO_LOADING_DOT =
  "inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--muted-soft)]";

/** Grid only (no top margin) — use inside stacks that already separate blocks. */
export const RECO_RESULTS_GRID = "grid gap-5 sm:gap-6";

/** Results list: spacing from controls / secondary content. */
export const RECO_RESULTS_LIST = `mt-5 ${RECO_RESULTS_GRID}`;

/** Empty / no-results dashed panel (with top margin). */
export const RECO_EMPTY_PANEL =
  "mt-5 rounded-lg border border-dashed border-[var(--card-border)] bg-[var(--control-track-bg)] py-8 text-center text-[14px] text-[var(--muted)]";

/** Dashed empty state without extra top margin (nested in spaced stacks). */
export const RECO_EMPTY_PANEL_FLAT =
  "rounded-lg border border-dashed border-[var(--card-border)] bg-[var(--control-track-bg)] py-8 text-center text-[14px] text-[var(--muted)]";

/** Line under filters (e.g. deterministic explanation from API). */
export const RECO_SECONDARY_LINE =
  "mt-5 text-[14px] leading-[1.6] text-[var(--muted)]";

/** Plain empty message (no dashed box), same type scale as intro. */
export const RECO_EMPTY_MESSAGE = "mt-5 text-[14px] leading-[1.5] text-[var(--muted)]";

/** Body / empty copy without preset top margin (e.g. below stats banner). */
export const RECO_BODY_TEXT = "text-[14px] leading-[1.5] text-[var(--muted)]";
