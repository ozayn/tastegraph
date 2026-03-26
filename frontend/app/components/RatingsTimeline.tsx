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
    <div className="flex flex-col gap-1">
      <p className="text-[22px] font-semibold tabular-nums tracking-[-0.02em] text-[var(--foreground)] sm:text-[24px]">
        {startYear}–{endYear}
      </p>
      <p className="text-[12px] leading-snug text-[var(--overview-muted)]">
        Year span{span > 1 && (
          <>
            <span className="text-[var(--muted-subtle)]"> · </span>
            {span} yrs
          </>
        )}
      </p>
    </div>
  );
}
