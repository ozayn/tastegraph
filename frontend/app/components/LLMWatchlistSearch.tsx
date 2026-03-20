"use client";

import { useCallback, useState } from "react";

const IS_DEV = process.env.NODE_ENV !== "production";
import { API_URL } from "../lib/api";
import { HighFitCard } from "./HighFitCard";
import { SectionHelp } from "./SectionHelp";

type SearchItem = {
  imdb_title_id: string;
  title: string | null;
  title_type: string | null;
  year: number | null;
  poster: string | null;
  explanation: Record<string, unknown>;
  user_rating?: number | null;
  date_rated?: string | null;
};

/** Normalize API explanation to HighFitExplanation shape with safe defaults. */
function normalizeExplanation(exp: Record<string, unknown>): {
  in_favorite_list?: boolean;
  matched_genres: string[];
  matched_countries: string[];
  matched_decade: string | null;
  matched_people: { name: string; role: string }[];
  matched_strong_directors?: string[];
  top_reasons: string[];
} {
  const arr = (x: unknown): string[] =>
    Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : [];
  const people = (x: unknown): { name: string; role: string }[] =>
    Array.isArray(x)
      ? x.filter(
          (v): v is { name: string; role: string } =>
            typeof v === "object" && v !== null && "name" in v && "role" in v
        )
      : [];
  return {
    in_favorite_list: Boolean(exp.in_favorite_list),
    matched_genres: arr(exp.matched_genres),
    matched_countries: arr(exp.matched_countries),
    matched_decade: typeof exp.matched_decade === "string" ? exp.matched_decade : null,
    matched_people: people(exp.matched_people),
    matched_strong_directors: arr(exp.matched_strong_directors),
    top_reasons: arr(exp.top_reasons),
  };
}

type SearchResult = {
  items: SearchItem[];
  intent_summary: string;
  fallback?: boolean;
  debug?: {
    system_prompt?: string;
    user_content?: string;
    schema_block?: string;
    intent?: Record<string, unknown> | null;
    fallback?: boolean;
    parse_error?: boolean;
  };
};

const inputClass =
  "w-full rounded-lg border border-[var(--section-border)] bg-[var(--card-bg)] px-4 py-3 text-[14px] text-[var(--foreground)] placeholder:text-[var(--muted-subtle)] transition-colors focus:border-[var(--muted-soft)] focus:outline-none focus:ring-1 focus:ring-[var(--muted-subtle)]/30 [color-scheme:inherit]";

type SearchScope = "watchlist" | "watched";

export function LLMWatchlistSearch() {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("watchlist");
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
      body: JSON.stringify({ q: query.trim(), scope }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Search failed"))))
      .then((data: SearchResult) => setResult(data))
      .catch(() => setError("Search failed. Check that GROQ_API_KEY is set and the backend is running."))
      .finally(() => setLoading(false));
  }, [query, scope]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") doSearch();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] leading-[1.5] text-[var(--muted-soft)]">
          Natural-language search. The LLM interprets your query into filters; results are always from your real data.
          <SectionHelp title="How this works">
            <p><strong>Grounded search</strong>: Results come only from your actual data—watchlist or watched history. The LLM interprets into genres, countries, decades, ratings, and more.</p>
            <p>Watchlist: &quot;slow thrillers from Europe&quot;, &quot;series similar to X&quot;. Watched: &quot;documentaries I rated 8+&quot;, &quot;movies from Japan in the 2000s&quot;.</p>
            <p>Requires <code>GROQ_API_KEY</code> in backend .env.</p>
          </SectionHelp>
        </p>
        <div
          className="flex rounded-lg border border-[var(--section-border)] bg-[var(--section-bg)] p-0.5"
          role="group"
          aria-label="Search scope"
        >
          <button
            type="button"
            onClick={() => setScope("watchlist")}
            className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
              scope === "watchlist"
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--muted-soft)] hover:text-[var(--foreground)]"
            }`}
          >
            Watchlist
          </button>
          <button
            type="button"
            onClick={() => setScope("watched")}
            className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
              scope === "watched"
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--muted-soft)] hover:text-[var(--foreground)]"
            }`}
          >
            Watched
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            scope === "watched"
              ? "e.g. documentaries I rated 8+"
              : "e.g. slow psychological thrillers from Europe"
          }
          className={inputClass}
          aria-label={scope === "watched" ? "Search your watched history" : "Search your watchlist"}
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
              {result.fallback &&
            ` (LLM unavailable; showing ${scope === "watched" ? "watched" : "watchlist"} by taste fit)`}
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
                    explanation={normalizeExplanation(item.explanation ?? {})}
                    user_rating={item.user_rating}
                    date_rated={item.date_rated}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-[var(--section-border)] py-8 text-center text-[14px] text-[var(--muted-soft)]">
              No {scope === "watched" ? "watched" : "watchlist"} items match. Try a broader query or different filters.
            </p>
          )}
          {IS_DEV && result.debug && (
            <PromptInspector debug={result.debug} />
          )}
        </div>
      )}
    </div>
  );
}

function PromptInspector({ debug }: { debug: NonNullable<SearchResult["debug"]> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 rounded-lg border border-dashed border-[var(--section-border)] bg-[var(--section-bg)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 text-left text-[13px] font-medium text-[var(--muted-soft)] hover:text-[var(--foreground)] flex items-center justify-between"
        aria-expanded={open}
      >
        <span>Prompt inspector (dev only)</span>
        <span className="text-[10px] uppercase tracking-wide">{open ? "▼" : "▶"}</span>
      </button>
      {open && (
        <div className="border-t border-[var(--section-border)] p-4 space-y-4 text-[12px]">
          {debug.parse_error && (
            <p className="text-[var(--mondrian-red)] font-medium">Parse error (LLM output invalid)</p>
          )}
          {debug.fallback !== undefined && (
            <p className="text-[var(--muted-soft)]">
              Fallback: {String(debug.fallback)} (heuristic search when LLM unavailable or empty intent)
            </p>
          )}
          {debug.intent != null && (
            <div>
              <p className="font-medium text-[var(--foreground)] mb-1">Interpreted intent</p>
              <pre className="whitespace-pre-wrap break-words overflow-x-auto max-h-32 overflow-y-auto rounded bg-[var(--card-bg)] border border-[var(--section-border)] p-3 font-mono text-[11px]">
                {JSON.stringify(debug.intent, null, 2)}
              </pre>
            </div>
          )}
          {debug.system_prompt && (
            <div>
              <p className="font-medium text-[var(--foreground)] mb-1">System prompt</p>
              <pre className="whitespace-pre-wrap break-words overflow-x-auto max-h-40 overflow-y-auto rounded bg-[var(--card-bg)] border border-[var(--section-border)] p-3 font-mono text-[11px]">
                {debug.system_prompt}
              </pre>
            </div>
          )}
          {debug.user_content && (
            <div>
              <p className="font-medium text-[var(--foreground)] mb-1">User message (query + schema)</p>
              <pre className="whitespace-pre-wrap break-words overflow-x-auto max-h-48 overflow-y-auto rounded bg-[var(--card-bg)] border border-[var(--section-border)] p-3 font-mono text-[11px]">
                {debug.user_content}
              </pre>
            </div>
          )}
          {debug.schema_block && (
            <div>
              <p className="font-medium text-[var(--foreground)] mb-1">Schema block (embedded in user message)</p>
              <pre className="whitespace-pre-wrap break-words overflow-x-auto max-h-32 overflow-y-auto rounded bg-[var(--card-bg)] border border-[var(--section-border)] p-3 font-mono text-[11px]">
                {debug.schema_block}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
