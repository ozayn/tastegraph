"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL } from "../lib/api";
import { CountryMultiSelect } from "./CountryMultiSelect";
import { GenreMultiSelect } from "./GenreMultiSelect";
import { RecommendationCard } from "./RecommendationCard";
import { SectionHelp } from "./SectionHelp";
import { ExpandableRecoListFooter } from "./ExpandableRecoListFooter";
import {
  RECO_CONTROLS_WELL,
  RECO_EMPTY_PANEL,
  RECO_LOADING_DOT,
  RECO_LOADING_ROW,
  RECO_MODE_INTRO,
  RECO_RESULTS_LIST,
  RECO_RESULTS_SHELL,
  RECO_STALE_DIM,
  RECO_UPDATING_CORNER,
  RECO_VISIBLE_INITIAL,
} from "./recommendationModeStyles";
import {
  RecoSingleSelect,
  RECO_DECADE_OPTIONS,
  RECO_WATCHLIST_TITLE_TYPE_OPTIONS,
  watchlistFiltersActive,
  watchlistFiltersToSearchParams,
} from "./recoFilterPickers";

const DEBOUNCE_MS = 350;
const FETCH_LIMIT = 25;

type Item = {
  imdb_title_id: string;
  title: string | null;
  title_type: string | null;
  year: number | null;
  your_rating: number | null;
  date_rated: string | null;
  poster?: string | null;
  reasons?: string[];
};

