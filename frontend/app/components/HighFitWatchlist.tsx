"use client";

import { useEffect, useState } from "react";
import { API_URL } from "../lib/api";
import { HighFitCard } from "./HighFitCard";
import {
  getInitialPoolFilters,
  poolFiltersToQueryString,
  RecommendationPoolFiltersBar,
  type RecommendationPoolFilterValues,
} from "./RecommendationPoolFiltersBar";
import {
  RECO_EMPTY_MESSAGE,
  RECO_LOADING_DOT,
  RECO_LOADING_ROW,
  RECO_RESULTS_LIST,
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
  const [loading, setLoading] = useState(true);
  const [poolFilters, setPoolFilters] = useState<RecommendationPoolFilterValues>(
    getInitialPoolFilters
  );

  useEffect(() => {
    const q = poolFiltersToQueryString(poolFilters);
    fetch(`${API_URL}/recommendations/watchlist-high-fit?limit=15${q}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [poolFilters]);

  if (loading) {
    return (
      <div>
        <RecommendationPoolFiltersBar
          idPrefix="whf"
          value={poolFilters}
          onChange={setPoolFilters}
        />
        <div className={RECO_LOADING_ROW}>
          <span className={RECO_LOADING_DOT} />
          Loading…
        </div>
      </div>
    );
  }

  const filtersActive =
    poolFilters.decade ||
    poolFilters.country.trim() ||
    poolFilters.similarTo.trim();

  if (!items.length) {
    return (
      <div>
        <RecommendationPoolFiltersBar
          idPrefix="whf"
          value={poolFilters}
          onChange={setPoolFilters}
        />
        <p className={RECO_EMPTY_MESSAGE}>
          {filtersActive
            ? "No watchlist items match these filters with strong taste alignment. Try loosening decade, country, or similar-to."
            : "No unrated watchlist items with strong taste alignment yet. Add titles to your watchlist and rate more 8+ to build signals."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <RecommendationPoolFiltersBar
        idPrefix="whf"
        value={poolFilters}
        onChange={setPoolFilters}
      />
      <ul className={RECO_RESULTS_LIST}>
      {items.map((item) => (
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
    </div>
  );
}
