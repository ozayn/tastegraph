"use client";

import { useCallback, useEffect, useState } from "react";
import { API_URL } from "../lib/api";
import { CountryMultiSelect } from "./CountryMultiSelect";
import { GenreMultiSelect } from "./GenreMultiSelect";

type Item = {
  imdb_title_id: string;
  title: string | null;
  year: number | null;
  genres: string | null;
  user_rating: number | null;
};

export function SimpleRecommendations() {
  const [items, setItems] = useState<Item[]>([]);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [titleType, setTitleType] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");

  const fetchWithFilters = useCallback(
    (genres: string[], countries: string[], tt: string, yf: string, yt: string) => {
      setLoading(true);
      const baseParams = new URLSearchParams();
      genres.forEach((g) => baseParams.append("genres", g));
      countries.forEach((c) => baseParams.append("countries", c));
      if (tt) baseParams.set("title_type", tt);
      const yfNum = Number(yf.trim());
      if (yf.trim() && !isNaN(yfNum) && yfNum >= 1900 && yfNum <= 2100) {
        baseParams.set("year_from", String(Math.floor(yfNum)));
      }
      const ytNum = Number(yt.trim());
      if (yt.trim() && !isNaN(ytNum) && ytNum >= 1900 && ytNum <= 2100) {
        baseParams.set("year_to", String(Math.floor(ytNum)));
      }

      const recParams = new URLSearchParams(baseParams);
      recParams.set("limit", "10");

      Promise.all([
        fetch(`${API_URL}/recommendations/simple?${recParams}`).then((res) =>
          res.ok ? res.json() : Promise.reject()
        ),
        fetch(`${API_URL}/recommendations/simple-explanation?${baseParams}`).then(
          (res) => (res.ok ? res.json() : Promise.reject())
        ),
      ])
        .then(([recs, expl]) => {
          setItems(recs);
          setExplanation(expl.explanation ?? null);
        })
        .catch(() => {
          setItems([]);
          setExplanation(null);
        })
        .finally(() => setLoading(false));
    },
    []
  );

  useEffect(() => {
    fetchWithFilters([], [], "", "", "");
  }, [fetchWithFilters]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchWithFilters(selectedGenres, selectedCountries, titleType, yearFrom, yearTo);
  };

  return (
    <section className="rounded-lg border border-[var(--section-border)] bg-[var(--section-bg)] px-4 py-5 sm:px-6 sm:py-6">
      <h2 className="text-[13px] font-medium uppercase tracking-[0.1em] text-[var(--muted-soft)]">
        Simple recommendations
      </h2>

      <form
        onSubmit={handleSubmit}
        className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-3 sm:mt-5 sm:gap-x-6"
      >
        <GenreMultiSelect
          selected={selectedGenres}
          onChange={setSelectedGenres}
          disabled={loading}
        />
        <CountryMultiSelect
          selected={selectedCountries}
          onChange={setSelectedCountries}
          disabled={loading}
        />
        <select
          value={titleType}
          onChange={(e) => setTitleType(e.target.value)}
          className="min-w-[6rem] border-b border-[var(--muted-subtle)] bg-transparent pb-1.5 pt-0.5 pr-6 text-[14px] text-[var(--foreground)] transition-colors duration-150 focus:border-[var(--muted-soft)] focus:outline-none [color-scheme:inherit] sm:min-w-[6.5rem]"
          aria-label="Title type"
        >
          <option value="">All</option>
          <option value="movie">movie</option>
          <option value="series">series</option>
          <option value="episode">episode</option>
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
        <button
          type="submit"
          className="pb-1.5 pt-0.5 text-[13px] font-medium tracking-[0.04em] text-[var(--muted-soft)] transition-colors duration-150 hover:text-[var(--foreground)] focus:outline-none focus:underline active:opacity-70"
        >
          Apply
        </button>
      </form>

      {loading ? (
        <p className="mt-4 text-sm text-[var(--muted-subtle)] sm:mt-5">
          …
        </p>
      ) : (
        <>
          {explanation && (
            <p className="mt-4 text-[14px] leading-[1.6] text-[var(--muted-soft)] sm:mt-5">
              {explanation}
            </p>
          )}
          {items.length > 0 ? (
            <ul
              className={
                explanation
                  ? "mt-3 space-y-2.5 sm:mt-4 sm:space-y-3"
                  : "mt-4 space-y-2.5 sm:mt-5 sm:space-y-3"
              }
            >
            {items.map((r) => (
              <li
                key={r.imdb_title_id}
                className="text-[15px] leading-[1.65] text-[var(--foreground)] break-words sm:text-[15px]"
              >
                {r.title ?? r.imdb_title_id}
                {r.year != null && ` (${r.year})`}
                {r.genres && ` · ${r.genres}`}
                {r.user_rating != null && ` · ${r.user_rating}`}
              </li>
            ))}
          </ul>
          ) : (
            <p
              className={
                explanation
                  ? "mt-3 text-sm text-[var(--muted-soft)] sm:mt-4"
                  : "mt-4 text-sm text-[var(--muted-soft)] sm:mt-5"
              }
            >
              No results.
            </p>
          )}
        </>
      )}
    </section>
  );
}
