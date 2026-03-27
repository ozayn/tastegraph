"use client";

import { API_URL } from "../lib/api";
import { CountryMultiSelect } from "./CountryMultiSelect";
import { GenreMultiSelect } from "./GenreMultiSelect";
import {
  RecoSingleSelect,
  RECO_DECADE_OPTIONS,
  RECO_POOL_TITLE_TYPE_OPTIONS,
} from "./recoFilterPickers";

export type RecommendationPoolFilterValues = {
  decade: string;
  country: string;
  /** Catalog provider: selected genres (OR substring match on pool metadata). */
  genres: string[];
  similarTo: string;
  /** Catalog provider API ``title_type``: ``movie`` | ``show`` | ``all``; empty omits param (watchlist). */
  titleType: string;
};

const INITIAL_FILTERS: RecommendationPoolFilterValues = {
  decade: "",
  country: "",
  genres: [],
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
    includeGenre?: boolean;
  }
): string {
  const includeCountry = opts?.includeCountry !== false;
  const includeDecade = opts?.includeDecade !== false;
  const includeGenre = opts?.includeGenre !== false;
  const p = new URLSearchParams();
  if (includeDecade && f.decade.trim()) p.set("decade", f.decade.trim());
  if (includeCountry && f.country.trim()) p.set("country", f.country.trim());
  if (includeGenre) {
    for (const g of f.genres) {
      const t = g.trim();
      if (t) p.append("genre", t);
    }
  }
  if (f.similarTo.trim()) p.set("similar_to", f.similarTo.trim());
  const tt = (f.titleType || "").trim().toLowerCase();
  if (tt === "movie" || tt === "show" || tt === "all") {
    p.set("title_type", tt);
  }
  const s = p.toString();
  return s ? `&${s}` : "";
}

const fieldInputBase =
  "min-h-[2.75rem] rounded-lg border border-[var(--card-border)] bg-[var(--control-surface)] px-3 py-2.5 text-[14px] text-[var(--foreground)] placeholder:text-[var(--muted-soft)] transition-colors focus:border-[var(--accent)]/45 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 [color-scheme:inherit]";

/** Similar-to row: can grow/shrink inside the column layout. */
const fieldInput = `${fieldInputBase} min-w-0 flex-1`;

const labelCls =
  "text-[10px] font-medium uppercase tracking-wide text-[var(--muted-soft)]";

const SIMILAR_PLACEHOLDER = "Title in your rated or watchlist data";

export function RecommendationPoolFiltersBar({
  value,
  onChange,
  idPrefix,
  showCountry = true,
  showDecade = true,
  showTitleType = false,
  showGenre = false,
  /**
   * When set (e.g. ``mubi-us``): genre options from ``/catalog-genres``, country from ``/catalog-countries``
   * via ``CountryMultiSelect`` (Explore-style). Omit for free-text country or non-catalog modes.
   */
  catalogProviderSlug,
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
  /** MUBI: genre filter on catalog pool before ranking. */
  showGenre?: boolean;
  catalogProviderSlug?: string;
  /** MUBI: movie / series / all before ranking (maps to API ``title_type``). */
  showTitleType?: boolean;
  /**
   * ``text`` = free-text country (only if no ``catalogProviderSlug``). ``watchlist-picker`` = watchlist
   * countries (high-fit). With ``catalogProviderSlug``, country uses catalog metadata list.
   */
  countryEntry?: "text" | "watchlist-picker";
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
        <RecoSingleSelect
          id={`${idPrefix}-decade`}
          wrapClassName="flex min-w-[7.5rem] flex-col"
          buttonClassName="w-full"
          value={value.decade}
          onChange={(decade) => set({ decade })}
          options={RECO_DECADE_OPTIONS}
          ariaLabel="Decade"
        />
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
      {showCountry && catalogProviderSlug && countryEntry !== "watchlist-picker" && (
        <div className="flex min-w-[6rem] flex-col sm:min-w-[7rem]">
          <CountryMultiSelect
            selected={
              value.country.trim() ? [value.country.trim()] : []
            }
            onChange={(next) => {
              const c = next.length ? next[next.length - 1] : "";
              set({ country: c });
            }}
            countriesUrl={`${API_URL}/recommendations/catalog-countries?provider_slug=${encodeURIComponent(catalogProviderSlug)}`}
          />
        </div>
      )}
      {showCountry && !catalogProviderSlug && countryEntry === "text" && (
        <div className="flex min-w-0 max-w-full flex-1 flex-col sm:min-w-[8rem] sm:max-w-[11rem]">
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
      {showGenre && catalogProviderSlug && (
        <div className="flex min-w-[6rem] max-w-[14rem] flex-1 flex-col sm:min-w-[7rem]">
          <GenreMultiSelect
            selected={value.genres}
            onChange={(genres) => set({ genres })}
            genresUrl={`${API_URL}/recommendations/catalog-genres?provider_slug=${encodeURIComponent(catalogProviderSlug)}`}
            strictOptionsFromUrl
          />
        </div>
      )}
      {showTitleType && (
        <RecoSingleSelect
          id={`${idPrefix}-title-type`}
          wrapClassName="flex min-w-[7.5rem] flex-col"
          buttonClassName="w-full"
          value={value.titleType || "all"}
          onChange={(titleType) => set({ titleType })}
          options={RECO_POOL_TITLE_TYPE_OPTIONS}
          mutedValues={["all"]}
          ariaLabel="Type"
        />
      )}
      <div
        className={
          showCountry || showTitleType || showGenre
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
