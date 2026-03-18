"use client";

import { useEffect, useState } from "react";

const API_URL = "http://localhost:8000";

type TasteHintsData = {
  strong_positive_threshold: number;
  weak_negative_threshold: number;
};

export function TasteHints() {
  const [data, setData] = useState<TasteHintsData | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/ratings/taste-hints`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) return null;

  return (
    <p className="mt-1.5 text-sm font-normal italic leading-relaxed text-[var(--muted)]">
      For now, {data.strong_positive_threshold}+ counts as a strong signal. Below {data.weak_negative_threshold} is weak negative.
    </p>
  );
}
