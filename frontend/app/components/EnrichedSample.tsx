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
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--overview-muted)]">
        Enriched
      </p>
      <p className="mt-1.5 text-[13px] leading-[1.5] text-[var(--muted-soft)]">
        {items.map((r, i) => (
          <span key={r.imdb_title_id}>
            {i > 0 && " · "}
            {r.imdb_title_id ? (
              <a
                href={`https://www.imdb.com/title/${r.imdb_title_id}/`}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[var(--muted-soft)] underline decoration-[var(--muted-subtle)] underline-offset-2 transition-colors hover:text-[var(--foreground)] hover:decoration-[var(--muted-soft)]"
              >
                {r.title ?? r.imdb_title_id}
              </a>
            ) : (
              <span>{r.title ?? "—"}</span>
            )}
            {r.year != null ? ` (${r.year})` : ""}
          </span>
        ))}
      </p>
    </div>
  );
}
