"use client";

import { useEffect, useState } from "react";
import { API_URL } from "../lib/api";
import { OverviewTitleRows } from "./OverviewTitleRows";

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
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-soft)]">
        Recent
      </p>
      <OverviewTitleRows
        items={items}
        trailing={(r) => (
          <span className="shrink-0 tabular-nums text-[12px] text-[var(--muted-soft)]">
            {r.user_rating ?? "—"}
          </span>
        )}
      />
    </div>
  );
}
