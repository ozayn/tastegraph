"use client";

import { useEffect, useState } from "react";
import { API_URL } from "../lib/api";
import { HighFitCard } from "./HighFitCard";

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

  useEffect(() => {
    fetch(`${API_URL}/recommendations/watchlist-high-fit?limit=15`)
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
        No unrated watchlist items with strong taste alignment yet. Add titles to your watchlist and rate more 8+ to build signals.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
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
  );
}
