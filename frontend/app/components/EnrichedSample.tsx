"use client";

import { useEffect, useState } from "react";
import { API_URL } from "../lib/api";
import { OverviewTitleRows } from "./OverviewTitleRows";

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
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-soft)]">
        Enriched
      </p>
      <OverviewTitleRows
        items={items}
        afterTitle={(r) =>
          r.year != null ? (
            <span className="tabular-nums text-[12px] text-[var(--muted-soft)]">
              ({r.year})
            </span>
          ) : null
        }
      />
    </div>
  );
}
