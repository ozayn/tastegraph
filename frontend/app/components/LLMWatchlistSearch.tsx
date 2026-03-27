"use client";

import { useCallback, useEffect, useState } from "react";

const IS_DEV = process.env.NODE_ENV !== "production";
import { API_URL } from "../lib/api";
import { ExpandableRecoListFooter } from "./ExpandableRecoListFooter";
import { HighFitCard } from "./HighFitCard";
import { SectionHelp } from "./SectionHelp";
import {
  RECO_CONTROLS_WELL,
  RECO_EMPTY_PANEL_FLAT,
  RECO_MODE_INTRO_TEXT,
  RECO_RESULTS_GRID,
  RECO_VISIBLE_INITIAL,
} from "./recommendationModeStyles";

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
  plot_matched?: string[];
  similar_to_matched?: string[];
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
    plot_matched: arr(exp.plot_matched),
    similar_to_matched: arr(exp.similar_to_matched),
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
    similar_to_resolved?: string | null;
    similar_to_signals_used?: {
      genres: string[];
      countries: string[];
      has_directors: boolean;
      has_writers: boolean;
      has_actors: boolean;
      plot_words_count: number;
      resolved_title_type?: string;
      resolved_plot_snippet?: string;
    };
    ui_pool_decade?: string | null;
  };
};

const inputClass =
  "w-full rounded-lg border border-[var(--card-border)] bg-[var(--control-surface)] px-4 py-3 text-[14px] text-[var(--foreground)] placeholder:text-[var(--muted-soft)] transition-colors focus:border-[var(--accent)]/45 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 [color-scheme:inherit]";

const decadeSelectClass =
  "shrink-0 rounded-lg border border-[var(--card-border)] bg-[var(--control-surface)] px-3 py-3 text-[13px] text-[var(--foreground)] transition-colors focus:border-[var(--accent)]/45 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 [color-scheme:inherit]";

type SearchScope = "watchlist" | "watched";

export function LLMWatchlistSearch() {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("watchlist");
  const [decade, setDecade] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [listExpanded, setListExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setListExpanded(false);
  }, [result]);

  const doSearch = useCallback(() => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    const decadeQ =
      decade.trim() !== ""
        ? `&decade=${encodeURIComponent(decade.trim())}`
        : "";
    fetch(`${API_URL}/recommendations/watchlist-search?limit=12${decadeQ}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: query.trim(), scope }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Search failed"))))
      .then((data: SearchResult) => setResult(data))
      .catch(() => setError("Search failed. Check that GROQ_API_KEY is set and the backend is running."))
      .finally(() => setLoading(false));
  }, [query, scope, decade]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") doSearch();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className={`min-w-0 flex-1 ${RECO_MODE_INTRO_TEXT}`}>
          Natural-language search. The LLM interprets your query; results stay grounded in your data. Optionally limit the pool to a single decade before ranking.
          <SectionHelp title="How this works">
            <p><strong>Grounded search</strong>: Results come only from your watchlist or watched history. The LLM maps your text to genres, countries, similar-to, ratings, etc.</p>
            <p>Use <strong>Decade</strong> to constrain release years (e.g. 2020s only) regardless of what the query says about time.</p>
            <p>Watchlist: &quot;slow thrillers from Europe&quot;, &quot;series similar to X&quot;. Watched: &quot;documentaries I rated 8+&quot;.</p>
            <p>Requires <code>GROQ_API_KEY</code> in backend .env.</p>
          </SectionHelp>
        </p>
        <div
          className="flex rounded-lg border border-[var(--card-border)] bg-[var(--control-track-bg)] p-0.5"
          role="group"
          aria-label="Search scope"
        >
          <button
            type="button"
            onClick={() => setScope("watchlist")}
            className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
              scope === "watchlist"
                ? "bg-[var(--accent)] text-white shadow-sm"
                : "text-[var(--muted)] hover:bg-[var(--card-hover)] hover:text-[var(--foreground)]"
            }`}
          >
            Watchlist
          </button>
          <button
            type="button"
            onClick={() => setScope("watched")}
            className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
              scope === "watched"
                ? "bg-[var(--accent)] text-white shadow-sm"
                : "text-[var(--muted)] hover:bg-[var(--card-hover)] hover:text-[var(--foreground)]"
            }`}
          >
            Watched
          </button>
        </div>
      </div>
      <div
        className={`${RECO_CONTROLS_WELL} flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3`}
      >
        <label className="sr-only" htmlFor="llm-search-decade">
          Release decade (optional pool filter)
        </label>
        <select
          id="llm-search-decade"
          value={decade}
          onChange={(e) => setDecade(e.target.value)}
          className={decadeSelectClass}
          aria-label="Filter by decade"
          disabled={loading}
        >
          <option value="">Any decade</option>
          <option value="1980s">1980s</option>
          <option value="1990s">1990s</option>
          <option value="2000s">2000s</option>
          <option value="2010s">2010s</option>
          <option value="2020s">2020s</option>
        </select>
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
          className="shrink-0 rounded-lg bg-[var(--accent)] px-4 py-3 text-[14px] font-medium text-white shadow-sm transition-colors hover:bg-[var(--accent)]/92 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:cursor-not-allowed disabled:opacity-[0.58]"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </div>
      {error && (
        <p className="text-[13px] text-[var(--mondrian-red)]">{error}</p>
      )}
      {result && (
        <div className="space-y-5">
          {result.intent_summary && (
            <p className="text-[14px] leading-[1.5] text-[var(--muted)]">
              Interpreted as: {result.intent_summary}
              {result.fallback &&
            ` (LLM unavailable; showing ${scope === "watched" ? "watched" : "watchlist"} by taste fit)`}
            </p>
          )}
          {result.items.length > 0 ? (
            <>
              <ul className={RECO_RESULTS_GRID}>
                {(listExpanded
                  ? result.items
                  : result.items.slice(0, RECO_VISIBLE_INITIAL.search)
                ).map((item) => (
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
              <ExpandableRecoListFooter
                expanded={listExpanded}
                onToggle={() => setListExpanded((e) => !e)}
                initialVisible={RECO_VISIBLE_INITIAL.search}
                total={result.items.length}
              />
            </>
          ) : (
            <p className={RECO_EMPTY_PANEL_FLAT}>
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
          {debug.ui_pool_decade != null && debug.ui_pool_decade !== "" && (
            <p className="text-[var(--muted-soft)]">
              UI decade pool: <span className="text-[var(--foreground)]">{debug.ui_pool_decade}</span>
            </p>
          )}
          {debug.similar_to_resolved !== undefined && (
            <div>
              <p className="font-medium text-[var(--foreground)] mb-1">similar_to resolution</p>
              <p className="text-[var(--muted-soft)]">
                {debug.similar_to_resolved
                  ? `Resolved to: ${debug.similar_to_resolved}`
                  : "Not found in ratings/watchlist — similarity ranking unavailable"}
              </p>
              {debug.similar_to_signals_used && (
                <pre className="mt-1 whitespace-pre-wrap break-words overflow-x-auto rounded bg-[var(--card-bg)] border border-[var(--section-border)] p-2 font-mono text-[11px]">
                  {JSON.stringify(debug.similar_to_signals_used, null, 2)}
                </pre>
              )}
            </div>
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
