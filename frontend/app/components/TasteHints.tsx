"use client";

import { useEffect, useState } from "react";
import { API_URL } from "../lib/api";

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
    <p className="text-[13px] leading-[1.5] text-[var(--overview-muted)]">
      Strong: {data.strong_positive_threshold}+ · weak: &lt;{data.weak_negative_threshold}
    </p>
  );
}
