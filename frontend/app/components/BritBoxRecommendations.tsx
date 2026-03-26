"use client";

import { useEffect, useState } from "react";
import { API_URL } from "../lib/api";
import { HighFitCard } from "./HighFitCard";

type ScoringMode = "high-fit" | "ml";
type TypeFilter = "show" | "movie" | null;

type CatalogStats = {
  total_in_catalog: number;
  with_imdb_id: number;
  matched_metadata: number;
  unmatched?: number;
  already_rated?: number;
};

type HighFitExplanation = {
  in_favorite_list?: boolean;
  matched_genres: string[];
  matched_countries: string[];
  matched_decade: string | null;
  matched_people: { name: string; role: string }[];
  matched_strong_directors?: string[];
  top_reasons: string[];
};

type HighFitItem = {
  imdb_title_id: string;
  title: string | null;
  year: number | null;
  title_type: string | null;
  poster: string | null;
  explanation: HighFitExplanation;
};

type MLItem = {
  imdb_title_id: string;
  title: string | null;
  year: number | null;
  title_type: string | null;
  poster: string | null;
  prob_8plus: number;
  top_features?: string[];
};

type HighFitResponse = {
  provider_name: string;
  fetched_at: string;
  catalog_stats: CatalogStats;
  items: HighFitItem[];
  error?: string;
  message?: string;
};

type MLResponse = {
  provider_name: string;
  fetched_at?: string;
  catalog_stats: CatalogStats;
  items: MLItem[];
  model_available: boolean;
  error?: string;
  message?: string;
};

function formatFeature(name: string): string {
  const m = name.match(/^(genre|country|decade|title_type):(.+)$/);
  return m ? m[2] : name;
}

function StatsBanner({
  stats,
  fetchedAt,
  typeLabel,
}: {
  stats: CatalogStats;
  fetchedAt?: string;
  typeLabel: string;
}) {
  const date = fetchedAt ? new Date(fetchedAt).toLocaleDateString() : null;
  return (
    <div className="mb-4 rounded-lg border border-dashed border-[var(--section-border)] bg-[var(--section-bg)] px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--muted-soft)]">
        <span>
          <strong className="text-[var(--foreground)]">
            {stats.matched_metadata}
          </strong>{" "}
          {typeLabel} scored from BritBox catalog (approx.)
        </span>
        <span className="opacity-70">
          {stats.total_in_catalog} total in catalog
        </span>
        {stats.already_rated != null && stats.already_rated > 0 && (
          <span className="opacity-70">{stats.already_rated} already rated</span>
        )}
        {date && (
          <span className="ml-auto opacity-50">JustWatch snapshot {date}</span>
        )}
      </div>
    </div>
  );
}

function BritBoxMLCard({ item }: { item: MLItem }) {
  const [imageFailed, setImageFailed] = useState(false);
  const displayTitle = item.title ?? item.imdb_title_id;
  const hasUsablePoster =
    item.poster && item.poster.trim() && item.poster !== "N/A";
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
            <span className="rounded-md bg-[var(--mondrian-red)]/15 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[var(--mondrian-red)]">
              BritBox
            </span>
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

const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
  { id: "show", label: "Series" },
  { id: "movie", label: "Movies" },
  { id: null, label: "All" },
];

const activeBtn =
  "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm border border-[var(--section-border)]";
const inactiveBtn =
  "text-[var(--muted-soft)] hover:text-[var(--foreground)]";

