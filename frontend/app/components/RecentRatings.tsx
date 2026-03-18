"use client";

import { useEffect, useState } from "react";
import { API_URL } from "../lib/api";

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
    <p className="text-[13px] leading-[1.5] text-[var(--overview-muted)]">
      <span>Recent</span>
      <span className="text-[var(--overview-muted)] opacity-70"> · </span>
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
