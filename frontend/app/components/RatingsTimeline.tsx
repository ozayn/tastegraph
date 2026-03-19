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
    <div>
      <p className="text-[18px] font-semibold tabular-nums text-[var(--foreground)] sm:text-[20px]">
        {startYear}–{endYear}
      </p>
      <p className="mt-0.5 text-[12px] text-[var(--overview-muted)]">
        year span{span > 1 && ` · ${span} yrs`}
      </p>
    </div>
  );
}
