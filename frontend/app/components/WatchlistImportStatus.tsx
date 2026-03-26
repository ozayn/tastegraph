"use client";

import { useEffect, useState } from "react";
import { API_URL } from "../lib/api";

type WatchlistImportStatusData = {
  total_watchlist_items: number;
  has_watchlist_data: boolean;
  latest_imported_created_at: string | null;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function WatchlistImportStatus() {
  const [data, setData] = useState<WatchlistImportStatusData | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/watchlist/import-status`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data || !data.has_watchlist_data) return null;

  const count = data.total_watchlist_items.toLocaleString();
  const lastImported = data.latest_imported_created_at
    ? formatDate(data.latest_imported_created_at)
    : null;

  return (
    <div className="flex flex-col gap-1">
      <p className="text-[22px] font-semibold tabular-nums tracking-[-0.02em] text-[var(--foreground)] sm:text-[24px]">
        {count}
      </p>
      <p className="text-[12px] leading-snug text-[var(--overview-muted)]">
        Watchlist{lastImported && <span className="text-[var(--muted-subtle)]"> · </span>}
        {lastImported}
      </p>
    </div>
  );
}
