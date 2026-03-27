"use client";

import { useEffect, useMemo, useState } from "react";
import {
  catalogProviderByModeId,
  type CatalogProviderModeId,
} from "../config/catalogProviders";
import { API_URL } from "../lib/api";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { ExpandableRecoListFooter } from "./ExpandableRecoListFooter";
import { HighFitCard } from "./HighFitCard";
import {
  getInitialPoolFilters,
  poolFiltersToQueryString,
  RecommendationPoolFiltersBar,
  type RecommendationPoolFilterValues,
} from "./RecommendationPoolFiltersBar";
import {
  RECO_BODY_TEXT,
  RECO_LOADING_DOT,
  RECO_RESULTS_GRID,
  RECO_VISIBLE_INITIAL,
} from "./recommendationModeStyles";

export type { CatalogProviderModeId };

type ScoringMode = "high-fit" | "ml";

type CatalogStats = {
  total_in_catalog: number;
  with_imdb_id: number;
  matched_metadata: number;
  unmatched?: number;
  already_rated?: number;
  excluded_watchlist?: number;
  catalog_jw_shows?: number;
  catalog_jw_movies?: number;
  matched_pool_shows?: number;
  matched_pool_movies?: number;
  matched_pool_total?: number;
  recommendation_filters?: {
    decade?: string | null;
    year_min?: number | null;
    country_contains?: string | null;
    similar_to?: string | null;
    similar_to_resolved_title?: string | null;
    pool_filters_active?: boolean;
    pool_size_after_filters?: number;
  };
  matching_diagnostic?: {
    distinct_catalog_imdb_ids: number;
    catalog_imdb_id_sample: string[];
    title_metadata_rows_hitting_catalog: number;
    high_fit_ranking?: {
      top_n: number;
      top_median_year?: number | null;
      top_mean_year?: number | null;
      top_decade_counts: Record<string, number>;
      decade_compare?: {
        top_results_decade_share_pct: Record<string, number>;
        matched_pool_decade_share_pct: Record<string, number>;
      };
      sort_note?: string;
      hints?: string[];
    };
  };
};

type HighFitExplanation = {
  in_favorite_list?: boolean;
  matched_genres: string[];
  matched_countries: string[];
  matched_decade: string | null;
  matched_people: { name: string; role: string }[];
  matched_strong_directors?: string[];
  top_reasons: string[];
};

type HighFitItem = {
  imdb_title_id: string;
  title: string | null;
  year: number | null;
  title_type: string | null;
  poster: string | null;
  explanation: HighFitExplanation;
  scoring?: {
    fit_score: number;
    favorite_boost: number;
    uk_catalog_bonus: number;
    total: number;
  };
};

type MLItem = {
  imdb_title_id: string;
  title: string | null;
  year: number | null;
  title_type: string | null;
  poster: string | null;
  prob_8plus: number;
  top_features?: string[];
};

type HighFitResponse = {
  provider_name: string;
  fetched_at: string;
  catalog_stats: CatalogStats;
  items: HighFitItem[];
  error?: string;
  message?: string;
};

type MLResponse = {
  provider_name: string;
  fetched_at?: string;
  catalog_stats: CatalogStats;
  items: MLItem[];
  model_available: boolean;
  error?: string;
  message?: string;
};

function formatFeature(name: string): string {
  const m = name.match(/^(genre|country|decade|title_type):(.+)$/);
  return m ? m[2] : name;
}

