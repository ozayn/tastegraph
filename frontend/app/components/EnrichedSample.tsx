"use client";

import { useEffect, useState } from "react";
import { API_URL } from "../lib/api";

type Item = {
  imdb_title_id: string;
  title: string | null;
  year: number | null;
  genres: string | null;
  user_rating: number | null;
  date_rated: string | null;
};

export function EnrichedSample() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/ratings/enriched-sample?limit=5`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  if (items.length === 0) return null;

  return (
    <p className="text-[13px] leading-[1.5] text-[var(--overview-muted)]">
      <span className="font-medium text-[var(--muted-soft)]">Enriched</span>
      <span className="text-[var(--overview-muted)]"> · </span>
      <span className="break-words">
        {items.map((r, i) => (
          <span key={r.imdb_title_id}>
            {i > 0 && " · "}
            {r.title ?? r.imdb_title_id}
            {r.year != null ? ` (${r.year})` : ""}
          </span>
        ))}
      </span>
    </p>
  );
}
