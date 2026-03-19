"use client";

import { useCallback, useEffect, useState } from "react";
import { API_URL } from "../lib/api";
import { CountryMultiSelect } from "./CountryMultiSelect";
import { GenreMultiSelect } from "./GenreMultiSelect";

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
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [titleType, setTitleType] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [includeRated, setIncludeRated] = useState(false);

  const fetchWithFilters = useCallback(
    (genres: string[], countries: string[], tt: string, yf: string, yt: string, incRated: boolean) => {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("limit", "5");
      genres.forEach((g) => params.append("genres", g));
      countries.forEach((c) => params.append("countries", c));
      if (tt) params.set("title_type", tt);
      const yfNum = Number(yf.trim());
      if (yf.trim() && !isNaN(yfNum) && yfNum >= 1900 && yfNum <= 2100) {
        params.set("year_from", String(Math.floor(yfNum)));
      }
      const ytNum = Number(yt.trim());
      if (yt.trim() && !isNaN(ytNum) && ytNum >= 1900 && ytNum <= 2100) {
        params.set("year_to", String(Math.floor(ytNum)));
      }
      if (incRated) params.set("include_rated", "true");

      fetch(`${API_URL}/recommendations/watchlist-simple?${params}`)
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then(setItems)
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    },
    []
  );

  useEffect(() => {
    fetchWithFilters(selectedGenres, selectedCountries, titleType, yearFrom, yearTo, includeRated);
  }, [fetchWithFilters, includeRated]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchWithFilters(selectedGenres, selectedCountries, titleType, yearFrom, yearTo, includeRated);
  };

  return (
    <section className="rounded-lg border border-[var(--section-border)] bg-[var(--section-bg)] px-4 py-5 sm:px-6 sm:py-6">
      <h2 className="text-[13px] font-medium uppercase tracking-[0.1em] text-[var(--muted-soft)]">
        From your watchlist
      </h2>

      <form
        onSubmit={handleSubmit}
        className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-3 sm:mt-5 sm:gap-x-6"
      >
        <GenreMultiSelect
          selected={selectedGenres}
          onChange={setSelectedGenres}
          disabled={loading}
          genresUrl={`${API_URL}/recommendations/watchlist-genres`}
          fallbackGenresUrl={`${API_URL}/recommendations/genres`}
        />
        <CountryMultiSelect
          selected={selectedCountries}
          onChange={setSelectedCountries}
          disabled={loading}
          countriesUrl={`${API_URL}/recommendations/watchlist-countries`}
        />
        <select
          value={titleType}
          onChange={(e) => setTitleType(e.target.value)}
          className="min-w-[6rem] border-b border-[var(--muted-subtle)] bg-transparent pb-1.5 pt-0.5 pr-6 text-[14px] text-[var(--foreground)] transition-colors duration-150 focus:border-[var(--muted-soft)] focus:outline-none [color-scheme:inherit] sm:min-w-[6.5rem]"
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
          className="w-20 border-b border-[var(--muted-subtle)] bg-transparent pb-1.5 pt-0.5 text-[14px] text-[var(--foreground)] placeholder:text-[var(--muted-subtle)]/70 transition-colors duration-150 focus:border-[var(--muted-soft)] focus:outline-none sm:w-24"
          aria-label="Year from"
        />
        <input
          type="text"
          inputMode="numeric"
          placeholder="Year to"
          value={yearTo}
          onChange={(e) => setYearTo(e.target.value)}
          className="w-20 border-b border-[var(--muted-subtle)] bg-transparent pb-1.5 pt-0.5 text-[14px] text-[var(--foreground)] placeholder:text-[var(--muted-subtle)]/70 transition-colors duration-150 focus:border-[var(--muted-soft)] focus:outline-none sm:w-24"
          aria-label="Year to"
        />
        <label className="flex cursor-pointer items-baseline gap-2 pb-1.5 pt-0.5 text-[14px] text-[var(--muted-soft)] transition-colors hover:text-[var(--foreground)]">
          <input
            type="checkbox"
            checked={includeRated}
            onChange={(e) => setIncludeRated(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--foreground)]"
            aria-label="Include rated"
          />
          <span>Include rated</span>
        </label>
        <button
          type="submit"
          className="pb-1.5 pt-0.5 text-[13px] font-medium tracking-[0.04em] text-[var(--muted-soft)] transition-colors duration-150 hover:text-[var(--foreground)] focus:outline-none focus:underline active:opacity-70"
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
              className="text-[15px] leading-[1.65] text-[var(--foreground)] break-words sm:text-[15px]"
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
