"use client";

import { useCallback, useEffect, useState } from "react";

const API_URL = "http://localhost:8000";

type Item = {
  imdb_title_id: string;
  title: string | null;
  year: number | null;
  genres: string | null;
  user_rating: number | null;
};

export function SimpleRecommendations() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [genre, setGenre] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");

  const fetchWithFilters = useCallback(
    (g: string, yf: string, yt: string) => {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("limit", "10");
      if (g.trim()) params.set("genre_contains", g.trim());
      if (yf.trim() && !isNaN(Number(yf))) params.set("year_from", yf.trim());
      if (yt.trim() && !isNaN(Number(yt))) params.set("year_to", yt.trim());

      fetch(`${API_URL}/recommendations/simple?${params}`)
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
    fetchWithFilters(genre, yearFrom, yearTo);
  };

  return (
    <section className="mt-16 sm:mt-20">
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-soft)]">
        Simple recommendations
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-3 sm:mt-5">
        <input
          type="text"
          placeholder="Genre"
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          className="w-28 border-b border-[var(--muted-subtle)] bg-transparent py-1.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-subtle)] focus:border-[var(--muted-soft)] focus:outline-none sm:w-36"
          aria-label="Filter by genre"
        />
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
        <p className="mt-4 text-sm text-[var(--muted-subtle)] sm:mt-5">
          …
        </p>
      ) : items.length > 0 ? (
        <ul className="mt-4 space-y-2.5 sm:mt-5 sm:space-y-3">
          {items.map((r) => (
            <li
              key={r.imdb_title_id}
              className="text-[15px] font-normal leading-[1.6] text-[var(--foreground)] break-words sm:text-base"
            >
              {r.title ?? r.imdb_title_id}
              {r.year != null && ` (${r.year})`}
              {r.genres && ` · ${r.genres}`}
              {r.user_rating != null && ` · ${r.user_rating}`}
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
