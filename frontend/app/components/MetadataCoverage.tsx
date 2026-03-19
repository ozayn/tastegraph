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
    <p className="text-[13px] leading-[1.5] text-[var(--overview-muted)]">
      <span className="font-medium text-[var(--muted-soft)]">{withMeta}</span>/{total} enriched
    </p>
  );
}
