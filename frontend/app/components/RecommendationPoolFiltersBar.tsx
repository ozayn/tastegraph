"use client";

export type RecommendationPoolFilterValues = {
  decade: string;
  yearMin: string;
  country: string;
  similarTo: string;
};

const INITIAL_FILTERS: RecommendationPoolFilterValues = {
  decade: "",
  yearMin: "",
  country: "",
  similarTo: "",
};

export function getInitialPoolFilters(): RecommendationPoolFilterValues {
  return { ...INITIAL_FILTERS };
}

/** Query fragment for GET /recommendations/* pool endpoints (leading & if non-empty). */
export function poolFiltersToQueryString(f: RecommendationPoolFilterValues): string {
  const p = new URLSearchParams();
  if (f.decade.trim()) p.set("decade", f.decade.trim());
  if (f.yearMin.trim()) p.set("year_min", f.yearMin.trim());
  if (f.country.trim()) p.set("country", f.country.trim());
  if (f.similarTo.trim()) p.set("similar_to", f.similarTo.trim());
  const s = p.toString();
  return s ? `&${s}` : "";
}

const selectBase =
  "rounded-md border border-[var(--section-border)] bg-[var(--card-bg)] px-2 py-1.5 text-[12px] text-[var(--foreground)] shadow-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";

const inputBase =
  "min-w-0 flex-1 rounded-md border border-[var(--section-border)] bg-[var(--card-bg)] px-2 py-1.5 text-[12px] text-[var(--foreground)] placeholder:text-[var(--muted-soft)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";

export function RecommendationPoolFiltersBar({
  value,
  onChange,
  idPrefix,
}: {
  value: RecommendationPoolFilterValues;
  onChange: (next: RecommendationPoolFilterValues) => void;
  idPrefix: string;
}) {
  const set = (patch: Partial<RecommendationPoolFilterValues>) =>
    onChange({ ...value, ...patch });

  return (
    <div
      className="mb-4 flex flex-col gap-2 rounded-lg border border-dashed border-[var(--section-border)] bg-[var(--section-bg)]/80 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-end"
      role="group"
      aria-label="Narrow recommendations"
    >
      <div className="flex min-w-[7.5rem] flex-col gap-0.5">
        <label
          htmlFor={`${idPrefix}-decade`}
          className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted-soft)]"
        >
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
      <div className="flex min-w-[7.5rem] flex-col gap-0.5">
        <label
          htmlFor={`${idPrefix}-ymin`}
          className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted-soft)]"
        >
          Year min
        </label>
        <select
          id={`${idPrefix}-ymin`}
          className={selectBase}
          value={value.yearMin}
          onChange={(e) => set({ yearMin: e.target.value })}
        >
          <option value="">Any</option>
          <option value="2000">2000+</option>
          <option value="2010">2010+</option>
          <option value="2015">2015+</option>
          <option value="2020">2020+</option>
        </select>
      </div>
      <div className="flex min-w-[8rem] max-w-[11rem] flex-1 flex-col gap-0.5">
        <label
          htmlFor={`${idPrefix}-country`}
          className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted-soft)]"
        >
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
      <div className="flex min-w-[10rem] flex-[2] flex-col gap-0.5 sm:min-w-[12rem]">
        <label
          htmlFor={`${idPrefix}-similar`}
          className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted-soft)]"
        >
          Similar to
        </label>
        <input
          id={`${idPrefix}-similar`}
          type="text"
          className={inputBase}
          placeholder="Title in your rated / watchlist data"
          value={value.similarTo}
          onChange={(e) => set({ similarTo: e.target.value })}
          autoComplete="off"
        />
      </div>
    </div>
  );
}
