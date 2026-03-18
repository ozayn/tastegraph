"use client";

import { useEffect, useState } from "react";
import { API_URL } from "../lib/api";

type ByYear = {
  earliest_rating_date: string | null;
  latest_rating_date: string | null;
};

export function RatingsTimeline() {
  const [data, setData] = useState<ByYear | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/ratings/by-year`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data?.earliest_rating_date || !data?.latest_rating_date) return null;

  const startYear = data.earliest_rating_date.slice(0, 4);
  const endYear = data.latest_rating_date.slice(0, 4);
  const span = parseInt(endYear, 10) - parseInt(startYear, 10) + 1;

  return (
    <p className="text-[13px] leading-[1.5] text-[var(--overview-muted)]">
      Your ratings span {startYear}–{endYear}
      {span > 1 && ` (${span} years)`}
    </p>
  );
}
