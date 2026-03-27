"use client";

import { useEffect, useState } from "react";
import { API_URL } from "../lib/api";
import { ExpandableRecoListFooter } from "./ExpandableRecoListFooter";
import {
  getInitialPoolFilters,
  poolFiltersToQueryString,
  RecommendationPoolFiltersBar,
  type RecommendationPoolFilterValues,
} from "./RecommendationPoolFiltersBar";
import {
  RECO_EMPTY_MESSAGE,
  RECO_EMPTY_PANEL,
  RECO_LOADING_DOT,
  RECO_LOADING_ROW,
  RECO_RESULTS_LIST,
  RECO_VISIBLE_INITIAL,
} from "./recommendationModeStyles";

type MLItem = {
  imdb_title_id: string;
  title: string | null;
  year: number | null;
  title_type: string | null;
  poster: string | null;
  prob_8plus: number;
  top_features?: string[];
};

type MLResponse = {
  items: MLItem[];
  model_available: boolean;
};

function formatFeature(name: string): string {
  const m = name.match(/^(genre|country|decade|title_type):(.+)$/);
  return m ? m[2] : name;
}

function MLRecommendationCard({ item }: { item: MLItem }) {
  const [imageFailed, setImageFailed] = useState(false);
  const displayTitle = item.title ?? item.imdb_title_id;
  const hasUsablePoster = item.poster && item.poster.trim() && item.poster !== "N/A";
  const showPoster = hasUsablePoster && !imageFailed;
  const metaParts: string[] = [];
  if (item.year != null) metaParts.push(String(item.year));
  if (item.title_type?.trim()) metaParts.push(item.title_type.trim());
  const meta = metaParts.length ? metaParts.join(" · ") : null;
  const pct = (item.prob_8plus * 100).toFixed(0);

  return (
    <a
      href={`https://www.imdb.com/title/${item.imdb_title_id}/`}
      target="_blank"
      rel="noopener noreferrer"
      className="group block overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--control-surface)] transition-[border-color,box-shadow] duration-200 hover:border-[var(--muted-soft)] hover:shadow-md"
    >
      <div className="flex gap-4 px-4 py-4 sm:gap-5 sm:px-5 sm:py-5">
        {showPoster && (
          <div className="h-[5.5rem] w-[3.75rem] shrink-0 overflow-hidden rounded-md bg-[var(--control-track-bg)] ring-1 ring-[var(--card-border)] sm:h-[6.75rem] sm:w-[4.5rem]">
            <img
              src={item.poster!}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setImageFailed(true)}
            />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
          <div className="min-w-0 flex-1">
            <h3 className="break-words text-[17px] font-semibold leading-snug tracking-[-0.015em] text-[var(--foreground)] sm:text-[18px]">
              {displayTitle}
            </h3>
            {meta && (
              <p className="mt-1.5 text-[13px] leading-snug text-[var(--muted)]">{meta}</p>
            )}
            {item.top_features && item.top_features.length > 0 && (
              <p className="mt-2 text-[12px] leading-relaxed text-[var(--muted-soft)]">
                {item.top_features.slice(0, 4).map(formatFeature).join(" · ")}
              </p>
            )}
          </div>
          <span className="w-fit shrink-0 self-start rounded-md bg-[var(--accent-muted)] px-3 py-1.5 text-[15px] font-semibold tabular-nums tracking-tight text-[var(--accent)] ring-1 ring-[var(--accent)]/15 sm:py-2">
            {pct}%
          </span>
        </div>
      </div>
    </a>
  );
}

export function MLRecommendations() {
  const [data, setData] = useState<MLResponse | null>(null);
  const [poolFilters, setPoolFilters] = useState<RecommendationPoolFilterValues>(
    getInitialPoolFilters
  );
  const [listExpanded, setListExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setListExpanded(false);
  }, [data?.items]);

  useEffect(() => {
    const q = poolFiltersToQueryString(poolFilters);
    fetch(`${API_URL}/recommendations/watchlist-ml?limit=15${q}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [poolFilters]);

  const filtersActive =
    poolFilters.decade ||
    poolFilters.country.trim() ||
    poolFilters.similarTo.trim();

  const filtersBar = (
    <RecommendationPoolFiltersBar
      idPrefix="ml-wl"
      value={poolFilters}
      onChange={setPoolFilters}
      countryEntry="watchlist-picker"
    />
  );

  if (loading) {
    return (
      <div>
        {filtersBar}
        <div className={RECO_LOADING_ROW}>
          <span className={RECO_LOADING_DOT} />
          Loading…
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        {filtersBar}
        <p className={RECO_EMPTY_MESSAGE}>
          Unable to load ML recommendations. Check that the backend is running.
        </p>
      </div>
    );
  }

  if (!data.model_available) {
    return (
      <div>
        {filtersBar}
        <div className={`${RECO_EMPTY_PANEL} px-5 text-left`}>
          <p className="text-[14px] font-medium text-[var(--foreground)]">
            Model not trained yet
          </p>
          <p className="mt-2 text-[14px] leading-[1.5] text-[var(--muted)]">
            Train the 8+ (strong-favorite) likelihood model locally, then restart the backend:
          </p>
          <code className="mt-3 block rounded-md border border-[var(--card-border)] bg-[var(--control-surface)] px-3 py-2 text-left text-[12px] text-[var(--muted-soft)]">
            cd backend && python -m app.ml.train_8plus_baseline
          </code>
        </div>
      </div>
    );
  }

  if (!data.items.length) {
    return (
      <div>
        {filtersBar}
        <p className={RECO_EMPTY_MESSAGE}>
          {filtersActive
            ? "No unrated watchlist items match these filters with strong model scores. Try loosening decade, country, or similar-to."
            : "No unrated watchlist items to score. Add titles to your watchlist and rate more titles to build the model."}
        </p>
      </div>
    );
  }

  const items = data.items;
  return (
    <>
      {filtersBar}
      <ul className={RECO_RESULTS_LIST}>
        {(listExpanded
          ? items
          : items.slice(0, RECO_VISIBLE_INITIAL.ml)
        ).map((item) => (
          <li key={item.imdb_title_id}>
            <MLRecommendationCard item={item} />
          </li>
        ))}
      </ul>
      <ExpandableRecoListFooter
        expanded={listExpanded}
        onToggle={() => setListExpanded((e) => !e)}
        initialVisible={RECO_VISIBLE_INITIAL.ml}
        total={items.length}
      />
    </>
  );
}
