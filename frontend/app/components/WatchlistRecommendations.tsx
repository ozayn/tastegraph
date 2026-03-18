"use client";

import { useCallback, useEffect, useState } from "react";
import { GenreMultiSelect } from "./GenreMultiSelect";

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
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [titleType, setTitleType] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");

  const fetchWithFilters = useCallback(
    (genres: string[], tt: string, yf: string, yt: string) => {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("limit", "5");
      genres.forEach((g) => params.append("genres", g));
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
    fetchWithFilters([], "", "", "");
  }, [fetchWithFilters]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchWithFilters(selectedGenres, titleType, yearFrom, yearTo);
  };

  return (
    <section className="mt-16 rounded-xl border border-[var(--section-border)] bg-[var(--section-bg)] px-4 py-5 sm:mt-20 sm:px-5 sm:py-6">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--muted-soft)]">
        From your watchlist
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 sm:mt-5"
      >
        <GenreMultiSelect
          selected={selectedGenres}
          onChange={setSelectedGenres}
          disabled={loading}
          genresUrl={`${API_URL}/recommendations/watchlist-genres`}
          fallbackGenresUrl={`${API_URL}/recommendations/genres`}
        />
        <select
          value={titleType}
          onChange={(e) => setTitleType(e.target.value)}
          className="min-w-[6.5rem] border-b border-[var(--muted-subtle)] bg-transparent py-2 pr-7 text-sm text-[var(--foreground)] transition-colors duration-150 focus:border-[var(--muted-soft)] focus:outline-none [color-scheme:inherit]"
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
          className="w-20 border-b border-[var(--muted-subtle)] bg-transparent py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-subtle)]/80 transition-colors duration-150 focus:border-[var(--muted-soft)] focus:outline-none sm:w-24"
          aria-label="Year from"
        />
        <input
          type="text"
          inputMode="numeric"
          placeholder="Year to"
          value={yearTo}
          onChange={(e) => setYearTo(e.target.value)}
          className="w-20 border-b border-[var(--muted-subtle)] bg-transparent py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-subtle)]/80 transition-colors duration-150 focus:border-[var(--muted-soft)] focus:outline-none sm:w-24"
          aria-label="Year to"
        />
        <button
          type="submit"
          className="text-xs font-medium tracking-[0.06em] text-[var(--muted-soft)] transition-colors duration-150 hover:text-[var(--foreground)] focus:outline-none focus:underline active:opacity-70"
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
