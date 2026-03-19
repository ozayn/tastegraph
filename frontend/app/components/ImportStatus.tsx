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
    <div>
      <p className="text-[18px] font-semibold tabular-nums text-[var(--foreground)] sm:text-[20px]">
        {count}
      </p>
      <p className="mt-0.5 text-[12px] text-[var(--overview-muted)]">
        ratings{lastImported && ` · ${lastImported}`}
      </p>
    </div>
  );
}
