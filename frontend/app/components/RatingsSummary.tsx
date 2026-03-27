"use client";

import { useEffect, useState } from "react";
import { API_URL } from "../lib/api";

type Summary = {
  total_ratings: number;
  average_rating: number | null;
  min_rating: number | null;
  max_rating: number | null;
};

type Distribution = {
  most_common_rating: number | null;
  count_of_most_common_rating: number;
  count_rated_6: number;
  count_rated_7: number;
  count_rated_8_plus: number;
};

export function RatingsSummary() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [distribution, setDistribution] = useState<Distribution | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/ratings/summary`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setSummary)
      .catch(() => setSummary(null));
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/ratings/distribution`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setDistribution)
      .catch(() => setDistribution(null));
  }, []);

  if (!summary) return null;

  return (
    <section aria-labelledby="home-ratings-heading">
      <h2 id="home-ratings-heading" className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--overview-muted)]">
        Your ratings
      </h2>
      <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-2.5 sm:mt-2.5 sm:gap-x-8">
        <div className="flex flex-col gap-0.5">
          <span className="text-[26px] font-semibold tabular-nums tracking-[-0.02em] text-[var(--foreground)] sm:text-[30px]">
            {summary.total_ratings.toLocaleString()}
          </span>
          <span className="text-[12px] text-[var(--muted)] sm:text-[13px]">Titles rated</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[22px] font-semibold tabular-nums tracking-[-0.02em] text-[var(--foreground)] sm:text-[26px]">
            {summary.average_rating?.toFixed(1) ?? "—"}
          </span>
          <span className="text-[12px] text-[var(--muted)] sm:text-[13px]">Average</span>
        </div>
        {summary.min_rating != null && summary.max_rating != null && (
          <div className="flex flex-col gap-0.5 pb-px">
            <span className="text-[14px] font-medium tabular-nums text-[var(--foreground)] sm:text-[15px]">
              {summary.min_rating}–{summary.max_rating}
            </span>
            <span className="text-[12px] text-[var(--muted)] sm:text-[13px]">Range</span>
          </div>
        )}
      </div>
      {distribution?.most_common_rating != null && (
        <p className="mt-3 max-w-xl text-[12px] leading-relaxed text-[var(--muted-soft)] sm:mt-3.5 sm:text-[13px]">
          Most common score {distribution.most_common_rating}
          <span className="mx-1.5 text-[var(--muted-subtle)]" aria-hidden>
            ·
          </span>
          {distribution.count_rated_6} sixes, {distribution.count_rated_7} sevens, {distribution.count_rated_8_plus} eight-plus
        </p>
      )}
    </section>
  );
}
