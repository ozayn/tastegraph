"use client";

import { useEffect, useState } from "react";

const API_URL = "http://localhost:8000";

type Item = {
  imdb_title_id: string;
  title: string | null;
  user_rating: number | null;
  date_rated: string | null;
};

export function StrongPositiveSample() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/ratings/strong-positive-sample?limit=5`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  if (items.length === 0) return null;

  return (
    <p className="text-[13px] leading-[1.5] text-[var(--overview-muted)]">
      <span>Strong signals</span>
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
