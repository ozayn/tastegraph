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
    <div className="flex flex-col gap-1">
      <p className="text-[22px] font-semibold tabular-nums tracking-[-0.02em] text-[var(--foreground)] sm:text-[24px]">
        {data.strong_positive_threshold}+ / &lt;{data.weak_negative_threshold}
      </p>
      <p className="text-[12px] leading-snug text-[var(--overview-muted)]">Strong / weak signals</p>
    </div>
  );
}
