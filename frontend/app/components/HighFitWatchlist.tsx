"use client";

import { useEffect, useRef, useState } from "react";
import { API_URL } from "../lib/api";
import { ExpandableRecoListFooter } from "./ExpandableRecoListFooter";
import { HighFitCard } from "./HighFitCard";
import {
  getInitialPoolFilters,
  poolFiltersToQueryString,
  RecommendationPoolFiltersBar,
  type RecommendationPoolFilterValues,
} from "./RecommendationPoolFiltersBar";
import { normalizeExploreDecade } from "./recoFilterPickers";
import {
  RECO_EMPTY_MESSAGE,
  RECO_LOADING_DOT,
  RECO_LOADING_ROW,
  RECO_RESULTS_LIST,
  RECO_RESULTS_SHELL,
  RECO_STALE_DIM,
  RECO_UPDATING_CORNER,
  RECO_VISIBLE_INITIAL,
} from "./recommendationModeStyles";

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
  title_type: string | null;
  year: number | null;
  poster: string | null;
  explanation: HighFitExplanation;
};

export function HighFitWatchlist() {
  const [items, setItems] = useState<HighFitItem[]>([]);
  const [listExpanded, setListExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [poolFilters, setPoolFilters] = useState<RecommendationPoolFilterValues>(
    getInitialPoolFilters
  );
  const itemsRef = useRef<HighFitItem[]>([]);
  const requestIdRef = useRef(0);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    setListExpanded(false);
  }, [poolFilters]);

  useEffect(() => {
    const id = ++requestIdRef.current;
    const hadItems = itemsRef.current.length > 0;
    if (hadItems) setRefreshing(true);
    else setLoading(true);

    const q = poolFiltersToQueryString(poolFilters);
    fetch(`${API_URL}/recommendations/watchlist-high-fit?limit=15${q}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((rows) => {
        if (id !== requestIdRef.current) return;
        setItems(rows as HighFitItem[]);
      })
      .catch(() => {
        if (id !== requestIdRef.current) return;
        if (!hadItems) setItems([]);
      })
      .finally(() => {
        if (id !== requestIdRef.current) return;
        setLoading(false);
        setRefreshing(false);
      });
  }, [poolFilters]);

  const filtersActive =
    !!normalizeExploreDecade(poolFilters.decade) ||
    poolFilters.country.trim() ||
    poolFilters.similarTo.trim();

  const filtersBar = (
    <RecommendationPoolFiltersBar
      idPrefix="whf"
      value={poolFilters}
      onChange={setPoolFilters}
      countryEntry="watchlist-picker"
    />
  );

  const showStaleDim = refreshing && items.length > 0;

  return (
    <div>
      {filtersBar}
      <div className={`${RECO_RESULTS_SHELL} ${showStaleDim ? RECO_STALE_DIM : ""}`}>
        {showStaleDim && (
          <div className={RECO_UPDATING_CORNER} aria-live="polite">
            Updating…
          </div>
        )}
        {loading && items.length === 0 ? (
          <div className={RECO_LOADING_ROW}>
            <span className={RECO_LOADING_DOT} />
            Loading…
          </div>
        ) : !items.length ? (
          <p className={RECO_EMPTY_MESSAGE}>
            {filtersActive
              ? "No watchlist items match these filters with strong taste alignment. Try loosening decade, country, or similar-to."
              : "No unrated watchlist items with strong taste alignment yet. Add titles to your watchlist and rate more 8+ to build signals."}
          </p>
        ) : (
          <>
            <ul className={RECO_RESULTS_LIST}>
              {(listExpanded
                ? items
                : items.slice(0, RECO_VISIBLE_INITIAL.highFit)
              ).map((item) => (
                <li key={item.imdb_title_id}>
                  <HighFitCard
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
              initialVisible={RECO_VISIBLE_INITIAL.highFit}
              total={items.length}
            />
          </>
        )}
      </div>
    </div>
  );
}
