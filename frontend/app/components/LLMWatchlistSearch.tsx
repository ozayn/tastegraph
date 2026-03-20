"use client";

import { useCallback, useState } from "react";
import { API_URL } from "../lib/api";
import { HighFitCard } from "./HighFitCard";
import { SectionHelp } from "./SectionHelp";

type SearchItem = {
  imdb_title_id: string;
  title: string | null;
  title_type: string | null;
  year: number | null;
  poster: string | null;
  explanation: { top_reasons?: string[] };
};

type SearchResult = {
  items: SearchItem[];
  intent_summary: string;
  fallback?: boolean;
};

const inputClass =
  "w-full rounded-lg border border-[var(--section-border)] bg-[var(--card-bg)] px-4 py-3 text-[14px] text-[var(--foreground)] placeholder:text-[var(--muted-subtle)] transition-colors focus:border-[var(--muted-soft)] focus:outline-none focus:ring-1 focus:ring-[var(--muted-subtle)]/30 [color-scheme:inherit]";

export function LLMWatchlistSearch() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doSearch = useCallback(() => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    fetch(`${API_URL}/recommendations/watchlist-search?limit=15`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: query.trim() }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Search failed"))))
      .then((data: SearchResult) => setResult(data))
      .catch(() => setError("Search failed. Check that GROQ_API_KEY is set and the backend is running."))
      .finally(() => setLoading(false));
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") doSearch();
  };

  return (
    <div className="space-y-4">
      <p className="text-[14px] leading-[1.5] text-[var(--muted-soft)]">
        Natural-language search over your watchlist. The LLM interprets your query into filters; results are always from your real watchlist.
        <SectionHelp title="How this works">
          <p><strong>Grounded search</strong>: Results come only from your watchlist. The LLM helps interpret your query into genres, countries, decades, and &quot;similar to&quot; signals.</p>
          <p>Examples: &quot;slow psychological thrillers from Europe&quot;, &quot;movies similar to The Lobster&quot;, &quot;high-fit political dramas&quot;.</p>
          <p>Requires <code>GROQ_API_KEY</code> in backend .env.</p>
        </SectionHelp>
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. slow psychological thrillers from Europe"
          className={inputClass}
          aria-label="Search your watchlist"
          disabled={loading}
        />
        <button
          type="button"
          onClick={doSearch}
          disabled={loading || !query.trim()}
          className="shrink-0 rounded-lg bg-[var(--accent)] px-4 py-3 text-[14px] font-medium text-white transition-colors hover:bg-[var(--accent)]/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </div>
      {error && (
        <p className="text-[13px] text-[var(--mondrian-red)]">{error}</p>
      )}
      {result && (
        <div className="space-y-3">
          {result.intent_summary && (
            <p className="text-[13px] text-[var(--muted-soft)]">
              Interpreted as: {result.intent_summary}
              {result.fallback && " (LLM unavailable; showing watchlist by taste fit)"}
            </p>
          )}
          {result.items.length > 0 ? (
            <ul className="space-y-3">
              {result.items.map((item) => (
                <li key={item.imdb_title_id}>
                  <HighFitCard
                    imdb_title_id={item.imdb_title_id}
                    title={item.title}
                    title_type={item.title_type}
                    year={item.year}
                    poster={item.poster}
                    explanation={item.explanation}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-[var(--section-border)] py-8 text-center text-[14px] text-[var(--muted-soft)]">
              No watchlist items match. Try a broader query or different filters.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
