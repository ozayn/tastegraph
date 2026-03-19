"use client";

import { useEffect, useState } from "react";
import { API_URL } from "../lib/api";
import { RecommendationCard } from "./RecommendationCard";

type HighFitItem = {
  imdb_title_id: string;
  title: string | null;
  title_type: string | null;
  year: number | null;
  poster: string | null;
  matching_signals: string[];
};

export function HighFitWatchlist() {
  const [items, setItems] = useState<HighFitItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/recommendations/watchlist-high-fit?limit=10`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[14px] text-[var(--muted-soft)]">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--muted-subtle)]" />
        Loading…
      </div>
    );
  }

  if (!items.length) {
    return (
      <p className="text-[14px] text-[var(--muted-soft)]">
        No unrated watchlist items with strong taste alignment. Add more titles or rate some to refresh.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.imdb_title_id}>
          <RecommendationCard
            imdb_title_id={item.imdb_title_id}
            title={item.title}
            year={item.year}
            title_type={item.title_type}
            poster={item.poster}
            reasons={item.matching_signals}
          />
        </li>
      ))}
    </ul>
  );
}
