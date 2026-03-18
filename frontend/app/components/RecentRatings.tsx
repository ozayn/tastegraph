"use client";

import { useEffect, useState } from "react";

const API_URL = "http://localhost:8000";

type RecentItem = {
  imdb_title_id: string;
  title: string | null;
  user_rating: number | null;
  date_rated: string | null;
};

export function RecentRatings() {
  const [items, setItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/ratings/recent?limit=5`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  if (items.length === 0) return null;

  return (
    <p className="mt-3 text-sm font-normal leading-[1.65] text-[var(--foreground)]">
      <span className="text-[var(--muted-soft)]">Recent</span>
      <span className="text-[var(--muted-subtle)]"> · </span>
      <span className="break-words">
        {items.map((r, i) => (
          <span key={r.imdb_title_id}>
            {i > 0 && " · "}
            {r.title ?? r.imdb_title_id} {r.user_rating ?? "—"}
          </span>
        ))}
      </span>
    </p>
  );
}
