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
    <p className="text-[13px] leading-[1.5] text-[var(--overview-muted)]">
      Strong signals: {data.strong_positive_threshold}+ · weak signals: below {data.weak_negative_threshold}
    </p>
  );
}
