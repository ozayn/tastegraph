"use client";

import { useEffect, useState } from "react";
import { API_URL } from "../lib/api";

type Overview = {
  total_rated: number;
  average_rating: number | null;
  min_rating?: number | null;
  max_rating?: number | null;
  top_genres: { genre: string; count: number }[];
  top_genres_by_avg: { genre: string; avg_rating: number; count: number }[];
  top_countries: { country: string; count: number }[];
  top_decades: { decade: string; count: number }[];
};

type People = {
  top_directors: { name: string; count: number; avg_rating: number | null }[];
  top_actors: { name: string; count: number; avg_rating: number | null }[];
  top_writers: { name: string; count: number; avg_rating: number | null }[];
};

type Trends = {
  ratings_by_year_watched: Record<number, number>;
  avg_rating_by_year_watched: Record<number, number | null>;
  release_year_distribution: Record<number, number>;
};

type TasteSignals = {
  strong_genres: { genre: string; count: number }[];
  strong_countries: { country: string; count: number }[];
  recurring_people: { name: string; count: number }[];
};

type InsightsData = {
  overview: Overview;
  people: People;
  trends: Trends;
  taste_signals: TasteSignals;
};

function StatCard({
  title,
  subtitle,
  variant = "default",
  children,
}: {
  title: string;
  subtitle?: string;
  variant?: "hero" | "default";
  children: React.ReactNode;
}) {
  const isHero = variant === "hero";
  return (
    <div
      className={`rounded-xl border border-[var(--section-border)] px-5 py-5 sm:px-6 sm:py-6 ${
        isHero ? "bg-[var(--card-bg)] shadow-sm" : "bg-[var(--section-bg)]"
      }`}
    >
      <p
        className={
          isHero
            ? "text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--overview-muted)]"
            : "text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--overview-muted)]"
        }
      >
        {title}
      </p>
      {subtitle && (
        <p className="mt-0.5 text-[11px] text-[var(--muted-subtle)]">{subtitle}</p>
      )}
      <div className={isHero ? "mt-5" : "mt-4"}>{children}</div>
    </div>
  );
}

function BarListRow({
  label,
  sub,
  barPct,
}: {
  label: string;
  sub?: React.ReactNode;
  barPct: number;
}) {
  return (
    <li className="group relative flex items-baseline justify-between gap-3 py-1.5">
      <div
        className="absolute inset-y-0 left-0 rounded-md bg-[var(--muted-subtle)]/15 transition-opacity group-hover:opacity-90"
        style={{ width: `${Math.max(barPct, 4)}%` }}
        aria-hidden
      />
      <span className="relative min-w-0 truncate pl-1 text-[14px] text-[var(--foreground)]">
        {label}
      </span>
      {sub != null && (
        <span className="relative shrink-0 text-[13px] text-[var(--muted-soft)]">
          {sub}
        </span>
      )}
    </li>
  );
}

