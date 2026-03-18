"use client";

import { useEffect, useState } from "react";

const API_URL = "http://localhost:8000";

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
    <section className="mt-12 sm:mt-16">
      <p className="text-sm font-normal tracking-wide text-[var(--muted)]">
        Your ratings
      </p>
      <p className="mt-2 text-[15px] font-normal leading-relaxed text-[var(--foreground)] sm:text-base">
        {summary.total_ratings} titles · avg {summary.average_rating?.toFixed(1) ?? "—"}
        {summary.min_rating != null && summary.max_rating != null && (
          <> · {summary.min_rating}–{summary.max_rating}</>
        )}
      </p>
      {distribution?.most_common_rating != null && (
        <p className="mt-1.5 text-sm font-normal italic text-[var(--muted)]">
          Your most common rating is {distribution.most_common_rating}.{" "}
          {distribution.count_rated_6} sixes, {distribution.count_rated_7} sevens, {distribution.count_rated_8_plus} eight-plus.
        </p>
      )}
    </section>
  );
}
