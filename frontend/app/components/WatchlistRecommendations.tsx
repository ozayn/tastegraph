"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL } from "../lib/api";
import { CountryMultiSelect } from "./CountryMultiSelect";
import { GenreMultiSelect } from "./GenreMultiSelect";
import { RecommendationCard } from "./RecommendationCard";
import { SectionHelp } from "./SectionHelp";

const DEBOUNCE_MS = 350;
const DISPLAY_LIMIT = 5;
const FETCH_LIMIT = 25;

function hasUsablePoster(poster: string | null | undefined): boolean {
  return !!(poster && poster.trim() && poster !== "N/A");
}

type Item = {
  imdb_title_id: string;
  title: string | null;
  title_type: string | null;
  year: number | null;
  your_rating: number | null;
  date_rated: string | null;
  poster?: string | null;
  reasons?: string[];
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRun = useRef(true);
  const requestIdRef = useRef(0);

  const fetchWithFilters = useCallback(
    (genres: string[], countries: string[], tt: string, yf: string, yt: string, incRated: boolean) => {
      const id = ++requestIdRef.current;
      setLoading(true);
      const params = new URLSearchParams();
      params.set("limit", String(FETCH_LIMIT));
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
        .then((data) => {
          if (id !== requestIdRef.current) return;
          const fetched = data as Item[];
          const withPoster = fetched.filter((r) => hasUsablePoster(r.poster));
          const final = withPoster.slice(0, DISPLAY_LIMIT);
          // DEBUG: remove after verifying poster-only filtering
          console.debug("[WatchlistRecommendations]", {
            totalFetched: fetched.length,
            withUsablePoster: withPoster.length,
            finalTitles: final.map((r) => r.title ?? r.imdb_title_id),
          });
          setItems(final);
        })
        .catch(() => {
          if (id !== requestIdRef.current) return;
          setItems([]);
        })
        .finally(() => {
          if (id !== requestIdRef.current) return;
          setLoading(false);
        });
    },
    []
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const delay = isFirstRun.current ? 0 : DEBOUNCE_MS;
    isFirstRun.current = false;
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      fetchWithFilters(
        selectedGenres,
        selectedCountries,
        titleType,
        yearFrom,
        yearTo,
        includeRated
      );
    }, delay);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    fetchWithFilters,
    selectedGenres,
    selectedCountries,
    titleType,
    yearFrom,
    yearTo,
    includeRated,
  ]);

  const filterInput =
    "rounded-lg border border-[var(--section-border)] bg-[var(--card-bg)] px-3 py-2.5 text-[14px] text-[var(--foreground)] placeholder:text-[var(--muted-subtle)] transition-colors focus:border-[var(--muted-soft)] focus:outline-none focus:ring-1 focus:ring-[var(--muted-subtle)]/30 [color-scheme:inherit]";

  return (
    <section className="rounded-xl border border-[var(--section-border)] bg-[var(--section-bg)] px-6 py-7 sm:px-8 sm:py-8">
      <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--foreground)] sm:text-[19px]">
        From your watchlist
        <SectionHelp title="How this works">
          <p>Titles you saved, filtered by genre/country/year. Uses your <strong>8+ taste signals</strong>—genres and countries you tend to rate highly.</p>
          <p>Unrated items only by default. &quot;Include rated&quot; shows what you&apos;ve already seen for comparison.</p>
        </SectionHelp>
      </h2>
      <p className="mt-1.5 text-[14px] leading-[1.5] text-[var(--muted-soft)]">
        Titles you saved, filtered by your taste
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3 sm:mt-7 sm:gap-4">
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
          className={`${filterInput} min-w-[7rem]`}
          aria-label="Title type"
        >
          <option value="">All types</option>
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
        <label className="flex cursor-pointer items-center gap-2 text-[14px] text-[var(--muted-soft)] transition-colors hover:text-[var(--foreground)]">
          <input
            type="checkbox"
            checked={includeRated}
            onChange={(e) => setIncludeRated(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--section-border)] accent-[var(--foreground)]"
            aria-label="Include rated"
          />
          <span>Include rated</span>
        </label>
      </div>

      {loading ? (
        <div className="mt-7 flex items-center gap-2.5 text-[14px] text-[var(--muted-soft)]">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--muted-subtle)]" />
          Loading…
        </div>
      ) : items.length > 0 ? (
        <ul className="mt-6 grid gap-4 sm:mt-7 sm:gap-5">
          {items.map((r) => (
            <li key={r.imdb_title_id}>
              <RecommendationCard
                imdb_title_id={r.imdb_title_id}
                title={r.title}
                year={r.year}
                title_type={r.title_type}
                your_rating={r.your_rating}
                poster={r.poster}
                reasons={r.reasons}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 rounded-lg border border-dashed border-[var(--section-border)] py-8 text-center text-[14px] text-[var(--muted-soft)] sm:mt-6">
          No poster-backed results for these filters yet.
        </p>
      )}
    </section>
  );
}