function BarChart({
  data,
  getLabel,
  getValue,
  maxBars = 10,
}: {
  data: { label: string; value: number }[];
  getLabel: (d: { label: string; value: number }) => string;
  getValue: (d: { label: string; value: number }) => number;
  maxBars?: number;
}) {
  if (!data.length) return null;
  const maxVal = Math.max(...data.map(getValue), 1);
  const items = data.slice(-maxBars);
  return (
    <div className="space-y-3">
      {items.map((d, i) => (
        <div key={i} className="flex items-center gap-4">
          <span className="w-10 shrink-0 text-[13px] font-medium tabular-nums text-[var(--foreground)]">
            {getLabel(d)}
          </span>
          <div className="min-w-0 flex-1">
            <div
              className="h-2.5 rounded-md bg-[var(--muted-subtle)]/25 transition-all"
              style={{ width: `${Math.max((getValue(d) / maxVal) * 100, 2)}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-[13px] tabular-nums text-[var(--muted-soft)]">
            {getValue(d)}
          </span>
        </div>
      ))}
    </div>
  );
}

function BarList<T extends { [key: string]: unknown }>({
  items,
  getValue,
  renderLabel,
  renderSub,
}: {
  items: T[];
  getValue: (item: T) => number;
  renderLabel: (item: T) => string;
  renderSub?: (item: T) => React.ReactNode;
}) {
  if (!items.length) return null;
  const maxVal = Math.max(...items.map(getValue), 1);
  return (
    <ul className="space-y-0">
      {items.map((item, i) => (
        <BarListRow
          key={i}
          label={renderLabel(item)}
          sub={renderSub?.(item)}
          barPct={(getValue(item) / maxVal) * 100}
        />
      ))}
    </ul>
  );
}

export default function InsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/insights`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <main className="mx-auto max-w-2xl px-4 pb-28 pt-10 sm:px-8 sm:pt-12 sm:pb-32 md:max-w-3xl md:px-10 md:pt-14 md:pb-40 lg:max-w-4xl lg:px-12">
          <div className="flex items-center gap-2 text-[14px] text-[var(--muted-soft)]">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--muted-subtle)]" />
            Loading insights…
          </div>
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <main className="mx-auto max-w-2xl px-4 pb-28 pt-10 sm:px-8 md:max-w-3xl md:px-10 lg:max-w-4xl lg:px-12">
          <p className="text-[14px] text-[var(--muted-soft)]">
            Unable to load insights. Check that the backend is running.
          </p>
        </main>
      </div>
    );
  }

  const { overview, people, trends, taste_signals } = data;
  const yearsWatched = Object.keys(trends.ratings_by_year_watched)
    .map(Number)
    .sort();
  const releaseDecades = (() => {
    const byDecade: Record<string, number> = {};
    for (const [yearStr, count] of Object.entries(trends.release_year_distribution)) {
      const y = parseInt(yearStr, 10);
      const decade = `${Math.floor(y / 10) * 10}s`;
      byDecade[decade] = (byDecade[decade] || 0) + count;
    }
    return Object.entries(byDecade)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => parseInt(a.label, 10) - parseInt(b.label, 10));
  })();

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-10 sm:px-8 sm:pt-12 sm:pb-32 md:max-w-3xl md:px-10 md:pt-14 md:pb-40 lg:max-w-4xl lg:px-12">
        <header className="mb-14 sm:mb-16 md:mb-20">
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--foreground)] sm:text-[28px] md:text-[32px]">
            Insights
          </h1>
          <p className="mt-3 max-w-lg text-[15px] leading-[1.6] text-[var(--muted-soft)] sm:text-[16px]">
            Aggregated viewing history and taste profile from your ratings.
          </p>
        </header>

        <div className="space-y-16 sm:space-y-20 md:space-y-24">
          {/* Overview */}
          <section>
            <h2 className="mb-2 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              Overview
            </h2>
            <p className="mb-8 text-[13px] leading-relaxed text-[var(--muted-soft)]">
              Core metrics and distribution across genres, countries, and decades.
            </p>
            <div className="mb-10 grid gap-6 sm:grid-cols-2">
              <StatCard
                variant="hero"
                title="Total rated"
                subtitle="titles in your library"
              >
                <p className="text-[32px] font-semibold tabular-nums tracking-tight text-[var(--foreground)] sm:text-[36px]">
                  {overview.total_rated.toLocaleString()}
                </p>
              </StatCard>
              <StatCard
                variant="hero"
                title="Average rating"
                subtitle="mean across all rated titles"
              >
                <p className="text-[32px] font-semibold tabular-nums tracking-tight text-[var(--foreground)] sm:text-[36px]">
                  {overview.average_rating?.toFixed(1) ?? "—"}
                </p>
                <p className="mt-1 text-[13px] text-[var(--muted-soft)]">
                  out of 10
                  {overview.min_rating != null && overview.max_rating != null && (
                    <span className="ml-1.5">· {overview.min_rating}–{overview.max_rating} range</span>
                  )}
                </p>
              </StatCard>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                title="Top genres by count"
                subtitle="most frequent in your ratings"
              >
                <BarList
                  items={overview.top_genres}
                  getValue={(x) => x.count}
                  renderLabel={(x) => x.genre}
                  renderSub={(x) => `${x.count} titles`}
                />
              </StatCard>
              <StatCard
                title="Favorite genres by avg rating"
                subtitle="highest mean rating, min 3 titles"
              >
                <BarList
                  items={overview.top_genres_by_avg}
                  getValue={(x) => x.avg_rating}
                  renderLabel={(x) => x.genre}
                  renderSub={(x) =>
                    `${x.avg_rating.toFixed(1)} · ${x.count} titles`
                  }
                />
              </StatCard>
              <StatCard
                title="Top countries by count"
                subtitle="production countries in rated titles"
              >
                <BarList
                  items={overview.top_countries}
                  getValue={(x) => x.count}
                  renderLabel={(x) => x.country}
                  renderSub={(x) => `${x.count} titles`}
                />
              </StatCard>
              <StatCard
                title="Favorite decades"
                subtitle="release decades by count"
              >
                <BarList
                  items={overview.top_decades}
                  getValue={(x) => x.count}
                  renderLabel={(x) => x.decade}
                  renderSub={(x) => `${x.count} titles`}
                />
              </StatCard>
            </div>
          </section>

          {/* People */}
          <section>
            <h2 className="mb-2 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              People
            </h2>
            <p className="mb-8 text-[13px] leading-relaxed text-[var(--muted-soft)]">
              Most-watched directors, actors, and writers in your rated titles.
            </p>
            <div className="grid gap-6 sm:grid-cols-3">
              <StatCard
                title="Most-watched directors"
                subtitle="titles · avg rating"
              >
                <BarList
                  items={people.top_directors}
                  getValue={(x) => x.count}
                  renderLabel={(x) => x.name}
                  renderSub={(x) =>
                    x.avg_rating != null
                      ? `${x.count} · ${x.avg_rating.toFixed(1)}`
                      : `${x.count} titles`
                  }
                />
              </StatCard>
              <StatCard
                title="Most-seen actors"
                subtitle="titles · avg rating"
              >
                <BarList
                  items={people.top_actors}
                  getValue={(x) => x.count}
                  renderLabel={(x) => x.name}
                  renderSub={(x) =>
                    x.avg_rating != null
                      ? `${x.count} · ${x.avg_rating.toFixed(1)}`
                      : `${x.count} titles`
                  }
                />
              </StatCard>
              <StatCard
                title="Most-seen writers"
                subtitle="titles · avg rating"
              >
                <BarList
                  items={people.top_writers}
                  getValue={(x) => x.count}
                  renderLabel={(x) => x.name}
                  renderSub={(x) =>
                    x.avg_rating != null
                      ? `${x.count} · ${x.avg_rating.toFixed(1)}`
                      : `${x.count} titles`
                  }
                />
              </StatCard>
            </div>
          </section>

          {/* Trends */}
          <section>
            <h2 className="mb-2 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              Trends
            </h2>
            <p className="mb-8 text-[13px] leading-relaxed text-[var(--muted-soft)]">
              When you rated titles and when they were released.
            </p>
            <div className="grid gap-6 sm:grid-cols-2">
              <StatCard
                title="Ratings by year watched"
                subtitle="when you rated (date_rated)"
              >
                {yearsWatched.length > 0 ? (
                  <BarChart
                    data={yearsWatched.map((y) => ({
                      label: String(y),
                      value: trends.ratings_by_year_watched[y],
                    }))}
                    getLabel={(d) => d.label}
                    getValue={(d) => d.value}
                    maxBars={150}
                  />
                ) : (
                  <p className="text-[14px] text-[var(--muted-soft)]">
                    No date-rated data yet.
                  </p>
                )}
              </StatCard>
              <StatCard
                title="Release decade distribution"
                subtitle="titles by release decade (1910s, 1920s, …)"
              >
                {releaseDecades.length > 0 ? (
                  <BarChart
                    data={releaseDecades}
                    getLabel={(d) => d.label}
                    getValue={(d) => d.value}
                    maxBars={20}
                  />
                ) : (
                  <p className="text-[14px] text-[var(--muted-soft)]">
                    No release year data.
                  </p>
                )}
              </StatCard>
            </div>
          </section>

          {/* Taste signals */}
          <section>
            <h2 className="mb-2 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              Taste signals
            </h2>
            <p className="mb-8 text-[13px] leading-relaxed text-[var(--muted-soft)]">
              Patterns in titles you rated 8 or higher.
            </p>
            <div className="grid gap-6 sm:grid-cols-3">
              <StatCard
                title="Strong genres"
                subtitle="in highly rated titles"
              >
                <BarList
                  items={taste_signals.strong_genres}
                  getValue={(x) => x.count}
                  renderLabel={(x) => x.genre}
                  renderSub={(x) => `${x.count} titles`}
                />
              </StatCard>
              <StatCard
                title="Strong countries"
                subtitle="in highly rated titles"
              >
                <BarList
                  items={taste_signals.strong_countries}
                  getValue={(x) => x.count}
                  renderLabel={(x) => x.country}
                  renderSub={(x) => `${x.count} titles`}
                />
              </StatCard>
              <StatCard
                title="Recurring people"
                subtitle="2+ titles rated 8+"
              >
                <BarList
                  items={taste_signals.recurring_people}
                  getValue={(x) => x.count}
                  renderLabel={(x) => x.name}
                  renderSub={(x) => `${x.count} titles`}
                />
              </StatCard>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