function StatsBanner({
  stats,
  fetchedAt,
}: {
  stats: CatalogStats;
  fetchedAt?: string;
}) {
  const date = fetchedAt ? new Date(fetchedAt).toLocaleDateString() : null;
  const rf = stats.recommendation_filters;
  const filtered =
    rf?.pool_filters_active &&
    typeof rf.pool_size_after_filters === "number" &&
    typeof stats.matched_metadata === "number" &&
    rf.pool_size_after_filters !== stats.matched_metadata;

  const metaBits: string[] = [];
  if (stats.matched_pool_shows != null && stats.matched_pool_movies != null) {
    metaBits.push(`${stats.matched_pool_shows} series · ${stats.matched_pool_movies} films in pool`);
  }
  if (stats.excluded_watchlist != null && stats.excluded_watchlist > 0) {
    metaBits.push(`${stats.excluded_watchlist} watchlist skipped`);
  }
  const metaLine = metaBits.length ? metaBits.join(" · ") : null;

  const noMeta =
    stats.matching_diagnostic &&
    stats.matching_diagnostic.title_metadata_rows_hitting_catalog === 0 &&
    stats.with_imdb_id > 0;

  return (
    <div className="mb-5 space-y-1 border-b border-[var(--section-border)]/50 pb-3">
      <p className="text-[11px] leading-relaxed text-[var(--muted-soft)]">
        <span className="text-[var(--foreground)]/90">
          {filtered ? rf!.pool_size_after_filters : stats.matched_metadata}
        </span>
        {filtered ? (
          <>
            {" "}
            titles after filters
            <span className="text-[var(--muted-soft)]/80">
              {" "}
              ({stats.matched_metadata} before)
            </span>
          </>
        ) : (
          <>
            {" "}
            titles with scores · {stats.total_in_catalog} in catalog
          </>
        )}
        {date && (
          <span className="text-[var(--muted-soft)]/75"> · snapshot {date}</span>
        )}
      </p>
      {metaLine && (
        <p className="text-[10px] leading-relaxed text-[var(--muted-soft)]/80">
          {metaLine}
        </p>
      )}
      {rf?.similar_to?.trim() && rf.similar_to_resolved_title && (
        <p className="text-[11px] text-[var(--muted-soft)]">
          Like{" "}
          <span className="text-[var(--foreground)]">{rf.similar_to_resolved_title}</span>
          {" — "}
          shared genre filter.
        </p>
      )}
      {noMeta && (
        <p
          className="text-[11px] text-[var(--mondrian-red)]/90"
          title={stats.matching_diagnostic!.catalog_imdb_id_sample.join(", ")}
        >
          No DB metadata for catalog ids (enrich metadata). Sample:{" "}
          {stats.matching_diagnostic!.catalog_imdb_id_sample.slice(0, 2).join(", ")}
        </p>
      )}
    </div>
  );
}

