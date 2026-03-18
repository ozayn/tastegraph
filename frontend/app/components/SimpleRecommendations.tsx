"use client";

import { useEffect, useState } from "react";

const API_URL = "http://localhost:8000";

type Item = {
  imdb_title_id: string;
  title: string | null;
  year: number | null;
  genres: string | null;
  user_rating: number | null;
};

export function SimpleRecommendations() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/recommendations/simple?limit=5`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="mt-16 sm:mt-20">
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-soft)]">
        Simple recommendations
      </p>
      <ul className="mt-4 space-y-2.5 sm:mt-5 sm:space-y-3">
        {items.map((r) => (
          <li
            key={r.imdb_title_id}
            className="text-[15px] font-normal leading-[1.6] text-[var(--foreground)] break-words sm:text-base"
          >
            {r.title ?? r.imdb_title_id}
            {r.year != null && ` (${r.year})`}
            {r.genres && ` · ${r.genres}`}
            {r.user_rating != null && ` · ${r.user_rating}`}
          </li>
        ))}
      </ul>
    </section>
  );
}
