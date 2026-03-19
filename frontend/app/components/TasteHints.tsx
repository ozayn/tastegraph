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
    <div>
      <p className="text-[18px] font-semibold tabular-nums text-[var(--foreground)] sm:text-[20px]">
        {data.strong_positive_threshold}+ / &lt;{data.weak_negative_threshold}
      </p>
      <p className="mt-0.5 text-[12px] text-[var(--overview-muted)]">strong / weak</p>
    </div>
  );
}