function CatalogProviderMLCard({ item }: { item: MLItem }) {
  const [imageFailed, setImageFailed] = useState(false);
  const displayTitle = item.title ?? item.imdb_title_id;
  const hasUsablePoster =
    item.poster && item.poster.trim() && item.poster !== "N/A";
  const showPoster = hasUsablePoster && !imageFailed;
  const metaParts: string[] = [];
  if (item.year != null) metaParts.push(String(item.year));
  if (item.title_type?.trim()) metaParts.push(item.title_type.trim());
  const meta = metaParts.length ? metaParts.join(" · ") : null;
  const topFeat =
    item.top_features && item.top_features.length > 0
      ? formatFeature(item.top_features[0])
      : null;

  return (
    <a
      href={`https://www.imdb.com/title/${item.imdb_title_id}/`}
      target="_blank"
      rel="noopener noreferrer"
      className="group block overflow-hidden rounded-lg border border-[var(--section-border)]/80 bg-[var(--card-bg)] transition-colors duration-150 hover:border-[var(--muted-subtle)]"
    >
      <div className="flex gap-3 px-3 py-3 sm:gap-4 sm:px-4 sm:py-3.5">
        {showPoster && (
          <div className="h-[4.75rem] w-[3.25rem] shrink-0 overflow-hidden rounded-md bg-[var(--control-track-bg)] ring-1 ring-[var(--card-border)] sm:h-[5.5rem] sm:w-[3.75rem]">
            <img
              src={item.poster!}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setImageFailed(true)}
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-[17px] font-semibold leading-snug tracking-[-0.015em] text-[var(--foreground)] sm:text-[18px]">
            {displayTitle}
          </h3>
          <p className="mt-1.5 text-[13px] leading-snug text-[var(--muted)]">
            {meta && <span>{meta}</span>}
            {meta && <span className="text-[var(--muted-soft)]"> · </span>}
            <span className="font-medium text-[var(--foreground)]">
              {(item.prob_8plus * 100).toFixed(0)}% 8+
            </span>
          </p>
          {topFeat && (
            <p className="mt-2 text-[12px] leading-relaxed text-[var(--muted-soft)]">
              <span className="text-[var(--foreground)]/85">Why it may fit:</span>{" "}
              {formatFeature(topFeat)} from your taste profile
            </p>
          )}
        </div>
      </div>
    </a>
  );
}

const segActive = "font-semibold text-[var(--foreground)]";
const segInactive =
  "text-[var(--muted)] hover:bg-[var(--card-hover)] hover:text-[var(--foreground)]";

function catalogPoolFiltersQueryActive(
  f: RecommendationPoolFilterValues,
  defaultTitleType: string
): boolean {
  return !!(
    f.decade ||
    f.similarTo.trim() ||
    f.country.trim() ||
    (f.titleType && f.titleType !== defaultTitleType)
  );
}

export function ProviderCatalogRecommendations({
  provider,
}: {
  provider: CatalogProviderModeId;
}) {
  const cfg = catalogProviderByModeId(provider);
  const [scoring, setScoring] = useState<ScoringMode>("high-fit");
  const [poolFilters, setPoolFilters] = useState<RecommendationPoolFilterValues>(() =>
    getInitialPoolFilters({ titleType: cfg.catalogDefaultTitleType })
  );
  const debouncedSimilarTo = useDebouncedValue(poolFilters.similarTo, 500);

  const filtersForQuery = useMemo<RecommendationPoolFilterValues>(
    () => ({
      decade: poolFilters.decade,
      country: cfg.poolShowCountry ? poolFilters.country : "",
      similarTo: debouncedSimilarTo,
      titleType: poolFilters.titleType,
    }),
    [poolFilters.decade, poolFilters.country, poolFilters.titleType, cfg.poolShowCountry, debouncedSimilarTo]
  );

  const [highFitData, setHighFitData] = useState<HighFitResponse | null>(null);
  const [mlData, setMlData] = useState<MLResponse | null>(null);
  const [listExpanded, setListExpanded] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    setListExpanded(false);
  }, [scoring, provider, filtersForQuery]);

  useEffect(() => {
    const ac = new AbortController();
    const filterQ = poolFiltersToQueryString(filtersForQuery, {
      includeCountry: cfg.poolShowCountry,
    });
    const base = scoring === "ml" ? cfg.apiMl : cfg.apiHigh;
    const url = `${API_URL}/recommendations/${base}?limit=15${filterQ}`;

    setIsFetching(true);
    fetch(url, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (ac.signal.aborted) return;
        if (scoring === "ml") setMlData(data);
        else setHighFitData(data);
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        if (scoring === "ml") setMlData(null);
        else setHighFitData(null);
      })
      .finally(() => {
        if (!ac.signal.aborted) setIsFetching(false);
      });

    return () => ac.abort();
  }, [scoring, filtersForQuery, provider, cfg.apiHigh, cfg.apiMl, cfg.poolShowCountry]);

  const activeData = scoring === "ml" ? mlData : highFitData;
  const filtersActiveForQuery = catalogPoolFiltersQueryActive(
    filtersForQuery,
    cfg.catalogDefaultTitleType
  );

  const showBlockingLoading = isFetching && activeData === null;
  const catalogError =
    activeData && "error" in activeData && activeData.error ? activeData : null;

  return (
    <div className="relative">
      {isFetching && activeData !== null && !catalogError && (
        <div
          className="pointer-events-none absolute right-0 top-0 z-10 text-[11px] text-[var(--muted-soft)]"
          aria-live="polite"
        >
          Updating…
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div
          className="inline-flex rounded-md border border-[var(--card-border)] bg-[var(--control-track-bg)] p-0.5"
          role="tablist"
          aria-label="Ranking"
        >
          {(["high-fit", "ml"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={scoring === m}
              onClick={() => setScoring(m)}
              className={`rounded px-2.5 py-1 text-[12px] font-medium transition-colors ${
                scoring === m ? segActive : segInactive
              } ${scoring === m ? "bg-[var(--control-surface)] shadow-sm ring-1 ring-[var(--card-border)]" : ""}`}
            >
              {m === "high-fit" ? "High-Fit" : "ML 8+"}
            </button>
          ))}
        </div>
      </div>

      <RecommendationPoolFiltersBar
        className="mb-5"
        showCountry={cfg.poolShowCountry}
        showTitleType={cfg.poolShowTitleType}
        idPrefix={cfg.filterIdPrefix}
        value={poolFilters}
        onChange={setPoolFilters}
      />

      {showBlockingLoading && (
        <div className="mb-4 flex items-center gap-2.5 text-[14px] text-[var(--muted)]">
          <span className={RECO_LOADING_DOT} />
          Loading catalog…
        </div>
      )}

      {catalogError && (
        <div className="mb-4 rounded-md border border-[var(--section-border)] bg-[var(--section-bg)] px-4 py-4">
          <p className="text-[13px] font-medium text-[var(--foreground)]">
            Catalog snapshot unavailable
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted-soft)]">
            {catalogError.message ||
              `${cfg.poolLabel} catalog data could not be loaded in this environment.`}
          </p>
        </div>
      )}

      {!showBlockingLoading && !catalogError && activeData?.catalog_stats && (
        <StatsBanner
          stats={activeData.catalog_stats}
          fetchedAt={
            "fetched_at" in activeData
              ? (activeData.fetched_at as string)
              : undefined
          }
        />
      )}

      {!showBlockingLoading &&
        !catalogError &&
        scoring === "high-fit" &&
        highFitData && (
        <>
          {highFitData.items.length === 0 ? (
            <p className={RECO_BODY_TEXT}>
              {filtersActiveForQuery
                ? "No titles match these filters—try another decade or broader similar-to."
                : "No scoreable titles yet. Enrich metadata to improve matching."}
            </p>
          ) : (
            <>
              <ul className={RECO_RESULTS_GRID}>
                {(listExpanded
                  ? highFitData.items
                  : highFitData.items.slice(0, RECO_VISIBLE_INITIAL.providerCatalog)
                ).map((item) => (
                  <li key={item.imdb_title_id}>
                    <HighFitCard
                      variant={cfg.highFitCardVariant}
                      imdb_title_id={item.imdb_title_id}
                      title={item.title}
                      title_type={item.title_type}
                      year={item.year}
                      poster={item.poster}
                      explanation={item.explanation}
                    />
                  </li>
                ))}
              </ul>
              <ExpandableRecoListFooter
                expanded={listExpanded}
                onToggle={() => setListExpanded((e) => !e)}
                initialVisible={RECO_VISIBLE_INITIAL.providerCatalog}
                total={highFitData.items.length}
              />
            </>
          )}
        </>
      )}

      {!showBlockingLoading && !catalogError && scoring === "ml" && mlData && (
        <>
          {!mlData.model_available ? (
            <div className="rounded-lg border border-dashed border-[var(--card-border)] bg-[var(--control-track-bg)] px-4 py-5">
              <p className="text-[14px] font-medium text-[var(--foreground)]">
                ML model not trained
              </p>
              <p className="mt-2 text-[14px] leading-[1.5] text-[var(--muted)]">
                Train the model locally, then restart the backend:
              </p>
              <code className="mt-3 block rounded-md border border-[var(--card-border)] bg-[var(--control-surface)] px-3 py-2 text-left text-[12px] text-[var(--muted-soft)]">
                cd backend && python -m app.ml.train_8plus_baseline
              </code>
            </div>
          ) : mlData.items.length === 0 ? (
            <p className={RECO_BODY_TEXT}>
              {filtersActiveForQuery
                ? "No titles in this filtered pool for ML. Try loosening filters."
                : "No scoreable titles for ML ranking."}
            </p>
          ) : (
            <>
              <ul className={RECO_RESULTS_GRID}>
                {(listExpanded
                  ? mlData.items
                  : mlData.items.slice(0, RECO_VISIBLE_INITIAL.providerCatalog)
                ).map((item) => (
                  <li key={item.imdb_title_id}>
                    <CatalogProviderMLCard item={item} />
                  </li>
                ))}
              </ul>
              <ExpandableRecoListFooter
                expanded={listExpanded}
                onToggle={() => setListExpanded((e) => !e)}
                initialVisible={RECO_VISIBLE_INITIAL.providerCatalog}
                total={mlData.items.length}
              />
            </>
          )}
        </>
      )}

      {!showBlockingLoading && !catalogError && !activeData && (
        <p className="text-[13px] text-[var(--muted-soft)]">
          Unable to load recommendations. Is the backend running?
        </p>
      )}
    </div>
  );
}
