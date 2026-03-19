"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL } from "../lib/api";
import { CountryMultiSelect } from "./CountryMultiSelect";
import { GenreMultiSelect } from "./GenreMultiSelect";
import { RecommendationCard } from "./RecommendationCard";
import { SectionHelp } from "./SectionHelp";

const DEBOUNCE_MS = 350;
const DISPLAY_LIMIT = 5;
const FETCH_LIMIT = 50; // Backend max; ratings have lower poster coverage than watchlist

function hasUsablePoster(poster: string | null | undefined): boolean {
  return !!(poster && poster.trim() && poster !== "N/A");
}

type Item = {
  imdb_title_id: string;
  title: string | null;
  year: number | null;
  genres: string | null;
  user_rating: number | null;
  poster?: string | null;
  reasons?: string[];
};

export function SimpleRecommendations({ embedded = false }: { embedded?: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [titleType, setTitleType] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRun = useRef(true);
  const requestIdRef = useRef(0);

  const fetchWithFilters = useCallback(
    (genres: string[], countries: string[], tt: string, yf: string, yt: string) => {
      const id = ++requestIdRef.current;
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
      recParams.set("limit", String(FETCH_LIMIT));

      Promise.all([
        fetch(`${API_URL}/recommendations/simple?${recParams}`).then((res) =>
          res.ok ? res.json() : Promise.reject()
        ),
        fetch(`${API_URL}/recommendations/simple-explanation?${baseParams}`).then(
          (res) => (res.ok ? res.json() : Promise.reject())
        ),
      ])
        .then(([recs, expl]) => {
          if (id !== requestIdRef.current) return;
          const withPoster = (recs as Item[]).filter((r) => hasUsablePoster(r.poster));
          setItems(withPoster.slice(0, DISPLAY_LIMIT));
          setExplanation(expl.explanation ?? null);
        })
        .catch(() => {
          if (id !== requestIdRef.current) return;
          setItems([]);
          setExplanation(null);
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
      fetchWithFilters(selectedGenres, selectedCountries, titleType, yearFrom, yearTo);
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
  ]);

  const filterInput =
    "rounded-lg border border-[var(--section-border)] bg-[var(--card-bg)] px-3 py-2.5 text-[14px] text-[var(--foreground)] placeholder:text-[var(--muted-subtle)] transition-colors focus:border-[var(--muted-soft)] focus:outline-none focus:ring-1 focus:ring-[var(--muted-subtle)]/30 [color-scheme:inherit]";

  const helpContent = (
    <>
      <p>Browse and filter titles you&apos;ve already rated 8+ by genre, country, and year. Exploration of your favorites—not recommendations for unseen titles.</p>
    </>
  );

  const header = embedded ? (
    <p className="mb-4 text-[14px] leading-[1.5] text-[var(--muted-soft)]">
      Browse titles you&apos;ve already rated 8+
      <SectionHelp title="How this works">{helpContent}</SectionHelp>
    </p>
  ) : (
    <>
      <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--foreground)] sm:text-[19px]">
        Explore your favorites
        <SectionHelp title="How this works">{helpContent}</SectionHelp>
      </h2>
      <p className="mt-1.5 text-[14px] leading-[1.5] text-[var(--muted-soft)]">
        Browse titles you&apos;ve already rated 8+
      </p>
    </>
  );

  const content = (
    <>
      {header}
      <div className={embedded ? "flex flex-wrap items-center gap-3 sm:gap-4" : "mt-6 flex flex-wrap items-center gap-3 sm:mt-7 sm:gap-4"}>
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
      </div>

      {loading ? (
        <div className={embedded ? "mt-5 flex items-center gap-2.5 text-[14px] text-[var(--muted-soft)]" : "mt-7 flex items-center gap-2.5 text-[14px] text-[var(--muted-soft)]"}>
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--muted-subtle)]" />
          Loading recommendations…
        </div>
      ) : (
        <>
          {explanation && (
            <p className={embedded ? "mt-5 text-[14px] leading-[1.6] text-[var(--muted-soft)]" : "mt-5 text-[14px] leading-[1.6] text-[var(--muted-soft)] sm:mt-6"}>
              {explanation}
            </p>
          )}
          {items.length > 0 ? (
            <ul className={embedded ? "mt-5 grid gap-4 sm:gap-5" : (explanation ? "mt-5 grid gap-4 sm:mt-6 sm:gap-5" : "mt-6 grid gap-4 sm:mt-7 sm:gap-5")}>
              {items.map((r) => (
                <li key={r.imdb_title_id}>
                  <RecommendationCard
                    imdb_title_id={r.imdb_title_id}
                    title={r.title}
                    year={r.year}
                    genres={r.genres}
                    user_rating={r.user_rating}
                    poster={r.poster}
                    reasons={r.reasons}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p
              className={
                embedded
                  ? "mt-5 rounded-lg border border-dashed border-[var(--section-border)] py-8 text-center text-[14px] text-[var(--muted-soft)]"
                  : (explanation
                    ? "mt-4 rounded-lg border border-dashed border-[var(--section-border)] py-8 text-center text-[14px] text-[var(--muted-soft)] sm:mt-5"
                    : "mt-5 rounded-lg border border-dashed border-[var(--section-border)] py-8 text-center text-[14px] text-[var(--muted-soft)] sm:mt-6")
              }
            >
              No poster-backed results for these filters yet.
            </p>
          )}
        </>
      )}
    </>
  );

  return embedded ? (
    <div>{content}</div>
  ) : (
    <section className="rounded-xl border border-[var(--section-border)] bg-[var(--section-bg)] px-6 py-7 sm:px-8 sm:py-8">
      {content}
    </section>
  );
}
