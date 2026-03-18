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
      <p className="text-sm font-normal tracking-wide text-[var(--muted)]">
        Simple recommendations
      </p>
      <ul className="mt-4 space-y-3 sm:mt-6 sm:space-y-4">
        {items.map((r) => (
          <li
            key={r.imdb_title_id}
            className="font-normal leading-relaxed text-[var(--foreground)] break-words"
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
