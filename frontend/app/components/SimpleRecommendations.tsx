"use client";

import { useCallback, useEffect, useState } from "react";
import { API_URL } from "../lib/api";
import { CountryMultiSelect } from "./CountryMultiSelect";
import { GenreMultiSelect } from "./GenreMultiSelect";
import { RecommendationCard } from "./RecommendationCard";

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

  const filterInput =
    "rounded-lg border border-[var(--section-border)] bg-[var(--card-bg)] px-3 py-2.5 text-[14px] text-[var(--foreground)] placeholder:text-[var(--muted-subtle)] transition-colors focus:border-[var(--muted-soft)] focus:outline-none focus:ring-1 focus:ring-[var(--muted-subtle)]/30 [color-scheme:inherit]";

  return (
    <section className="rounded-xl border border-[var(--section-border)] bg-[var(--section-bg)] px-6 py-7 sm:px-8 sm:py-8">
      <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--foreground)] sm:text-[19px]">
        Recommendations for you
      </h2>
      <p className="mt-1.5 text-[14px] leading-[1.5] text-[var(--muted-soft)]">
        Based on your ratings and taste profile
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 flex flex-wrap items-center gap-3 sm:mt-7 sm:gap-4"
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
          className={`${filterInput} min-w-[7rem]`}
          aria-label="Title type"
        >
          <option value="">All types</option>
          <option value="movie">Movie</option>
          <option value="series">Series</option>
          <option value="episode">Episode</option>
        </select>
        <input
          type="text"
          inputMode="numeric"
          placeholder="Year from"
          value={yearFrom}
          onChange={(e) => setYearFrom(e.target.value)}
          className={`${filterInput} w-24`}
          aria-label="Year from"
        />
        <input
          type="text"
          inputMode="numeric"
          placeholder="Year to"
          value={yearTo}
          onChange={(e) => setYearTo(e.target.value)}
          className={`${filterInput} w-24`}
          aria-label="Year to"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[var(--foreground)] px-5 py-2.5 text-[14px] font-medium text-[var(--background)] transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--muted-soft)] focus:ring-offset-2 focus:ring-offset-[var(--background)] disabled:opacity-60"
        >
          {loading ? "…" : "Apply"}
        </button>
      </form>

      {loading ? (
        <div className="mt-7 flex items-center gap-2.5 text-[14px] text-[var(--muted-soft)]">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--muted-subtle)]" />
          Loading recommendations…
        </div>
      ) : (
        <>
          {explanation && (
            <p className="mt-5 text-[14px] leading-[1.6] text-[var(--muted-soft)] sm:mt-6">
              {explanation}
            </p>
          )}
          {items.length > 0 ? (
            <ul
              className={
                explanation
                  ? "mt-5 grid gap-4 sm:mt-6 sm:gap-5"
                  : "mt-6 grid gap-4 sm:mt-7 sm:gap-5"
              }
            >
              {items.map((r) => (
                <li key={r.imdb_title_id}>
                  <RecommendationCard
                    imdb_title_id={r.imdb_title_id}
                    title={r.title}
                    year={r.year}
                    genres={r.genres}
                    user_rating={r.user_rating}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p
              className={
                explanation
                  ? "mt-4 rounded-lg border border-dashed border-[var(--section-border)] py-8 text-center text-[14px] text-[var(--muted-soft)] sm:mt-5"
                  : "mt-5 rounded-lg border border-dashed border-[var(--section-border)] py-8 text-center text-[14px] text-[var(--muted-soft)] sm:mt-6"
              }
            >
              No results. Try adjusting your filters.
            </p>
          )}
        </>
      )}
    </section>
  );
}
