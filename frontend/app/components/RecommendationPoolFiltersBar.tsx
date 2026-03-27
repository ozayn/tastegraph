"use client";

import { API_URL } from "../lib/api";
import { CountryMultiSelect } from "./CountryMultiSelect";

export type RecommendationPoolFilterValues = {
  decade: string;
  country: string;
  similarTo: string;
  /** Catalog provider API ``title_type``: ``movie`` | ``show`` | ``all``; empty omits param (watchlist). */
  titleType: string;
};

const INITIAL_FILTERS: RecommendationPoolFilterValues = {
  decade: "",
  country: "",
  similarTo: "",
  titleType: "",
};

export function getInitialPoolFilters(
  overrides?: Partial<RecommendationPoolFilterValues>
): RecommendationPoolFilterValues {
  return { ...INITIAL_FILTERS, ...overrides };
}

/** Query fragment for GET /recommendations/* pool endpoints (leading & if non-empty). */
export function poolFiltersToQueryString(
  f: RecommendationPoolFilterValues,
  opts?: {
    includeCountry?: boolean;
    includeDecade?: boolean;
  }
): string {
  const includeCountry = opts?.includeCountry !== false;
  const includeDecade = opts?.includeDecade !== false;
  const p = new URLSearchParams();
  if (includeDecade && f.decade.trim()) p.set("decade", f.decade.trim());
  if (includeCountry && f.country.trim()) p.set("country", f.country.trim());
  if (f.similarTo.trim()) p.set("similar_to", f.similarTo.trim());
  const tt = (f.titleType || "").trim().toLowerCase();
  if (tt === "movie" || tt === "show" || tt === "all") {
    p.set("title_type", tt);
  }
  const s = p.toString();
  return s ? `&${s}` : "";
}

/** Pool-bar select shell (MUBI/BritBox); text color added per control. */
const poolSelectShell =
  "w-full min-h-[2.75rem] rounded-lg border border-[var(--card-border)] bg-[var(--control-surface)] px-3 py-2.5 text-[14px] shadow-sm transition-colors focus:border-[var(--accent)]/45 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 [color-scheme:inherit]";

/** Exported for rare overrides; decade control applies muted/foreground based on value. */
export const recommendationDecadeFieldSelectClass = poolSelectShell;


/** Explore / Watchlist filter row (genre-style, no shadow). */
const simpleDecadeSelectBase =
  "min-w-[7rem] w-full rounded-lg border border-[var(--card-border)] bg-[var(--control-surface)] px-3 py-2.5 text-[14px] transition-colors focus:border-[var(--accent)]/45 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 [color-scheme:inherit] sm:min-w-[7rem]";

const DECADE_OPTION_VALUES = ["1980s", "1990s", "2000s", "2010s", "2020s"] as const;

const fieldInputBase =
  "min-h-[2.75rem] rounded-lg border border-[var(--card-border)] bg-[var(--control-surface)] px-3 py-2.5 text-[14px] text-[var(--foreground)] placeholder:text-[var(--muted-soft)] transition-colors focus:border-[var(--accent)]/45 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 [color-scheme:inherit]";

/** Similar-to row: can grow/shrink inside the column layout. */
const fieldInput = `${fieldInputBase} min-w-0 flex-1`;

const labelCls =
  "text-[10px] font-medium uppercase tracking-wide text-[var(--muted-soft)]";

const SIMILAR_PLACEHOLDER = "Title in your rated or watchlist data";

