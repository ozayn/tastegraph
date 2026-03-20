"use client";

import { useEffect, useState } from "react";
import { API_URL } from "../lib/api";
import { SectionHelp } from "../components/SectionHelp";

type GenreShift = {
  genre: string;
  early_count: number;
  recent_count: number;
  delta: number;
};

type TasteEvolution = {
  avg_rating_by_year: Record<number, number | null>;
  count_by_year: Record<number, number>;
  top_genres_by_year: Record<number, { genre: string; count: number }[]>;
  top_countries_by_year: Record<number, { country: string; count: number }[]>;
  genre_shifts: GenreShift[];
};

type PredictorSignal = {
  feature: string;
  count: number;
  rate_8plus: number;
  lift: number;
  score?: number;
};

type Predictors8Plus = {
  global_rate_8plus: number;
  min_support: number;
  genre_signals: PredictorSignal[];
  country_signals: PredictorSignal[];
  decade_signals: PredictorSignal[];
  language_signals: PredictorSignal[];
  title_type_signals: PredictorSignal[];
};

type AlignedFeature = {
  genre?: string;
  country?: string;
  watchlist_count: number;
  rate_8plus: number;
  rated_count: number;
};

type WatchlistTasteAlignment = {
  aligned_genres: AlignedFeature[];
  aligned_countries: AlignedFeature[];
};

type GenrePair = {
  genres: string;
  count: number;
  rate_8plus: number;
  lift: number;
};

type GenreCombinations = {
  min_support: number;
  global_rate_8plus: number;
  pairs: GenrePair[];
};

type Creator = {
  name: string;
  count: number;
  avg_rating: number;
};

type BestCreators = {
  min_support: number;
  directors: Creator[];
  actors: Creator[];
  writers: Creator[];
};

type FavoriteListSummary = {
  count: number;
  top_genres: { genre: string; count: number }[];
  top_countries: { country: string; count: number }[];
  overlap_with_rated: number;
};

type EightsVsSevens = {
  min_support: number;
  genre_signals: { feature: string; count_8plus: number; count_7: number; ratio_8_over_7: number }[];
  country_signals: { feature: string; count_8plus: number; count_7: number; ratio_8_over_7: number }[];
  decade_signals: { feature: string; count_8plus: number; count_7: number; ratio_8_over_7: number }[];
};

type VolumeVsReward = {
  min_support: number;
  watch_lot_love_less_genres: { feature: string; count: number; avg_rating: number }[];
  watch_less_love_more_genres: { feature: string; count: number; avg_rating: number }[];
  watch_lot_love_less_countries: { feature: string; count: number; avg_rating: number }[];
  watch_less_love_more_countries: { feature: string; count: number; avg_rating: number }[];
};

type StudiesData = {
  taste_evolution: TasteEvolution & {
    country_shifts?: { country: string; early_count: number; recent_count: number; delta: number }[];
    biggest_genre_increases?: GenreShift[];
    biggest_genre_decreases?: GenreShift[];
  };
  predictors_8plus: Predictors8Plus;
  watchlist_taste_alignment: WatchlistTasteAlignment;
  genre_combinations?: GenreCombinations;
  best_creators?: BestCreators;
  eights_vs_sevens?: EightsVsSevens;
  volume_vs_reward?: VolumeVsReward;
  favorite_list_summary?: FavoriteListSummary;
};

function StatCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--section-border)] bg-[var(--section-bg)] px-5 py-5 sm:px-6 sm:py-6">
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--overview-muted)]">
        {title}
      </p>
      {subtitle && (
        <p className="mt-0.5 text-[11px] text-[var(--muted-subtle)]">{subtitle}</p>
      )}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function BarListRow({
  label,
  sub,
  barPct,
  variant = "default",
}: {
  label: string;
  sub?: React.ReactNode;
  barPct: number;
  variant?: "positive" | "negative" | "default";
}) {
  const barColors = {
    positive: "bg-[var(--shift-increase)]",
    negative: "bg-[var(--shift-decline)]",
    default: "bg-[var(--mondrian-yellow)]/25",
  };
  return (
    <li className="group relative flex items-center justify-between gap-4 py-2.5 px-1">
      <div
        className={`absolute inset-y-0 left-0 rounded-md ${barColors[variant]} transition-opacity group-hover:opacity-100`}
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

/** Diverging horizontal bar chart: gains right of center, declines left of center. */
function DivergingBarList<T extends { delta: number }>({
  items,
  renderLabel,
  renderSub,
}: {
  items: T[];
  renderLabel: (item: T) => string;
  renderSub?: (item: T) => React.ReactNode;
}) {
  if (!items.length) return null;
  const maxAbs = Math.max(...items.map((s) => Math.abs(s.delta)), 1);
  return (
    <ul className="space-y-2">
      {items.map((item, i) => {
        const { delta } = item;
        const pctOfHalf = (Math.abs(delta) / maxAbs) * 100;
        return (
          <li key={i} className="flex items-center gap-3">
            <span className="w-20 shrink-0 truncate text-[14px] text-[var(--foreground)] sm:w-24">
              {renderLabel(item)}
            </span>
            <div className="flex min-h-[22px] flex-1 items-stretch">
              <div className="flex flex-1 justify-end">
                {delta < 0 && (
                  <div
                    className="rounded-l bg-[var(--shift-decline)] transition-opacity hover:opacity-90"
                    style={{ width: `${pctOfHalf}%`, minWidth: 4 }}
                    aria-hidden
                  />
                )}
              </div>
              <div className="w-px shrink-0 bg-[var(--section-border)]" aria-hidden />
              <div className="flex flex-1 justify-start">
                {delta > 0 && (
                  <div
                    className="rounded-r bg-[var(--shift-increase)] transition-opacity hover:opacity-90"
                    style={{ width: `${pctOfHalf}%`, minWidth: 4 }}
                    aria-hidden
                  />
                )}
              </div>
            </div>
            {renderSub && (
              <span className="w-16 shrink-0 text-right text-[13px] tabular-nums text-[var(--muted-soft)]">
                {renderSub(item)}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function BarList<T>({
  items,
  getValue,
  renderLabel,
  renderSub,
  getBarVariant,
}: {
  items: T[];
  getValue: (item: T) => number;
  renderLabel: (item: T) => string;
  renderSub?: (item: T) => React.ReactNode;
  getBarVariant?: (item: T) => "positive" | "negative" | "default";
}) {
  if (!items.length) return null;
  const maxVal = Math.max(...items.map(getValue), 1);
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <BarListRow
          key={i}
          label={renderLabel(item)}
          sub={renderSub?.(item)}
          barPct={(getValue(item) / maxVal) * 100}
          variant={getBarVariant?.(item)}
        />
      ))}
    </ul>
  );
}

function BarChart({
  data,
  getLabel,
  getValue,
  maxBars = 20,
  maxValOverride,
  formatValue,
}: {
  data: { label: string; value: number }[];
  getLabel: (d: { label: string; value: number }) => string;
  getValue: (d: { label: string; value: number }) => number;
  maxBars?: number;
  maxValOverride?: number;
  formatValue?: (v: number) => string;
}) {
  if (!data.length) return null;
  const maxVal = maxValOverride ?? Math.max(...data.map(getValue), 1);
  const items = data.slice(-maxBars);
  const fmt = formatValue ?? ((v) => String(v));
  return (
    <div className="space-y-3">
      {items.map((d, i) => (
        <div key={i} className="flex items-center gap-4">
          <span className="w-10 shrink-0 text-[13px] font-medium tabular-nums text-[var(--foreground)]">
            {getLabel(d)}
          </span>
          <div className="min-w-0 flex-1">
            <div
              className="h-2.5 rounded-md bg-[var(--mondrian-blue)]/30 transition-all"
              style={{ width: `${Math.max((getValue(d) / maxVal) * 100, 2)}%` }}
            />
          </div>
          <span className="w-12 shrink-0 text-right text-[13px] tabular-nums text-[var(--muted-soft)]">
            {fmt(getValue(d))}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function StudiesPage() {
  const [data, setData] = useState<StudiesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/studies`)
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
            Loading studies…
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
            Unable to load studies. Check that the backend is running.
          </p>
        </main>
      </div>
    );
  }

  const { taste_evolution, predictors_8plus, watchlist_taste_alignment, genre_combinations, best_creators, eights_vs_sevens, volume_vs_reward, favorite_list_summary } = data;

  const yearsWithData = Object.keys(taste_evolution.avg_rating_by_year)
    .map(Number)
    .sort();
  const avgByYearData = yearsWithData.map((y) => ({
    label: String(y),
    value: taste_evolution.avg_rating_by_year[y] ?? 0,
  }));

  const allSignals = [
    ...predictors_8plus.genre_signals.map((s) => ({ ...s, type: "genre" })),
    ...predictors_8plus.country_signals.map((s) => ({ ...s, type: "country" })),
    ...predictors_8plus.decade_signals.map((s) => ({ ...s, type: "decade" })),
    ...predictors_8plus.language_signals.map((s) => ({ ...s, type: "language" })),
    ...predictors_8plus.title_type_signals.map((s) => ({ ...s, type: "title_type" })),
  ].filter((s) => s.lift > 1);
  allSignals.sort((a, b) => (b.score ?? b.lift) - (a.score ?? a.lift));

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-10 sm:px-8 sm:pt-12 sm:pb-32 md:max-w-3xl md:px-10 md:pt-14 md:pb-40 lg:max-w-4xl lg:px-12">
        <header className="mb-14 sm:mb-16 md:mb-20">
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--foreground)] sm:text-[28px] md:text-[32px]">
            Studies
          </h1>
          <p className="mt-3 max-w-lg text-[15px] leading-[1.6] text-[var(--muted-soft)] sm:text-[16px]">
            Analytical deep-dives into your viewing patterns.
          </p>
        </header>

        <div className="space-y-16 sm:space-y-20 md:space-y-24">
          {/* 1. How has my taste changed over time? */}
          <section className="border-t-2 border-t-[var(--mondrian-yellow)] pt-4">
            <h2 className="mb-2 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              How has my taste changed over time?
              <SectionHelp title="How to read this">
                <p>Tracks how your ratings and genre/country mix change by <strong>year watched</strong> (when you rated, not release year).</p>
                <p>Genre shifts compare first vs second half of your history—what changed most since you started rating. Needs 4+ years of data.</p>
              </SectionHelp>
            </h2>
            <p className="mb-6 text-[13px] leading-relaxed text-[var(--muted-soft)]">
              What changed most in your taste since you started rating.
            </p>
            <div className="grid gap-6 sm:grid-cols-2">
              <StatCard
                title="Average rating by year watched"
                subtitle="mean rating when you rated titles"
              >
                {avgByYearData.length > 0 ? (
                  <BarChart
                    data={avgByYearData}
                    getLabel={(d) => d.label}
                    getValue={(d) => d.value}
                    maxBars={20}
                    maxValOverride={10}
                    formatValue={(v) => v.toFixed(1)}
                  />
                ) : (
                  <p className="text-[14px] text-[var(--muted-soft)]">
                    No date-rated data yet.
                  </p>
                )}
              </StatCard>
              <StatCard
                title="Genre shifts: early vs recent"
                subtitle="biggest changes between first and second half. Right = more in recent, left = less."
              >
                {taste_evolution.genre_shifts?.length > 0 ? (() => {
                    const nonzero = taste_evolution.genre_shifts
                      .filter((s) => s.delta !== 0)
                      .sort((a, b) => b.delta - a.delta);
                    return nonzero.length > 0 ? (
                      <DivergingBarList
                        items={nonzero}
                        renderLabel={(s) => s.genre}
                        renderSub={(s) =>
                          s.delta > 0
                            ? `+${s.delta}`
                            : `${s.delta}`
                        }
                      />
                    ) : (
                      <p className="text-[14px] text-[var(--muted-soft)]">
                        No notable shifts.
                      </p>
                    );
                  })() : (
                  <p className="text-[14px] text-[var(--muted-soft)]">
                    Need 4+ years of data for early vs recent comparison.
                  </p>
                )}
              </StatCard>
            </div>
          </section>

          {/* 2. What distinguishes my 8s from my 7s? */}
          {eights_vs_sevens && !("note" in eights_vs_sevens) && (eights_vs_sevens.genre_signals?.length || eights_vs_sevens.country_signals?.length || eights_vs_sevens.decade_signals?.length) ? (
            <section className="border-t border-[var(--section-border)] pt-8">
              <h2 className="mb-2 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
                What distinguishes my 8s from my 7s?
                <SectionHelp title="How to read this">
                  <p>Features that appear <strong>more often</strong> in titles you rated 8+ than in titles you rated 7.</p>
                  <p>7 = liked; 8+ = strong favorite. Ratio &gt; 1 means this feature is more associated with strong favorites than good-but-not-top-tier ratings.</p>
                  <p>Requires min {eights_vs_sevens.min_support} titles in each group (8+ and 7) per feature.</p>
                </SectionHelp>
              </h2>
              <p className="mb-6 text-[13px] leading-relaxed text-[var(--muted-soft)]">
                What separates strong favorites from good-but-not-top-tier ratings.
              </p>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {eights_vs_sevens.genre_signals?.length ? (
                  <StatCard title="Genres" subtitle="ratio 8+ vs 7">
                    <BarList
                      items={eights_vs_sevens.genre_signals}
                      getValue={(s) => s.ratio_8_over_7}
                      renderLabel={(s) => s.feature}
                      renderSub={(s) => `${s.ratio_8_over_7}× · n8=${s.count_8plus} n7=${s.count_7}`}
                    />
                  </StatCard>
                ) : null}
                {eights_vs_sevens.country_signals?.length ? (
                  <StatCard title="Countries" subtitle="ratio 8+ vs 7">
                    <BarList
                      items={eights_vs_sevens.country_signals}
                      getValue={(s) => s.ratio_8_over_7}
                      renderLabel={(s) => s.feature}
                      renderSub={(s) => `${s.ratio_8_over_7}×`}
                    />
                  </StatCard>
                ) : null}
                {eights_vs_sevens.decade_signals?.length ? (
                  <StatCard title="Decades" subtitle="ratio 8+ vs 7">
                    <BarList
                      items={eights_vs_sevens.decade_signals}
                      getValue={(s) => s.ratio_8_over_7}
                      renderLabel={(s) => s.feature}
                      renderSub={(s) => `${s.ratio_8_over_7}×`}
                    />
                  </StatCard>
                ) : null}
              </div>
            </section>
          ) : null}

          {/* 4. What do I watch often but not love as much? */}
          {volume_vs_reward && (volume_vs_reward.watch_lot_love_less_genres?.length || volume_vs_reward.watch_less_love_more_genres?.length) ? (
            <section className="border-t border-[var(--section-border)] pt-8">
              <h2 className="mb-2 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
                What do I watch often but not love as much?
                <SectionHelp title="How to read this">
                  <p><strong>Watch a lot, love less</strong> = genres/countries you consume frequently but rate lower on average.</p>
                  <p><strong>Watch less, love more</strong> = genres/countries you watch less often but rate higher when you do.</p>
                  <p>Based on rank mismatch: high volume rank but low avg-rank (or vice versa). Min {volume_vs_reward.min_support} titles.</p>
                </SectionHelp>
              </h2>
              <p className="mb-6 text-[13px] leading-relaxed text-[var(--muted-soft)]">
                Volume vs reward: overconsumed vs high-reward patterns.
              </p>
              <div className="grid gap-5 sm:grid-cols-2">
                <StatCard title="Watch a lot, love less" subtitle="high volume, lower avg rating">
                  <BarList
                    items={[
                      ...(volume_vs_reward.watch_lot_love_less_genres ?? []),
                      ...(volume_vs_reward.watch_lot_love_less_countries ?? []),
                    ]}
                    getValue={(x) => x.count}
                    renderLabel={(x) => x.feature}
                    renderSub={(x) => `${x.count} titles · avg ${x.avg_rating}`}
                  />
                </StatCard>
                <StatCard title="Watch less, love more" subtitle="lower volume, higher avg rating">
                  <BarList
                    items={[
                      ...(volume_vs_reward.watch_less_love_more_genres ?? []),
                      ...(volume_vs_reward.watch_less_love_more_countries ?? []),
                    ]}
                    getValue={(x) => x.avg_rating}
                    renderLabel={(x) => x.feature}
                    renderSub={(x) => `${x.count} titles · avg ${x.avg_rating}`}
                  />
                </StatCard>
              </div>
            </section>
          ) : null}

          {/* 5. Features associated with 8+ */}
          <section>
            <h2 className="mb-2 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              Features associated with 8+ ratings
              <SectionHelp title="How to read this">
                <p>This measures <strong>association</strong>, not causation: genres, countries, decades, etc. that appear more often in titles you rated 8+ than in your library overall.</p>
                <p><strong>Lift</strong> = (8+ rate for this feature) ÷ (your global 8+ rate). Lift &gt; 1 means you tend to rate higher when this feature is present.</p>
                <p><strong>Caution:</strong> Small sample sizes (low n) can produce noisy lift. The min support threshold filters out unreliable signals.</p>
              </SectionHelp>
            </h2>
            <p className="mb-8 text-[13px] leading-relaxed text-[var(--muted-soft)]">
              Lift = 8+ rate in group / global rate. Ranked by lift × support weight (min n={predictors_8plus.min_support}).
            </p>
            <div className="grid gap-6 sm:grid-cols-2">
              <StatCard
                title="Global 8+ rate"
                subtitle="baseline across all rated titles"
              >
                <p className="text-[24px] font-semibold tabular-nums text-[var(--foreground)]">
                  {(predictors_8plus.global_rate_8plus * 100).toFixed(1)}%
                </p>
              </StatCard>
              <StatCard
                title="Top positive signals"
                subtitle="lift &gt; 1, penalized for small n"
              >
                <BarList
                  items={allSignals.slice(0, 10)}
                  getValue={(s) => s.score ?? s.lift}
                  renderLabel={(s) => s.feature}
                  renderSub={(s) =>
                    `lift ${s.lift} · ${(s.rate_8plus * 100).toFixed(0)}% · n=${s.count}`
                  }
                />
              </StatCard>
            </div>
          </section>

          {/* 3. Watchlist taste alignment */}
          <section>
            <h2 className="mb-2 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              Watchlist taste alignment
              <SectionHelp title="How to read this">
                <p>Genres and countries that appear in your <strong>watchlist</strong> and that you tend to rate 8+ when you <em>do</em> rate them.</p>
                <p>High 8+ rate here = strong candidates for what to watch next from your saved list. Requires minimum titles in watchlist and in rated history to avoid noise.</p>
              </SectionHelp>
            </h2>
            <p className="mb-8 text-[13px] leading-relaxed text-[var(--muted-soft)]">
              Genres and countries in your watchlist that you tend to rate 8+. When you rate titles in these groups, you give 8+ often—so these are strong recommendation candidates.
            </p>
            <div className="grid gap-6 sm:grid-cols-2">
              <StatCard
                title="Watchlist genres aligned with your taste"
                subtitle="your 8+ rate when rating this genre (min 5 in watchlist, 15 rated)"
              >
                <BarList
                  items={watchlist_taste_alignment.aligned_genres}
                  getValue={(x) => x.rate_8plus}
                  renderLabel={(x) => x.genre ?? ""}
                  renderSub={(x) =>
                    `${(x.rate_8plus * 100).toFixed(0)}% · ${x.watchlist_count} in WL`
                  }
                />
              </StatCard>
              <StatCard
                title="Watchlist countries aligned with your taste"
                subtitle="your 8+ rate when rating this country (min 5 in watchlist, 15 rated)"
              >
                <BarList
                  items={watchlist_taste_alignment.aligned_countries}
                  getValue={(x) => x.rate_8plus}
                  renderLabel={(x) => x.country ?? ""}
                  renderSub={(x) =>
                    `${(x.rate_8plus * 100).toFixed(0)}% · ${x.watchlist_count} in WL`
                  }
                />
              </StatCard>
            </div>
          </section>

          {/* 4. Curated favorites list */}
          {favorite_list_summary && favorite_list_summary.count > 0 && (
            <section>
              <h2 className="mb-2 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
                Curated favorites list
                <SectionHelp title="How to read this">
                  <p>Your hand-picked &quot;would recommend&quot; list. Overlap with rated = titles you&apos;ve both saved as favorites and rated.</p>
                  <p>Used as a strong signal for high-fit watchlist: similar titles (by genre, country, creators) get boosted in recommendations.</p>
                </SectionHelp>
              </h2>
              <p className="mb-8 text-[13px] leading-relaxed text-[var(--muted-soft)]">
                Titles you&apos;d recommend to friends. Used as a strong taste signal for high-fit ranking.
              </p>
              <div className="grid gap-6 sm:grid-cols-3">
                <StatCard
                  title="Total titles"
                  subtitle="in your curated list"
                >
                  <p className="text-[24px] font-semibold tabular-nums text-[var(--foreground)]">
                    {favorite_list_summary.count}
                  </p>
                </StatCard>
                <StatCard
                  title="Overlap with rated"
                  subtitle="titles you&apos;ve also rated"
                >
                  <p className="text-[24px] font-semibold tabular-nums text-[var(--foreground)]">
                    {favorite_list_summary.overlap_with_rated}
                  </p>
                </StatCard>
                <StatCard
                  title="Top genres"
                  subtitle="in curated list"
                >
                  <BarList
                    items={favorite_list_summary.top_genres}
                    getValue={(x) => x.count}
                    renderLabel={(x) => x.genre}
                    renderSub={(x) => `${x.count}`}
                  />
                </StatCard>
              </div>
            </section>
          )}

          {/* 5. Genre combination analysis */}
          {genre_combinations && genre_combinations.pairs.length > 0 && (
            <section>
              <h2 className="mb-2 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
                Genre combination analysis
                <SectionHelp title="How to read this">
                  <p>Some genre <strong>pairs</strong> (e.g. Drama + Romance) correlate with higher 8+ rates than either genre alone.</p>
                  <p>Useful for discovery: if you love both, titles with both may be especially strong fits. Association only—small n can inflate rates.</p>
                </SectionHelp>
              </h2>
              <p className="mb-8 text-[13px] leading-relaxed text-[var(--muted-soft)]">
                Genre pairs associated with higher 8+ rate (min {genre_combinations.min_support} titles per pair).
              </p>
              <div className="rounded-xl border border-[var(--section-border)] bg-[var(--section-bg)] px-5 py-5 sm:px-6 sm:py-6">
                <BarList
                  items={genre_combinations.pairs}
                  getValue={(x) => x.rate_8plus}
                  renderLabel={(x) => x.genres}
                  renderSub={(x) =>
                    `${(x.rate_8plus * 100).toFixed(0)}% · n=${x.count}`
                  }
                />
              </div>
            </section>
          )}

          {/* 6. Favorite creators (min support) */}
          {best_creators && (best_creators.directors.length > 0 || best_creators.actors.length > 0 || best_creators.writers.length > 0) && (
            <section>
              <h2 className="mb-2 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
                Favorite creators (min {best_creators.min_support} rated titles)
                <SectionHelp title="How to read this">
                  <p>Creators whose work you consistently rate highly. The min-support threshold ensures they&apos;re based on enough data—one 10/10 doesn&apos;t make a favorite.</p>
                  <p>Used as a taste signal for high-fit watchlist ranking: titles from these creators get a boost when you haven&apos;t seen them yet.</p>
                </SectionHelp>
              </h2>
              <p className="mb-8 text-[13px] leading-relaxed text-[var(--muted-soft)]">
                Directors, actors, and writers with the highest average rating among those you&apos;ve rated at least {best_creators.min_support} times.
              </p>
              <div className="grid gap-6 sm:grid-cols-3">
                {best_creators.directors.length > 0 && (
                  <StatCard
                    title="Best directors"
                    subtitle="count · avg rating"
                  >
                    <BarList
                      items={best_creators.directors}
                      getValue={(x) => x.avg_rating}
                      renderLabel={(x) => x.name}
                      renderSub={(x) => `${x.count} · ${x.avg_rating.toFixed(1)}`}
                    />
                  </StatCard>
                )}
                {best_creators.actors.length > 0 && (
                  <StatCard
                    title="Best actors"
                    subtitle="count · avg rating"
                  >
                    <BarList
                      items={best_creators.actors}
                      getValue={(x) => x.avg_rating}
                      renderLabel={(x) => x.name}
                      renderSub={(x) => `${x.count} · ${x.avg_rating.toFixed(1)}`}
                    />
                  </StatCard>
                )}
                {best_creators.writers.length > 0 && (
                  <StatCard
                    title="Best writers"
                    subtitle="count · avg rating"
                  >
                    <BarList
                      items={best_creators.writers}
                      getValue={(x) => x.avg_rating}
                      renderLabel={(x) => x.name}
                      renderSub={(x) => `${x.count} · ${x.avg_rating.toFixed(1)}`}
                    />
                  </StatCard>
                )}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
