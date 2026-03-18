"use client";

import { useEffect, useState } from "react";

const API_URL = "http://localhost:8000";

type Summary = {
  total_ratings: number;
  average_rating: number | null;
  min_rating: number | null;
  max_rating: number | null;
};

export function RatingsSummary() {
  const [data, setData] = useState<Summary | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/ratings/summary`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) return null;

  return (
    <section className="mt-16">
      <p className="text-sm font-normal tracking-wide text-[var(--foreground)]/50">
        Your ratings
      </p>
      <p className="mt-2 font-light text-[var(--foreground)]/80">
        {data.total_ratings} titles · avg {data.average_rating?.toFixed(1) ?? "—"}
        {data.min_rating != null && data.max_rating != null && (
          <> · {data.min_rating}–{data.max_rating}</>
        )}
      </p>
    </section>
  );
}
