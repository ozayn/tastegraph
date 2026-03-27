"use client";

export type RecommendationPoolFilterValues = {
  decade: string;
  country: string;
  similarTo: string;
};

const INITIAL_FILTERS: RecommendationPoolFilterValues = {
  decade: "",
  country: "",
  similarTo: "",
};

export function getInitialPoolFilters(): RecommendationPoolFilterValues {
  return { ...INITIAL_FILTERS };
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
  const s = p.toString();
  return s ? `&${s}` : "";
}

/** Matches Simple/Watchlist filter row: filled surface, full border, 14px type, shared focus ring. */
const fieldSelect =
  "w-full min-h-[2.75rem] rounded-lg border border-[var(--card-border)] bg-[var(--control-surface)] px-3 py-2.5 text-[14px] text-[var(--foreground)] shadow-sm transition-colors focus:border-[var(--accent)]/45 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 [color-scheme:inherit]";

const fieldInput =
  "min-h-[2.75rem] min-w-0 flex-1 rounded-lg border border-[var(--card-border)] bg-[var(--control-surface)] px-3 py-2.5 text-[14px] text-[var(--foreground)] placeholder:text-[var(--muted-soft)] transition-colors focus:border-[var(--accent)]/45 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 [color-scheme:inherit]";

const labelCls =
  "text-[10px] font-medium uppercase tracking-wide text-[var(--muted-soft)]";

const SIMILAR_PLACEHOLDER = "Title in your rated or watchlist data";

export function RecommendationPoolFiltersBar({
  value,
  onChange,
  idPrefix,
  showCountry = true,
  showDecade = true,
  className = "",
}: {
  value: RecommendationPoolFilterValues;
  onChange: (next: RecommendationPoolFilterValues) => void;
  idPrefix: string;
  /** BritBox omits country; watchlist high-fit keeps full bar. */
  showCountry?: boolean;
  /** Hide decade (e.g. rare layouts); BritBox keeps decade on. */
  showDecade?: boolean;
  /** Extra classes on the shell (e.g. ``mb-5`` when the next block has no top margin). */
  className?: string;
}) {
  const set = (patch: Partial<RecommendationPoolFilterValues>) =>
    onChange({ ...value, ...patch });

  const wrapCls =
    "mb-0 flex flex-col gap-3 rounded-lg border border-dashed border-[var(--card-border)] bg-[var(--control-track-bg)] px-3 py-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-4 sm:gap-y-3";

  return (
    <div
      className={className ? `${wrapCls} ${className}` : wrapCls}
      role="group"
      aria-label="Narrow recommendations"
    >
      {showDecade && (
        <div className="flex min-w-[7.5rem] flex-col gap-1">
          <label htmlFor={`${idPrefix}-decade`} className={labelCls}>
            Decade
          </label>
          <select
            id={`${idPrefix}-decade`}
            className={fieldSelect}
            value={value.decade}
            onChange={(e) => set({ decade: e.target.value })}
          >
            <option value="">Any</option>
            <option value="1990s">1990s</option>
            <option value="2000s">2000s</option>
            <option value="2010s">2010s</option>
            <option value="2020s">2020s</option>
          </select>
        </div>
      )}
      {showCountry && (
        <div className="flex min-w-[8rem] max-w-[11rem] flex-1 flex-col gap-1">
          <label htmlFor={`${idPrefix}-country`} className={labelCls}>
            Country
          </label>
          <input
            id={`${idPrefix}-country`}
            type="text"
            className={fieldInput}
            placeholder="e.g. United Kingdom"
            value={value.country}
            onChange={(e) => set({ country: e.target.value })}
            autoComplete="off"
          />
        </div>
      )}
      <div
        className={
          showCountry
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
