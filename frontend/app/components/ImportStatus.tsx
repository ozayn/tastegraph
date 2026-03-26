"use client";

import { useEffect, useState } from "react";
import { API_URL } from "../lib/api";

type ImportStatusData = {
  total_imported_ratings: number;
  has_ratings_data: boolean;
  latest_imported_created_at: string | null;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ImportStatus() {
  const [data, setData] = useState<ImportStatusData | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/ratings/import-status`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) return null;

  const count = data.total_imported_ratings.toLocaleString();
  const lastImported = data.latest_imported_created_at
    ? formatDate(data.latest_imported_created_at)
    : null;

  return (
    <div className="flex flex-col gap-1">
      <p className="text-[22px] font-semibold tabular-nums tracking-[-0.02em] text-[var(--foreground)] sm:text-[24px]">
        {count}
      </p>
      <p className="text-[12px] leading-snug text-[var(--overview-muted)]">
        Ratings{lastImported && <span className="text-[var(--muted-subtle)]"> · </span>}
        {lastImported}
      </p>
    </div>
  );
}
