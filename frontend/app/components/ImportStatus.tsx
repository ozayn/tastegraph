"use client";

import { useEffect, useState } from "react";

const API_URL = "http://localhost:8000";

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
    <p className="text-[13px] leading-[1.5] text-[var(--overview-muted)]">
      {count} ratings in your library
      {lastImported && ` · updated ${lastImported}`}
    </p>
  );
}
