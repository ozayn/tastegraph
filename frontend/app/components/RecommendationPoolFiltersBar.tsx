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

const selectDefault =
  "rounded-md border border-[var(--section-border)] bg-[var(--card-bg)] px-2 py-1.5 text-[12px] text-[var(--foreground)] shadow-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";

const selectCompact =
  "w-full rounded-none border-0 border-b border-[var(--section-border)] bg-transparent py-1.5 pl-0 pr-6 text-[12px] text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-0";

const inputDefault =
  "min-w-0 flex-1 rounded-md border border-[var(--section-border)] bg-[var(--card-bg)] px-2 py-1.5 text-[12px] text-[var(--foreground)] placeholder:text-[var(--muted-soft)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";

const inputCompact =
  "min-w-0 flex-1 rounded-none border-0 border-b border-[var(--section-border)] bg-transparent py-1.5 text-[12px] text-[var(--foreground)] placeholder:text-[var(--muted-soft)]/80 focus:border-[var(--accent)] focus:outline-none focus:ring-0";

export function RecommendationPoolFiltersBar({
  value,
  onChange,
  idPrefix,
  variant = "default",
  showCountry = true,
  showDecade = true,
}: {
  value: RecommendationPoolFilterValues;
  onChange: (next: RecommendationPoolFilterValues) => void;
  idPrefix: string;
  /** ``compact``: underline-style fields, no panel box (e.g. BritBox). */
  variant?: "default" | "compact";
  /** BritBox omits country; watchlist high-fit keeps full bar. */
  showCountry?: boolean;
  /** Hide decade (e.g. rare layouts); BritBox keeps decade on. */
  showDecade?: boolean;
}) {
  const set = (patch: Partial<RecommendationPoolFilterValues>) =>
    onChange({ ...value, ...patch });

  const compact = variant === "compact";
  const selectBase = compact ? selectCompact : selectDefault;
  const inputBase = compact ? inputCompact : inputDefault;
  const labelCls = compact
    ? "text-[10px] font-normal text-[var(--muted-soft)]"
    : "text-[10px] font-medium uppercase tracking-wide text-[var(--muted-soft)]";

  const wrapCls = compact
    ? "mb-5 flex flex-col gap-3 border-b border-[var(--section-border)]/60 pb-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-5 sm:gap-y-2"
    : "mb-4 flex flex-col gap-2 rounded-lg border border-dashed border-[var(--section-border)] bg-[var(--section-bg)]/80 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-end";

  return (
    <div
      className={wrapCls}
      role="group"
      aria-label="Narrow recommendations"
    >
      {showDecade && (
        <div className="flex min-w-[7.5rem] flex-col gap-0.5">
          <label htmlFor={`${idPrefix}-decade`} className={labelCls}>
            Decade
          </label>
          <select
            id={`${idPrefix}-decade`}
            className={selectBase}
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
        <div className="flex min-w-[8rem] max-w-[11rem] flex-1 flex-col gap-0.5">
          <label htmlFor={`${idPrefix}-country`} className={labelCls}>
            Country
          </label>
          <input
            id={`${idPrefix}-country`}
            type="text"
            className={inputBase}
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
            ? "flex min-w-[10rem] flex-[2] flex-col gap-0.5 sm:min-w-[12rem]"
            : showDecade
              ? "flex min-w-[12rem] flex-[1.5] flex-col gap-0.5 sm:min-w-[18rem]"
              : "flex min-w-[12rem] flex-[1.5] flex-col gap-0.5 sm:min-w-[18rem]"
        }
      >
        <label htmlFor={`${idPrefix}-similar`} className={labelCls}>
          Similar to
        </label>
        <input
          id={`${idPrefix}-similar`}
          type="text"
          className={inputBase}
          placeholder={
            compact
              ? "Title from your ratings or watchlist"
              : "Title in your rated / watchlist data"
          }
          value={value.similarTo}
          onChange={(e) => set({ similarTo: e.target.value })}
          autoComplete="off"
        />
      </div>
    </div>
  );
}
