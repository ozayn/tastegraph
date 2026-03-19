"use client";

import { useEffect, useState } from "react";
import { API_URL } from "../lib/api";

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

  return (
    <a
      href={`https://www.imdb.com/title/${item.imdb_title_id}/`}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] overflow-hidden transition-all duration-150 hover:border-[var(--muted-subtle)] hover:bg-[var(--card-hover)] hover:shadow-sm"
    >
      <div className="flex gap-4 px-5 py-4 sm:px-6 sm:py-5">
        {showPoster && (
          <div className="shrink-0 w-14 h-20 sm:w-16 sm:h-24 rounded-lg overflow-hidden bg-[var(--section-bg)] border border-[var(--section-border)]">
            <img
              src={item.poster!}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setImageFailed(true)}
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] font-semibold leading-[1.35] text-[var(--foreground)] sm:text-[17px]">
            {displayTitle}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {item.year != null && (
              <span className="rounded-md bg-[var(--muted-subtle)]/20 px-2 py-0.5 text-[12px] font-medium text-[var(--muted-soft)]">
                {item.year}
              </span>
            )}
            {item.title_type && (
              <span className="rounded-md bg-[var(--muted-subtle)]/20 px-2 py-0.5 text-[12px] text-[var(--muted-soft)]">
                {item.title_type}
              </span>
            )}
            <span className="rounded-md bg-[var(--accent-muted)]/40 px-2 py-0.5 text-[12px] font-medium text-[var(--accent)]">
              {(item.prob_8plus * 100).toFixed(0)}% 8+
            </span>
          </div>
          {item.top_features && item.top_features.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {item.top_features.map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium bg-[var(--muted-subtle)]/20 text-[var(--muted-soft)]"
                >
                  {formatFeature(f)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </a>
  );
}

export function MLRecommendations() {
  const [data, setData] = useState<MLResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/recommendations/watchlist-ml?limit=15`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[14px] text-[var(--muted-soft)]">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--muted-subtle)]" />
        Loading…
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-[14px] text-[var(--muted-soft)]">
        Unable to load ML recommendations. Check that the backend is running.
      </p>
    );
  }

  if (!data.model_available) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--section-border)] bg-[var(--section-bg)] px-5 py-8 text-center">
        <p className="text-[14px] font-medium text-[var(--foreground)]">
          Model not trained yet
        </p>
        <p className="mt-2 text-[13px] leading-[1.5] text-[var(--muted-soft)]">
          Train the 8+ (strong-favorite) likelihood model locally, then restart the backend:
        </p>
        <code className="mt-3 block rounded-md bg-[var(--card-bg)] px-3 py-2 text-[12px] text-[var(--muted-soft)]">
          cd backend && python -m app.ml.train_8plus_baseline
        </code>
      </div>
    );
  }

  if (!data.items.length) {
    return (
      <p className="text-[14px] text-[var(--muted-soft)]">
        No unrated watchlist items to score. Add titles to your watchlist and rate more titles to build the model.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {data.items.map((item) => (
        <li key={item.imdb_title_id}>
          <MLRecommendationCard item={item} />
        </li>
      ))}
    </ul>
  );
}
