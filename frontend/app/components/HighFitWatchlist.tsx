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
      <div className="space-y-3">
        <RecommendationPoolFiltersBar
          idPrefix="whf"
          value={poolFilters}
          onChange={setPoolFilters}
        />
        <div className="flex items-center gap-2 text-[14px] text-[var(--muted-soft)]">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--muted-subtle)]" />
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
      <div className="space-y-3">
        <RecommendationPoolFiltersBar
          idPrefix="whf"
          value={poolFilters}
          onChange={setPoolFilters}
        />
        <p className="text-[14px] text-[var(--muted-soft)]">
          {filtersActive
            ? "No watchlist items match these filters with strong taste alignment. Try loosening decade, country, or similar-to."
            : "No unrated watchlist items with strong taste alignment yet. Add titles to your watchlist and rate more 8+ to build signals."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <RecommendationPoolFiltersBar
        idPrefix="whf"
        value={poolFilters}
        onChange={setPoolFilters}
      />
      <ul className="space-y-4 sm:space-y-5">
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
