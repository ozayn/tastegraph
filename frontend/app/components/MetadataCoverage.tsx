"use client";

import { useEffect, useState } from "react";
import { API_URL } from "../lib/api";

type CoverageData = {
  total_ratings: number;
  ratings_with_metadata: number;
  ratings_without_metadata: number;
  coverage_ratio: number;
};

export function MetadataCoverage() {
  const [data, setData] = useState<CoverageData | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/ratings/metadata-coverage`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) return null;

  const withMeta = data.ratings_with_metadata.toLocaleString();
  const total = data.total_ratings.toLocaleString();

  return (
    <div className="flex flex-col gap-1">
      <p className="text-[22px] font-semibold tabular-nums tracking-[-0.02em] text-[var(--foreground)] sm:text-[24px]">
        {withMeta}/{total}
      </p>
      <p className="text-[12px] leading-snug text-[var(--overview-muted)]">
        Titles with metadata
        <span className="text-[var(--muted-subtle)]"> · </span>
        <span className="text-[var(--muted-soft)]">completeness varies</span>
      </p>
    </div>
  );
}
