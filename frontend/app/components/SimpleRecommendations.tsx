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
  RECO_SECONDARY_LINE,
  RECO_STALE_DIM,
  RECO_UPDATING_CORNER,
  RECO_VISIBLE_INITIAL,
} from "./recommendationModeStyles";
import {
  exploreFiltersActive,
  exploreFiltersToSearchParams,
  RecoSingleSelect,
  RECO_DECADE_OPTIONS,
  RECO_EXPLORE_TITLE_TYPE_OPTIONS,
} from "./recoFilterPickers";

const DEBOUNCE_MS = 350;
/** Top N titles to show; passed as API limit (backend still scores a wider pool first). */
const DISPLAY_LIMIT = 10;

type Item = {
  imdb_title_id: string;
  title: string | null;
  year: number | null;
  genres: string | null;
  user_rating: number | null;
  poster?: string | null;
  reasons?: string[];
};

export function SimpleRecommendations({ embedded = false }: { embedded?: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const [listExpanded, setListExpanded] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [titleType, setTitleType] = useState("");
  const [decade, setDecade] = useState("");
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
      staleWhileRevalidate: boolean
    ) => {
      const id = ++requestIdRef.current;
      if (staleWhileRevalidate) setRefreshing(true);
      else setLoading(true);
      setFetchError(false);

      const baseParams = exploreFiltersToSearchParams({
        genres,
        countries,
        titleType: tt,
        decade: dec,
      });
      const recParams = new URLSearchParams(baseParams);
      recParams.set("limit", String(DISPLAY_LIMIT));

      const recPromise = fetch(`${API_URL}/recommendations/simple?${recParams}`).then(
        (res) => (res.ok ? res.json() : Promise.reject(new Error("simple")))
      );
      const explPromise = fetch(
        `${API_URL}/recommendations/simple-explanation?${baseParams}`
      ).then((res) => (res.ok ? res.json() : null));

      Promise.all([recPromise, explPromise])
        .then(([recs, expl]) => {
          if (id !== requestIdRef.current) return;
          // Use API order as-is. Do not filter by poster—metadata poster URLs differ
          // across environments (null vs stale URL), which was hiding different titles.
          setItems((recs as Item[]).slice(0, DISPLAY_LIMIT));
          setExplanation(
            expl && typeof expl === "object" && "explanation" in expl
              ? (expl.explanation as string | null)
              : null
          );
        })
        .catch(() => {
          if (id !== requestIdRef.current) return;
          setItems([]);
          setExplanation(null);
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
  ]);

  useEffect(() => {
    setListExpanded(false);
  }, [items, selectedGenres, selectedCountries, titleType, decade]);

  const filtersActive = exploreFiltersActive({
    genres: selectedGenres,
    countries: selectedCountries,
    titleType,
    decade,
  });

  const emptyMessage = fetchError
    ? "Could not load favorites. Check that the API is running."
    : filtersActive
      ? "No 8+ titles match these filters yet."
      : "No 8+ rated titles in your library yet. Import ratings to populate this view.";

  const helpContent = (
    <>
      <p>Browse and filter titles you&apos;ve already rated 8+ by genre, country, and release decade. Exploration of your favorites—not recommendations for unseen titles.</p>
    </>
  );

  const header = embedded ? (
    <p className={RECO_MODE_INTRO}>
      Browse titles you&apos;ve already rated 8+
      <SectionHelp title="How this works">{helpContent}</SectionHelp>
    </p>
  ) : (
    <>
      <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--foreground)] sm:text-[19px]">
        Explore your favorites
        <SectionHelp title="How this works">{helpContent}</SectionHelp>
      </h2>
      <p className="mt-1.5 text-[14px] leading-[1.5] text-[var(--muted)]">
        Browse titles you&apos;ve already rated 8+
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
        />
        <CountryMultiSelect
          selected={selectedCountries}
          onChange={setSelectedCountries}
          disabled={loading && items.length === 0}
        />
        <RecoSingleSelect
          id="explore-favorites-title-type"
          value={titleType}
          onChange={setTitleType}
          options={RECO_EXPLORE_TITLE_TYPE_OPTIONS}
          disabled={loading && items.length === 0}
          ariaLabel="Title type"
        />
        <RecoSingleSelect
          id="explore-favorites-decade"
          value={decade}
          onChange={setDecade}
          options={RECO_DECADE_OPTIONS}
          disabled={loading && items.length === 0}
          ariaLabel="Decade"
        />
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
            Loading recommendations…
          </div>
        ) : (
          <>
            {explanation && (
              <p
                className={
                  embedded ? RECO_SECONDARY_LINE : "text-[14px] leading-[1.6] text-[var(--muted)]"
                }
              >
                {explanation}
              </p>
            )}
            {items.length > 0 ? (
              <>
                <ul
                  className={
                    embedded
                      ? RECO_RESULTS_LIST
                      : explanation
                        ? "mt-5 grid gap-5 sm:mt-6 sm:gap-6"
                        : "mt-6 grid gap-5 sm:mt-7 sm:gap-6"
                  }
                >
                  {(listExpanded
                    ? items
                    : items.slice(0, RECO_VISIBLE_INITIAL.explore)
                  ).map((r) => (
                    <li key={r.imdb_title_id}>
                      <RecommendationCard
                        imdb_title_id={r.imdb_title_id}
                        title={r.title}
                        year={r.year}
                        genres={r.genres}
                        user_rating={r.user_rating}
                        poster={r.poster}
                        reasons={r.reasons}
                      />
                    </li>
                  ))}
                </ul>
                <ExpandableRecoListFooter
                  expanded={listExpanded}
                  onToggle={() => setListExpanded((e) => !e)}
                  initialVisible={RECO_VISIBLE_INITIAL.explore}
                  total={items.length}
                />
              </>
            ) : (
              <p
                className={
                  embedded
                    ? RECO_EMPTY_PANEL
                    : explanation
                      ? "mt-4 rounded-lg border border-dashed border-[var(--card-border)] py-8 text-center text-[14px] text-[var(--muted)] sm:mt-5"
                      : "mt-5 rounded-lg border border-dashed border-[var(--card-border)] py-8 text-center text-[14px] text-[var(--muted)] sm:mt-6"
                }
              >
                {emptyMessage}
              </p>
            )}
          </>
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