export function WatchlistRecommendations({ embedded = false }: { embedded?: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const [listExpanded, setListExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [titleType, setTitleType] = useState("");
  const [decade, setDecade] = useState("");
  const [includeRated, setIncludeRated] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRun = useRef(true);
  const requestIdRef = useRef(0);
  const itemsLenRef = useRef(0);
  itemsLenRef.current = items.length;

  const fetchWithFilters = useCallback(
    (
      genres: string[],
      countries: string[],
      tt: string,
      dec: string,
      incRated: boolean,
      staleWhileRevalidate: boolean
    ) => {
      const id = ++requestIdRef.current;
      if (staleWhileRevalidate) setRefreshing(true);
      else setLoading(true);
      setFetchError(false);
      const params = watchlistFiltersToSearchParams(
        {
          genres,
          countries,
          titleType: tt,
          decade: dec,
          includeRated: incRated,
        },
        { limit: FETCH_LIMIT }
      );

      fetch(`${API_URL}/recommendations/watchlist-simple?${params}`)
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data) => {
          if (id !== requestIdRef.current) return;
          setItems((data as Item[]).slice(0, FETCH_LIMIT));
        })
        .catch(() => {
          if (id !== requestIdRef.current) return;
          setItems([]);
          setFetchError(true);
        })
        .finally(() => {
          if (id !== requestIdRef.current) return;
          setLoading(false);
          setRefreshing(false);
        });
    },
    []
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const delay = isFirstRun.current ? 0 : DEBOUNCE_MS;
    isFirstRun.current = false;
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      fetchWithFilters(
        selectedGenres,
        selectedCountries,
        titleType,
        decade,
        includeRated,
        itemsLenRef.current > 0
      );
    }, delay);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    fetchWithFilters,
    selectedGenres,
    selectedCountries,
    titleType,
    decade,
    includeRated,
  ]);

  useEffect(() => {
    setListExpanded(false);
  }, [items, selectedGenres, selectedCountries, titleType, decade, includeRated]);

  const filtersActive = watchlistFiltersActive({
    genres: selectedGenres,
    countries: selectedCountries,
    titleType,
    decade,
  });

  const emptyMessage = fetchError
    ? "Could not load watchlist. Check that the API is running."
    : filtersActive
      ? "No watchlist items match these filters yet."
      : "No unrated watchlist items yet. Import your watchlist or enable Include rated.";

  const header = embedded ? (
    <p className={RECO_MODE_INTRO}>
      Titles you saved, filtered by your taste
      <SectionHelp title="How this works">
        <p>Titles you saved, filtered by genre, country, and release decade. Uses your <strong>8+ taste signals</strong>—genres and countries you tend to rate highly.</p>
        <p>Unrated items only by default. &quot;Include rated&quot; shows what you&apos;ve already seen for comparison.</p>
      </SectionHelp>
    </p>
  ) : (
    <>
      <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--foreground)] sm:text-[19px]">
        From your watchlist
        <SectionHelp title="How this works">
          <p>Titles you saved, filtered by genre, country, and release decade. Uses your <strong>8+ taste signals</strong>—genres and countries you tend to rate highly.</p>
          <p>Unrated items only by default. &quot;Include rated&quot; shows what you&apos;ve already seen for comparison.</p>
        </SectionHelp>
      </h2>
      <p className="mt-1.5 text-[14px] leading-[1.5] text-[var(--muted)]">
        Titles you saved, filtered by your taste
      </p>
    </>
  );

  const content = (
    <>
      {header}
      <div
        className={
          embedded
            ? `${RECO_CONTROLS_WELL} flex flex-wrap items-center gap-3 sm:gap-4`
            : "mt-6 flex flex-wrap items-center gap-3 sm:mt-7 sm:gap-4"
        }
      >
        <GenreMultiSelect
          selected={selectedGenres}
          onChange={setSelectedGenres}
          disabled={loading && items.length === 0}
          genresUrl={`${API_URL}/recommendations/watchlist-genres`}
          fallbackGenresUrl={`${API_URL}/recommendations/genres`}
        />
        <CountryMultiSelect
          selected={selectedCountries}
          onChange={setSelectedCountries}
          disabled={loading && items.length === 0}
          countriesUrl={`${API_URL}/recommendations/watchlist-countries`}
        />
        <RecoSingleSelect
          id="watchlist-simple-title-type"
          value={titleType}
          onChange={setTitleType}
          options={RECO_WATCHLIST_TITLE_TYPE_OPTIONS}
          disabled={loading && items.length === 0}
          ariaLabel="Title type"
        />
        <RecoSingleSelect
          id="watchlist-simple-decade"
          value={decade}
          onChange={setDecade}
          options={RECO_DECADE_OPTIONS}
          disabled={loading && items.length === 0}
          ariaLabel="Decade"
        />
        <label className="flex cursor-pointer items-center gap-2 text-[14px] text-[var(--muted)] transition-colors hover:text-[var(--foreground)]">
          <input
            type="checkbox"
            checked={includeRated}
            onChange={(e) => setIncludeRated(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--card-border)] accent-[var(--accent)]"
            aria-label="Include rated"
          />
          <span>Include rated</span>
        </label>
      </div>

      <div
        className={
          embedded
            ? `${RECO_RESULTS_SHELL} ${refreshing && items.length > 0 ? RECO_STALE_DIM : ""}`
            : `mt-5 sm:mt-6 ${RECO_RESULTS_SHELL} ${refreshing && items.length > 0 ? RECO_STALE_DIM : ""}`
        }
      >
        {refreshing && items.length > 0 && (
          <div className={RECO_UPDATING_CORNER} aria-live="polite">
            Updating…
          </div>
        )}
        {loading && items.length === 0 ? (
          <div
            className={
              embedded ? RECO_LOADING_ROW : "flex items-center gap-2.5 text-[14px] text-[var(--muted)]"
            }
          >
            <span className={RECO_LOADING_DOT} />
            Loading…
          </div>
        ) : items.length > 0 ? (
          <>
            <ul
              className={embedded ? RECO_RESULTS_LIST : "grid gap-5 sm:gap-6"}
            >
              {(listExpanded
                ? items
                : items.slice(0, RECO_VISIBLE_INITIAL.watchlist)
              ).map((r) => (
                <li key={r.imdb_title_id}>
                  <RecommendationCard
                    imdb_title_id={r.imdb_title_id}
                    title={r.title}
                    year={r.year}
                    title_type={r.title_type}
                    your_rating={r.your_rating}
                    poster={r.poster}
                    reasons={r.reasons}
                  />
                </li>
              ))}
            </ul>
            <ExpandableRecoListFooter
              expanded={listExpanded}
              onToggle={() => setListExpanded((e) => !e)}
              initialVisible={RECO_VISIBLE_INITIAL.watchlist}
              total={items.length}
            />
          </>
        ) : (
          <p
            className={
              embedded
                ? RECO_EMPTY_PANEL
                : "mt-5 rounded-lg border border-dashed border-[var(--card-border)] py-8 text-center text-[14px] text-[var(--muted)] sm:mt-6"
            }
          >
            {emptyMessage}
          </p>
        )}
      </div>
    </>
  );

  return embedded ? (
    <div>{content}</div>
  ) : (
    <section className="rounded-xl border border-[var(--card-border)] bg-[var(--panel-bg)] px-6 py-7 sm:px-8 sm:py-8">
      {content}
    </section>
  );
}
