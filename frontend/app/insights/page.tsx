"use client";

import { useEffect, useState } from "react";
import { API_URL } from "../lib/api";
import { SectionHelp } from "../components/SectionHelp";
import { CountriesMap } from "../components/CountriesMap";

type Overview = {
  total_rated: number;
  average_rating: number | null;
  min_rating?: number | null;
  max_rating?: number | null;
  top_genres: { genre: string; count: number }[];
  top_genres_by_avg: { genre: string; avg_rating: number; count: number }[];
  top_countries: { country: string; count: number }[];
  all_countries?: { country: string; count: number }[];
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
  variant?: "hero" | "list" | "chart" | "default";
  children: React.ReactNode;
}) {
  const isHero = variant === "hero";
  const isList = variant === "list";
  const isChart = variant === "chart";
  return (
    <div
      className={`rounded-xl border px-5 py-5 sm:px-6 sm:py-6 ${
        isHero
          ? "border-[var(--section-border)] border-t-2 border-t-[var(--mondrian-yellow)] bg-[var(--card-bg)] shadow-sm"
          : isList
            ? "border-[var(--section-border)] bg-[var(--card-bg)]"
            : isChart
              ? "border-[var(--section-border)] bg-[var(--section-bg)]"
              : "border-[var(--section-border)] bg-[var(--section-bg)]"
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
  compact,
}: {
  label: string;
  sub?: React.ReactNode;
  barPct: number;
  compact?: boolean;
}) {
  return (
    <li className={`group relative flex items-center justify-between gap-2 px-1 sm:gap-4 ${compact ? "py-1.5" : "py-2.5"}`}>
      <div
        className="absolute inset-y-0 left-0 rounded-md bg-[var(--mondrian-yellow)]/25 transition-opacity group-hover:opacity-100"
        style={{ width: `${Math.max(barPct, 4)}%`, left: 0, right: "auto" }}
        aria-hidden
      />
      <span className="relative z-10 min-w-0 truncate pl-2 pr-2 text-[14px] text-[var(--foreground)]">
        {label}
      </span>
      {sub != null && (
        <span className="relative z-10 shrink-0 pl-2 pr-2 text-[13px] text-[var(--muted-soft)]">
          {sub}
        </span>
      )}
    </li>
  );
}

/** Column chart: x = label, y = value. Labels on horizontal axis, hover tooltip. */
function CountByYearChart({
  data,
  valueLabel = "rated",
  xLabel,
  yLabel,
}: {
  data: { label: string; value: number }[];
  valueLabel?: string;
  xLabel?: string;
  yLabel?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (!data.length) return null;
  const pad = { top: 18, right: 8, bottom: 32, left: 32 };
  const w = 280;
  const h = 160;
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const barW = Math.max(2, (chartW / data.length) * 0.7);
  const gap = data.length > 1 ? (chartW - barW * data.length) / (data.length - 1) : 0;

  const yScale = (v: number) => pad.top + chartH - (chartH * v) / maxVal;

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 -10 ${w} ${h + 10}`}
        className="h-[160px] w-full max-w-[320px]"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* y-axis */}
        <line
          x1={pad.left}
          y1={pad.top}
          x2={pad.left}
          y2={h - pad.bottom}
          stroke="var(--muted-subtle)"
          strokeWidth="1"
        />
        {/* x-axis */}
        <line
          x1={pad.left}
          y1={h - pad.bottom}
          x2={w - pad.right}
          y2={h - pad.bottom}
          stroke="var(--muted-subtle)"
          strokeWidth="1"
        />
        {data.map((d, i) => (
          <rect
            key={i}
            x={pad.left + i * (barW + gap)}
            y={yScale(d.value)}
            width={barW}
            height={h - pad.bottom - yScale(d.value)}
            rx={2}
            fill="var(--mondrian-blue)"
            fillOpacity={hovered === i ? 0.6 : 0.4}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
          />
        ))}
      {/* y-axis label */}
        {yLabel && (
          <>
            <text
              x={pad.left - 6}
              y={-2}
              textAnchor="end"
              style={{ fill: "var(--muted-subtle)", fontSize: 9 }}
            >
              {yLabel}
            </text>
          </>
        )}
        {/* y-axis tick labels */}
        <text
          x={pad.left - 6}
          y={pad.top + 3}
          textAnchor="end"
          style={{ fill: "var(--muted-soft)", fontSize: 10 }}
        >
          {maxVal}
        </text>
        <text
          x={pad.left - 6}
          y={h - pad.bottom + 4}
          textAnchor="end"
          style={{ fill: "var(--muted-soft)", fontSize: 10 }}
        >
          0
        </text>
        {/* x-axis tick labels */}
        {data.length > 0 && (
          <>
            <text
              x={pad.left}
              y={h - 10}
              textAnchor="start"
              style={{ fill: "var(--muted-soft)", fontSize: 10 }}
            >
              {data[0].label}
            </text>
            <text
              x={w - pad.right}
              y={h - 10}
              textAnchor="end"
              style={{ fill: "var(--muted-soft)", fontSize: 10 }}
            >
              {data[data.length - 1].label}
            </text>
          </>
        )}
        {/* x-axis label */}
        {xLabel && (
          <text
            x={w / 2}
            y={h - 4}
            textAnchor="middle"
            style={{ fill: "var(--muted-subtle)", fontSize: 9 }}
          >
            {xLabel}
          </text>
        )}
      </svg>
      {hovered != null && data[hovered] && (
        <div
          className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 rounded-md border border-[var(--section-border)] bg-[var(--card-bg)] px-2.5 py-1.5 text-[11px] shadow-sm"
        >
          <div className="font-medium text-[var(--foreground)]">
            {data[hovered].label}
          </div>
          <div className="mt-0.5 tabular-nums text-[var(--muted-soft)]">
            {data[hovered].value} {valueLabel}
          </div>
        </div>
      )}
    </div>
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
        <div key={i} className="flex min-w-0 items-center gap-2 sm:gap-4">
          <span className="min-w-0 shrink-0 truncate text-[13px] font-medium tabular-nums text-[var(--foreground)] sm:w-16">
            {getLabel(d)}
          </span>
          <div className="min-w-0 flex-1">
            <div
              className="h-2.5 rounded-md bg-[var(--mondrian-blue)]/30 transition-all"
              style={{ width: `${Math.max((getValue(d) / maxVal) * 100, 2)}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-[12px] tabular-nums text-[var(--muted-soft)] sm:w-10 sm:text-[13px]">
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
  compact,
}: {
  items: T[];
  getValue: (item: T) => number;
  renderLabel: (item: T) => string;
  renderSub?: (item: T) => React.ReactNode;
  compact?: boolean;
}) {
  if (!items.length) return null;
  const maxVal = Math.max(...items.map(getValue), 1);
  return (
    <ul className={compact ? "space-y-0.5" : "space-y-1"}>
      {items.map((item, i) => (
        <BarListRow
          key={i}
          label={renderLabel(item)}
          sub={renderSub?.(item)}
          barPct={(getValue(item) / maxVal) * 100}
          compact={compact}
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
        <header className="mb-10 sm:mb-12">
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--foreground)] sm:text-[28px] md:text-[32px]">
            Insights
          </h1>
          <p className="mt-2 max-w-lg text-[15px] leading-[1.55] text-[var(--muted-soft)] sm:text-[16px]">
            Aggregated viewing history and taste profile from your ratings.
          </p>
        </header>

        <div className="space-y-14 sm:space-y-16 md:space-y-20">
          {/* Overview */}
          <section className="border-t-2 border-t-[var(--mondrian-yellow)] pt-6">
            <h2 className="mb-1 text-[18px] font-semibold tracking-tight text-[var(--foreground)] sm:text-[19px]">
              Overview
              <SectionHelp title="How to read this">
                <p><strong>Top genres by count</strong> = what you watch most. <strong>Favorite genres by avg</strong> = what you rate highest (min 3 titles to reduce noise).</p>
                <p>Countries and decades are from production metadata. All derived from your ratings—no external preferences.</p>
              </SectionHelp>
            </h2>
            <p className="mb-6 text-[13px] leading-relaxed text-[var(--muted-soft)]">
              Core metrics and distribution across genres, countries, and decades.
            </p>
            <div className="mb-8 grid gap-5 sm:grid-cols-2">
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
            <div className="grid gap-5 sm:grid-cols-2">
              <StatCard
                variant="list"
                title="Top genres by count"
                subtitle="most frequent in your ratings"
              >
                <BarList
                  items={overview.top_genres}
                  getValue={(x) => x.count}
                  renderLabel={(x) => x.genre}
                  renderSub={(x) => `${x.count} titles`}
                  compact
                />
              </StatCard>
              <StatCard
                variant="list"
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
                  compact
                />
              </StatCard>
              <StatCard
                variant="list"
                title="Top countries by count"
                subtitle="production countries in rated titles"
              >
                <BarList
                  items={overview.top_countries}
                  getValue={(x) => x.count}
                  renderLabel={(x) => x.country}
                  renderSub={(x) => `${x.count} titles`}
                  compact
                />
              </StatCard>
              <StatCard
                variant="chart"
                title="Watched by country"
                subtitle="Geographic spread of your rated titles, regardless of rating."
              >
                {(overview.all_countries ?? overview.top_countries).length > 0 ? (
                  <div className="flex min-h-[200px] justify-center items-center p-4">
                    <CountriesMap items={overview.all_countries ?? overview.top_countries} />
                  </div>
                ) : (
                  <p className="text-[14px] text-[var(--muted-soft)]">
                    No country data in your rated titles yet.
                  </p>
                )}
              </StatCard>
            </div>
          </section>

          {/* People */}
          <section className="border-t border-[var(--section-border)] pt-8">
            <h2 className="mb-1 text-[18px] font-semibold tracking-tight text-[var(--foreground)] sm:text-[19px]">
              People
              <SectionHelp title="How to read this">
                <p>Most-watched = highest count in your rated titles. Avg rating shows how you tend to rate their work.</p>
                <p>Count ≠ quality: you might watch many blockbusters but rate arthouse higher. Both signals matter for recommendations.</p>
              </SectionHelp>
            </h2>
            <p className="mb-6 text-[13px] leading-relaxed text-[var(--muted-soft)]">
              Most-watched directors, actors, and writers in your rated titles.
            </p>
            <div className="grid gap-5 sm:grid-cols-3">
              <StatCard
                variant="list"
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
                  compact
                />
              </StatCard>
              <StatCard
                variant="list"
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
                  compact
                />
              </StatCard>
              <StatCard
                variant="list"
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
                  compact
                />
              </StatCard>
            </div>
          </section>

          {/* Trends */}
          <section className="border-t border-[var(--section-border)] pt-8">
            <h2 className="mb-1 text-[18px] font-semibold tracking-tight text-[var(--foreground)] sm:text-[19px]">
              Trends
            </h2>
            <p className="mb-6 text-[13px] leading-relaxed text-[var(--muted-soft)]">
              When you rated titles and when they were released.
            </p>
            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <StatCard
                variant="chart"
                title="Ratings by year watched"
                subtitle="when you rated (date_rated)"
              >
                {yearsWatched.length > 0 ? (
                  <CountByYearChart
                    data={yearsWatched.map((y) => ({
                      label: String(y),
                      value: trends.ratings_by_year_watched[y],
                    }))}
                    xLabel="Year watched"
                    yLabel="Count"
                  />
                ) : (
                  <p className="text-[14px] text-[var(--muted-soft)]">
                    No date-rated data yet.
                  </p>
                )}
              </StatCard>
              <StatCard
                variant="chart"
                title="Release decade distribution"
                subtitle="titles by release decade (1910s, 1920s, …)"
              >
                {releaseDecades.length > 0 ? (
                  <CountByYearChart
                    data={releaseDecades}
                    valueLabel="titles"
                    xLabel="Release decade"
                    yLabel="Count"
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
          <section className="border-t-2 border-t-[var(--mondrian-red)]/40 pt-8">
            <h2 className="mb-1 text-[18px] font-semibold tracking-tight text-[var(--foreground)] sm:text-[19px]">
              Taste signals
              <SectionHelp title="How to read this">
                <p>Patterns in titles you rated <strong>8+</strong>. Strong genres/countries = frequent in your favorites. Recurring people = directors/actors/writers in 2+ titles you rated 8+.</p>
                <p>These feed into the heuristic recommender: high-fit watchlist and Studies use them to rank and explain recommendations.</p>
              </SectionHelp>
            </h2>
            <p className="mb-6 text-[13px] leading-relaxed text-[var(--muted-soft)]">
              Patterns in titles you rated 8 or higher.
            </p>
            <div className="grid gap-5 sm:grid-cols-3">
              <StatCard
                variant="list"
                title="Strong genres"
                subtitle="in highly rated titles"
              >
                <BarList
                  items={taste_signals.strong_genres}
                  getValue={(x) => x.count}
                  renderLabel={(x) => x.genre}
                  renderSub={(x) => `${x.count} titles`}
                  compact
                />
              </StatCard>
              <StatCard
                variant="list"
                title="Strong countries"
                subtitle="in highly rated titles"
              >
                <BarList
                  items={taste_signals.strong_countries}
                  getValue={(x) => x.count}
                  renderLabel={(x) => x.country}
                  renderSub={(x) => `${x.count} titles`}
                  compact
                />
              </StatCard>
              <StatCard
                variant="list"
                title="Recurring people"
                subtitle="2+ titles rated 8+"
              >
                <BarList
                  items={taste_signals.recurring_people}
                  getValue={(x) => x.count}
                  renderLabel={(x) => x.name}
                  renderSub={(x) => `${x.count} titles`}
                  compact
                />
              </StatCard>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
