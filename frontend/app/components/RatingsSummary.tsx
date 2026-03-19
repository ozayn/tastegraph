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
    <section className="rounded-xl border border-[var(--section-border)] bg-[var(--section-bg)] px-5 py-6 sm:px-6 sm:py-7">
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--overview-muted)]">
        Your ratings
      </p>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2 sm:mt-5 sm:gap-x-8">
        <div>
          <span className="text-[28px] font-semibold tabular-nums tracking-tight text-[var(--foreground)] sm:text-[32px]">
            {summary.total_ratings.toLocaleString()}
          </span>
          <span className="ml-1.5 text-[15px] text-[var(--muted-soft)] sm:text-[16px]">titles</span>
        </div>
        <div>
          <span className="text-[22px] font-semibold tabular-nums tracking-tight text-[var(--foreground)] sm:text-[26px]">
            {summary.average_rating?.toFixed(1) ?? "—"}
          </span>
          <span className="ml-1.5 text-[15px] text-[var(--muted-soft)] sm:text-[16px]">avg</span>
        </div>
        {summary.min_rating != null && summary.max_rating != null && (
          <div className="text-[14px] text-[var(--overview-muted)]">
            {summary.min_rating}–{summary.max_rating} range
          </div>
        )}
      </div>
      {distribution?.most_common_rating != null && (
        <p className="mt-4 text-[12px] leading-[1.5] text-[var(--overview-muted)] sm:mt-5">
          Most common: {distribution.most_common_rating} · {distribution.count_rated_6} sixes, {distribution.count_rated_7} sevens, {distribution.count_rated_8_plus} eight-plus
        </p>
      )}
    </section>
  );
}
