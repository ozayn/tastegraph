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
    <section className="rounded-xl border border-[var(--section-border)] bg-[var(--section-bg)] px-5 py-5 sm:px-6 sm:py-6">
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--overview-muted)]">
        Your ratings
      </p>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-[20px] font-semibold tabular-nums text-[var(--foreground)] sm:text-[22px]">
          {summary.total_ratings.toLocaleString()}
        </span>
        <span className="text-[14px] text-[var(--muted-soft)]">titles</span>
        <span className="text-[13px] text-[var(--overview-muted)]">
          · avg {summary.average_rating?.toFixed(1) ?? "—"}
          {summary.min_rating != null && summary.max_rating != null && (
            <> · {summary.min_rating}–{summary.max_rating}</>
          )}
        </span>
      </div>
      {distribution?.most_common_rating != null && (
        <p className="mt-2 text-[12px] leading-[1.5] text-[var(--overview-muted)]">
          Most common: {distribution.most_common_rating} · {distribution.count_rated_6} sixes, {distribution.count_rated_7} sevens, {distribution.count_rated_8_plus} eight-plus
        </p>
      )}
    </section>
  );
}
