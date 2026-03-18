"use client";

import { useCallback, useEffect, useState } from "react";

const API_URL = "http://localhost:8000";

type Item = {
  imdb_title_id: string;
  title: string | null;
  title_type: string | null;
  year: number | null;
  your_rating: number | null;
  date_rated: string | null;
};

export function WatchlistRecommendations() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [titleType, setTitleType] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");

  const fetchWithFilters = useCallback(
    (tt: string, yf: string, yt: string) => {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("limit", "5");
      if (tt) params.set("title_type", tt);
      if (yf.trim() && !isNaN(Number(yf))) params.set("year_from", yf.trim());
      if (yt.trim() && !isNaN(Number(yt))) params.set("year_to", yt.trim());

      fetch(`${API_URL}/recommendations/watchlist-simple?${params}`)
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then(setItems)
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    },
    []
  );

  useEffect(() => {
    fetchWithFilters("", "", "");
  }, [fetchWithFilters]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchWithFilters(titleType, yearFrom, yearTo);
  };

  return (
    <section className="mt-16 sm:mt-20">
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-soft)]">
        From your watchlist
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-3 sm:mt-5"
      >
        <select
          value={titleType}
          onChange={(e) => setTitleType(e.target.value)}
          className="min-w-[6rem] border-b border-[var(--muted-subtle)] bg-transparent py-1.5 pr-6 text-sm text-[var(--foreground)] focus:border-[var(--muted-soft)] focus:outline-none [color-scheme:inherit]"
          aria-label="Title type"
        >
          <option value="">All</option>
          <option value="Movie">Movie</option>
          <option value="TV Series">TV Series</option>
          <option value="TV Mini Series">TV Mini Series</option>
        </select>
        <input
          type="text"
          inputMode="numeric"
          placeholder="Year from"
          value={yearFrom}
          onChange={(e) => setYearFrom(e.target.value)}
          className="w-20 border-b border-[var(--muted-subtle)] bg-transparent py-1.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-subtle)] focus:border-[var(--muted-soft)] focus:outline-none sm:w-24"
          aria-label="Year from"
        />
        <input
          type="text"
          inputMode="numeric"
          placeholder="Year to"
          value={yearTo}
          onChange={(e) => setYearTo(e.target.value)}
          className="w-20 border-b border-[var(--muted-subtle)] bg-transparent py-1.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-subtle)] focus:border-[var(--muted-soft)] focus:outline-none sm:w-24"
          aria-label="Year to"
        />
        <button
          type="submit"
          className="text-xs font-medium tracking-wider text-[var(--muted-soft)] hover:text-[var(--foreground)] focus:outline-none focus:underline"
        >
          Apply
        </button>
      </form>

      {loading ? (
        <p className="mt-4 text-sm text-[var(--muted-subtle)] sm:mt-5">…</p>
      ) : items.length > 0 ? (
        <ul className="mt-4 space-y-2.5 sm:mt-5 sm:space-y-3">
          {items.map((r) => (
            <li
              key={r.imdb_title_id}
              className="text-[15px] font-normal leading-[1.6] text-[var(--foreground)] break-words sm:text-base"
            >
              {r.title ?? r.imdb_title_id}
              {r.year != null && ` (${r.year})`}
              {r.title_type && ` · ${r.title_type}`}
              {r.your_rating != null && ` · ${r.your_rating}`}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-[var(--muted-soft)] sm:mt-5">
          No results.
        </p>
      )}
    </section>
  );
}