export function BritBoxRecommendations() {
  const [scoring, setScoring] = useState<ScoringMode>("high-fit");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("show");
  const [highFitData, setHighFitData] = useState<HighFitResponse | null>(null);
  const [mlData, setMlData] = useState<MLResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const typeParam = typeFilter ? `&title_type=${typeFilter}` : "";
    if (scoring === "ml") {
      fetch(`${API_URL}/recommendations/britbox-ml?limit=15${typeParam}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(setMlData)
        .catch(() => setMlData(null))
        .finally(() => setLoading(false));
    } else {
      fetch(`${API_URL}/recommendations/britbox?limit=15${typeParam}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(setHighFitData)
        .catch(() => setHighFitData(null))
        .finally(() => setLoading(false));
    }
  }, [scoring, typeFilter]);

  const activeData = scoring === "ml" ? mlData : highFitData;
  const typeLabel =
    typeFilter === "show" ? "series" : typeFilter === "movie" ? "films" : "titles";

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[14px] text-[var(--muted-soft)]">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--muted-subtle)]" />
        Loading BritBox recommendations…
      </div>
    );
  }

  if (activeData && "error" in activeData && activeData.error) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--section-border)] bg-[var(--section-bg)] px-5 py-8 text-center">
        <p className="text-[14px] font-medium text-[var(--foreground)]">
          BritBox catalog snapshot is not available
        </p>
        <p className="mt-2 text-[13px] leading-[1.5] text-[var(--muted-soft)]">
          {activeData.message || "The BritBox catalog data could not be loaded in this environment."}
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Controls row: type filter + scoring mode */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1">
          {TYPE_FILTERS.map(({ id, label }) => (
            <button
              key={label}
              onClick={() => setTypeFilter(id)}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                typeFilter === id ? activeBtn : inactiveBtn
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="hidden sm:block text-[var(--section-border)]">|</span>
        <div className="flex items-center gap-1">
          {(["high-fit", "ml"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setScoring(m)}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                scoring === m ? activeBtn : inactiveBtn
              }`}
            >
              {m === "high-fit" ? "High-Fit" : "ML 8+"}
            </button>
          ))}
        </div>
      </div>

      {activeData?.catalog_stats && (
        <StatsBanner
          stats={activeData.catalog_stats}
          fetchedAt={
            "fetched_at" in activeData
              ? (activeData.fetched_at as string)
              : undefined
          }
          typeLabel={typeLabel}
        />
      )}

      {scoring === "high-fit" && highFitData && (
        <>
          {highFitData.items.length === 0 ? (
            <p className="text-[14px] text-[var(--muted-soft)]">
              No scoreable BritBox {typeLabel} yet. Enrich more metadata to
              improve matching.
            </p>
          ) : (
            <ul className="space-y-4 sm:space-y-5">
              {highFitData.items.map((item) => (
                <li key={item.imdb_title_id}>
                  <HighFitCard
                    imdb_title_id={item.imdb_title_id}
                    title={item.title}
                    title_type={item.title_type}
                    year={item.year}
                    poster={item.poster}
                    explanation={item.explanation}
                    provider="BritBox"
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {scoring === "ml" && mlData && (
        <>
          {!mlData.model_available ? (
            <div className="rounded-lg border border-dashed border-[var(--section-border)] bg-[var(--section-bg)] px-5 py-8 text-center">
              <p className="text-[14px] font-medium text-[var(--foreground)]">
                Model not trained yet
              </p>
              <p className="mt-2 text-[13px] leading-[1.5] text-[var(--muted-soft)]">
                Train the 8+ model, then restart the backend:
              </p>
              <code className="mt-3 block rounded-md bg-[var(--card-bg)] px-3 py-2 text-[12px] text-[var(--muted-soft)]">
                cd backend && python -m app.ml.train_8plus_baseline
              </code>
            </div>
          ) : mlData.items.length === 0 ? (
            <p className="text-[14px] text-[var(--muted-soft)]">
              No scoreable BritBox {typeLabel} for ML ranking.
            </p>
          ) : (
            <ul className="space-y-4 sm:space-y-5">
              {mlData.items.map((item) => (
                <li key={item.imdb_title_id}>
                  <BritBoxMLCard item={item} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {!activeData && (
        <p className="text-[14px] text-[var(--muted-soft)]">
          Unable to load BritBox recommendations. Check that the backend is
          running.
        </p>
      )}
    </div>
  );
}