/** Shared decade control: label inside the field (like Genre), not above it. */
export function RecommendationDecadeSelect({
  idPrefix,
  value,
  onChange,
  disabled = false,
  className = "",
  variant = "pool",
  selectClassName = "",
}: {
  idPrefix: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  /** Extra classes on the outer wrapper. */
  className?: string;
  /** ``pool``: MUBI/BritBox dashed bar (matches Type). ``simple``: Explore/Watchlist row (matches title type). */
  variant?: "pool" | "simple";
  /** Merged onto the ``select`` (e.g. LLM search row spacing). */
  selectClassName?: string;
}) {
  const base = variant === "pool" ? poolSelectShell : simpleDecadeSelectBase;
  const colorCls = value ? "text-[var(--foreground)]" : "text-[var(--muted-soft)]";
  const wrapCls =
    (variant === "pool"
      ? "flex min-w-[7.5rem] flex-col"
      : "min-w-[7rem] sm:min-w-[7rem]") + (className ? ` ${className}` : "");

  return (
    <div className={wrapCls}>
      <select
        id={`${idPrefix}-decade`}
        className={[base, colorCls, selectClassName].filter(Boolean).join(" ")}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Decade"
      >
        <option value="">Decade</option>
        {DECADE_OPTION_VALUES.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
    </div>
  );
}

export function RecommendationPoolFiltersBar({
  value,
  onChange,
  idPrefix,
  showCountry = true,
  showDecade = true,
  showTitleType = false,
  countryEntry = "text",
  className = "",
}: {
  value: RecommendationPoolFilterValues;
  onChange: (next: RecommendationPoolFilterValues) => void;
  idPrefix: string;
  /** BritBox omits country; watchlist high-fit keeps full bar. */
  showCountry?: boolean;
  /** Hide decade (e.g. rare layouts); BritBox keeps decade on. */
  showDecade?: boolean;
  /** MUBI: movie / series / all before ranking (maps to API ``title_type``). */
  showTitleType?: boolean;
  /**
   * ``text`` = free substring (catalog MUBI). ``watchlist-picker`` = CountryMultiSelect from
   * watchlist metadata (high-fit).
   */
  countryEntry?: "text" | "watchlist-picker";
  /** Extra classes on the shell (e.g. ``mb-5`` when the next block has no top margin). */
  className?: string;
}) {
  const set = (patch: Partial<RecommendationPoolFilterValues>) =>
    onChange({ ...value, ...patch });

  const titleTypeEffective = (value.titleType || "all").trim().toLowerCase();
  const titleTypeColorCls =
    titleTypeEffective === "all"
      ? "text-[var(--muted-soft)]"
      : "text-[var(--foreground)]";

  const wrapCls =
    "mb-0 flex flex-col gap-3 rounded-lg border border-dashed border-[var(--card-border)] bg-[var(--control-track-bg)] px-3 py-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-4 sm:gap-y-3";

  return (
    <div
      className={className ? `${wrapCls} ${className}` : wrapCls}
      role="group"
      aria-label="Narrow recommendations"
    >
      {showDecade && (
        <RecommendationDecadeSelect
          idPrefix={idPrefix}
          variant="pool"
          value={value.decade}
          onChange={(decade) => set({ decade })}
        />
      )}
      {showCountry && countryEntry === "text" && (
        <div className="flex min-w-[8rem] max-w-[11rem] flex-1 flex-col">
          <input
            id={`${idPrefix}-country`}
            type="text"
            className={`${fieldInputBase} w-full min-w-0`}
            placeholder="Country"
            value={value.country}
            onChange={(e) => set({ country: e.target.value })}
            autoComplete="off"
            aria-label="Country"
          />
        </div>
      )}
      {showCountry && countryEntry === "watchlist-picker" && (
        <div className="flex min-w-[6rem] flex-col sm:min-w-[7rem]">
          <CountryMultiSelect
            selected={
              value.country.trim() ? [value.country.trim()] : []
            }
            onChange={(next) => {
              const c = next.length ? next[next.length - 1] : "";
              set({ country: c });
            }}
            countriesUrl={`${API_URL}/recommendations/watchlist-countries`}
          />
        </div>
      )}
      {showTitleType && (
        <div className="flex min-w-[7.5rem] flex-col">
          <select
            id={`${idPrefix}-title-type`}
            className={`${poolSelectShell} ${titleTypeColorCls}`}
            value={value.titleType || "all"}
            onChange={(e) => set({ titleType: e.target.value })}
            aria-label="Type"
          >
            <option value="all">All</option>
            <option value="movie">Movies</option>
            <option value="show">Series</option>
          </select>
        </div>
      )}
      <div
        className={
          showCountry || showTitleType
            ? "flex min-w-[10rem] flex-[2] flex-col gap-1 sm:min-w-[12rem]"
            : showDecade
              ? "flex min-w-[12rem] flex-[1.5] flex-col gap-1 sm:min-w-[18rem]"
              : "flex min-w-[12rem] flex-[1.5] flex-col gap-1 sm:min-w-[18rem]"
        }
      >
        <label htmlFor={`${idPrefix}-similar`} className={labelCls}>
          Similar to
        </label>
        <input
          id={`${idPrefix}-similar`}
          type="text"
          className={fieldInput}
          placeholder={SIMILAR_PLACEHOLDER}
          value={value.similarTo}
          onChange={(e) => set({ similarTo: e.target.value })}
          autoComplete="off"
        />
      </div>
    </div>
  );
}
