"use client";

/**
 * Model Lab: internal page for understanding and inspecting ML and recommender logic.
 * For builder/portfolio use. Not part of normal user flow.
 */

import katex from "katex";
import { useEffect, useRef, useState } from "react";
import { API_URL } from "../lib/api";
import Link from "next/link";
import "katex/dist/katex.min.css";

function MathBlock({ tex, className = "" }: { tex: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !tex) return;
    try {
      katex.render(tex, containerRef.current, { displayMode: true, throwOnError: false });
    } catch {
      containerRef.current.textContent = tex;
    }
  }, [tex]);

  return <div ref={containerRef} className={`overflow-x-auto py-0.5 ${className}`} />;
}

type Diagnostics = {
  available: boolean;
  model_type?: string;
  target?: string;
  target_note?: string;
  message?: string;
  dataset_stats?: { n_rows: number; n_positive: number; n_negative: number; positive_rate: number };
  eval_metrics?: { accuracy: number; roc_auc: number };
  feature_count?: number;
  top_positive?: { name: string; coef: number }[];
  top_negative?: { name: string; coef: number }[];
  grouped_positive?: Record<string, { name: string; coef: number }[]>;
  grouped_negative?: Record<string, { name: string; coef: number }[]>;
  training_notes?: string;
};

type MLItem = { imdb_title_id: string; title: string | null; year: number | null; prob_8plus: number; top_features?: string[] };
type HighFitItem = { imdb_title_id: string; title: string | null; explanation: { top_reasons?: string[] } };

function formatFeat(name: string): string {
  const m = name.match(/^[^:]+:(.+)$/);
  return m ? m[1] : name;
}

function formatProb(p: number): string {
  if (p >= 0.995) return ">99%";
  if (p >= 0.99) return "99%";
  return `${Math.round(p * 100)}%`;
}

function shortenReason(reason: string): string {
  if (!reason) return reason;
  const m = reason.match(/^Strong genre[s]?: (.+)$/);
  if (m) {
    const genres = m[1].split(", ");
    return genres.length > 1 ? `Strong genres: ${genres[0]}, ${genres[1]}` : reason;
  }
  if (reason.length > 50) return `${reason.slice(0, 47)}…`;
  return reason;
}

export default function ModelLabPage() {
  const [diag, setDiag] = useState<Diagnostics | null>(null);
  const [comparison, setComparison] = useState<{ ml: MLItem[]; highfit: HighFitItem[]; modelAvailable: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/model-lab/ml-diagnostics`).then((r) => (r.ok ? r.json() : null)),
      Promise.all([
        fetch(`${API_URL}/recommendations/watchlist-ml?limit=15`).then((r) => (r.ok ? r.json() : { items: [], model_available: false })),
        fetch(`${API_URL}/recommendations/watchlist-high-fit?limit=15`).then((r) => (r.ok ? r.json() : [])),
      ]).then(([mlRes, hf]) => ({
        ml: (mlRes?.model_available ? mlRes.items : []) as MLItem[],
        highfit: (Array.isArray(hf) ? hf : []) as HighFitItem[],
        modelAvailable: mlRes?.model_available ?? false,
      })),
    ])
      .then(([d, c]) => {
        setDiag(d);
        setComparison(c);
      })
      .catch(() => setDiag(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <main className="mx-auto max-w-2xl px-4 pb-28 pt-10 sm:px-8 md:max-w-3xl md:px-10 lg:max-w-4xl lg:px-12">
          <div className="flex items-center gap-2 text-[14px] text-[var(--muted-soft)]">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--muted-subtle)]" />
            Loading Model Lab…
          </div>
        </main>
      </div>
    );
  }

  const mlIds = new Set(comparison?.ml?.map((x) => x.imdb_title_id) ?? []);
  const hfIds = new Set(comparison?.highfit?.map((x) => x.imdb_title_id) ?? []);
  const overlap = [...mlIds].filter((id) => hfIds.has(id)).length;
  const mlOnly = [...mlIds].filter((id) => !hfIds.has(id)).length;
  const hfOnly = [...hfIds].filter((id) => !mlIds.has(id)).length;

  return (
    <div className="model-lab min-h-screen bg-[var(--background)]">
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-10 sm:px-8 sm:pt-12 sm:pb-32 md:max-w-3xl md:px-10 md:pt-14 md:pb-40 lg:max-w-4xl lg:px-12">
        <header className="mb-10 sm:mb-12">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div>
              <h1 className="text-[24px] font-semibold tracking-tight text-[var(--foreground)] sm:text-[28px] md:text-[32px]">
                Model Lab
              </h1>
              <p className="mt-2 text-[14px] text-[var(--muted-soft)]">
                Internal page for understanding ML and recommender logic. Not part of normal user flow.
              </p>
            </div>
            <Link
              href="/learn"
              className="shrink-0 text-[13px] text-[var(--muted-soft)] underline underline-offset-2 hover:text-[var(--foreground)]"
            >
              ← Learn
            </Link>
          </div>
        </header>

        <div className="space-y-12 sm:space-y-16">
          {/* 0. How the pipeline works */}
          <section className="rounded-xl border border-[var(--section-border)] border-t-2 border-t-[var(--mondrian-yellow)] bg-[var(--section-bg)] px-5 py-5 sm:px-6 sm:py-6">
            <h2 className="mb-4 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              How the pipeline works
            </h2>
            <div className="space-y-0">
              {/* 1. Data sources */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <p className="w-24 shrink-0 text-[11px] font-medium uppercase tracking-wider text-[var(--overview-muted)]">1. Data</p>
                <div className="flex flex-wrap gap-1.5">
                  {["ratings", "watchlist", "favorite people", "favorite list", "title metadata"].map((label) => (
                    <span key={label} className="rounded-md border border-[var(--section-border)] bg-[var(--card-bg)] px-2 py-0.5 text-[12px] text-[var(--muted-soft)]">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="ml-6 h-3 w-px bg-[var(--section-border)] sm:ml-28" aria-hidden />
              {/* 2. Features */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                <p className="w-24 shrink-0 text-[11px] font-medium uppercase tracking-wider text-[var(--overview-muted)]">2. Features</p>
                <div className="flex flex-wrap gap-1.5">
                  {["genres", "countries", "decades", "title type", "favorite matches", "strong directors", "support-thresholded"].map((label) => (
                    <span key={label} className="rounded-md border border-[var(--section-border)] bg-[var(--card-bg)] px-2 py-0.5 text-[12px] text-[var(--muted-soft)]">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="ml-6 h-3 w-px bg-[var(--section-border)] sm:ml-28" aria-hidden />
              {/* 3. Recommendation paths */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <p className="w-24 shrink-0 text-[11px] font-medium uppercase tracking-wider text-[var(--overview-muted)]">3. Paths</p>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-lg border border-[var(--section-border)] bg-[var(--card-bg)] px-3 py-1.5 text-[12px] font-medium text-[var(--foreground)]">
                    High-Fit: rule-based
                  </span>
                  <span className="text-[12px] text-[var(--muted-subtle)]">+</span>
                  <span className="rounded-lg border border-[var(--section-border)] bg-[var(--card-bg)] px-3 py-1.5 text-[12px] font-medium text-[var(--foreground)]">
                    ML: P(8+)
                  </span>
                </div>
              </div>
              <div className="ml-6 h-3 w-px bg-[var(--section-border)] sm:ml-28" aria-hidden />
              {/* 4. Comparison */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <p className="w-24 shrink-0 text-[11px] font-medium uppercase tracking-wider text-[var(--overview-muted)]">4. Compare</p>
                <div className="flex flex-wrap gap-1.5">
                  {["overlap", "ML-only", "High-Fit-only", "coefficients", "explanations"].map((label) => (
                    <span key={label} className="rounded-md border border-[var(--section-border)] bg-[var(--card-bg)] px-2 py-0.5 text-[12px] text-[var(--muted-soft)]">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="ml-6 h-3 w-px bg-[var(--section-border)] sm:ml-28" aria-hidden />
              {/* 5. Outputs */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <p className="w-24 shrink-0 text-[11px] font-medium uppercase tracking-wider text-[var(--overview-muted)]">5. Outputs</p>
                <div className="flex flex-wrap gap-1.5">
                  {["homepage modes", "insights", "studies", "model lab"].map((label) => (
                    <span key={label} className="rounded-md border border-[var(--section-border)] bg-[var(--card-bg)] px-2 py-0.5 text-[12px] text-[var(--muted-soft)]">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-4 text-[13px] leading-[1.55] text-[var(--muted-soft)]">
              The same underlying data feeds both heuristic and ML recommendation paths. High-Fit uses explicit overlap with your 8+ taste signals; ML learns weights from past ratings. Both produce ranked watchlist suggestions—disagreement between them is expected and informative.
            </p>
            <p className="mt-2 text-[12px] text-[var(--muted-subtle)]">
              Future: similarity model, blended heuristic + ML, grounded LLM watchlist search.
            </p>
          </section>

          {/* 1. ML Model Summary */}
          <section className="rounded-xl border border-[var(--section-border)] bg-[var(--section-bg)] px-5 py-5 sm:px-6 sm:py-6">
            <h2 className="mb-4 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              1. Current ML model summary
            </h2>
            {!diag?.available ? (
              <p className="text-[14px] text-[var(--muted-soft)]">
                {diag?.message ?? "No model diagnostics available. Run: python -m app.ml.train_8plus_baseline"}
              </p>
            ) : (
              <div className="space-y-4 text-[14px]">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--overview-muted)]">Model</p>
                    <p className="mt-1 text-[var(--foreground)]">{diag.model_type} · target: {diag.target}</p>
                    {diag.target_note && (
                      <p className="mt-0.5 text-[12px] text-[var(--muted-soft)]">{diag.target_note}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--overview-muted)]">Dataset</p>
                    <p className="mt-1 text-[var(--foreground)]">
                      {diag.dataset_stats?.n_rows ?? "—"} rows · {diag.dataset_stats?.n_positive ?? "—"} positive ({(diag.dataset_stats?.positive_rate ?? 0) * 100}%)
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--overview-muted)]">Features</p>
                    <p className="mt-1 text-[var(--foreground)]">{diag.feature_count ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--overview-muted)]">Evaluation (test set)</p>
                    <p className="mt-1 text-[var(--foreground)]">
                      Accuracy: {diag.eval_metrics?.accuracy ?? "—"} · ROC-AUC: {diag.eval_metrics?.roc_auc ?? "—"}
                    </p>
                  </div>
                </div>
                {diag.training_notes && (
                  <p className="text-[13px] text-[var(--muted-soft)]">{diag.training_notes}</p>
                )}
                <div className="mt-4 rounded-lg border border-[var(--section-border)] bg-[var(--card-bg)]/50 px-4 py-3">
                  <p className="text-[12px] font-medium text-[var(--foreground)]">How to interpret metrics</p>
                  <p className="mt-1.5 text-[13px] leading-snug text-[var(--muted-soft)]">
                    <strong>Accuracy</strong> = % of test titles correctly classified as 8+ or not. <strong>ROC-AUC</strong> = how well the model ranks positives above negatives across all thresholds. ROC-AUC is especially useful here because we care about ranking (which watchlist items to try first), not a single cutoff. These metrics do not mean the model &quot;understands taste perfectly&quot;—they measure fit to past data, not future surprises.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* 2. What the model sees */}
          <section className="rounded-xl border border-[var(--section-border)] bg-[var(--section-bg)] px-5 py-5 sm:px-6 sm:py-6">
            <h2 className="mb-4 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              2. What the model sees
            </h2>
            <div className="space-y-4 text-[14px] leading-[1.65] text-[var(--muted-soft)]">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-[var(--section-border)] bg-[var(--card-bg)]/50 px-4 py-3">
                  <p className="text-[12px] font-medium text-[var(--foreground)]">Training</p>
                  <p className="mt-1 text-[13px]">One row = one rated title. Each row has a target (8+ or not) and features built from that title&apos;s metadata.</p>
                </div>
                <div className="rounded-lg border border-[var(--section-border)] bg-[var(--card-bg)]/50 px-4 py-3">
                  <p className="text-[12px] font-medium text-[var(--foreground)]">Prediction</p>
                  <p className="mt-1 text-[13px]">One candidate = one watchlist title. Each unrated watchlist item gets a feature vector and a predicted 8+ probability.</p>
                </div>
              </div>
              <div>
                <p className="text-[12px] font-medium text-[var(--foreground)]">Features from a title</p>
                <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-[13px]">
                  <li><strong>Genres</strong> — multi-hot (Drama, Sci-Fi, etc.)</li>
                  <li><strong>Country</strong> — from enriched metadata</li>
                  <li><strong>Decade</strong> — e.g. 2010s</li>
                  <li><strong>Title type</strong> — Movie, TV Series, etc.</li>
                  <li><strong>Taste flags</strong> — favorite_people_match, in_favorite_list</li>
                </ul>
              </div>
              <p className="text-[13px]">
                <strong>Missing metadata</strong> weakens what the model can learn and use. Titles without country, genres, or cast info have sparse or empty features—fewer signals contribute to the score.
              </p>
            </div>
          </section>

          {/* 3. How this model was built */}
          <section className="rounded-xl border border-[var(--section-border)] bg-[var(--section-bg)] px-5 py-5 sm:px-6 sm:py-6">
            <h2 className="mb-4 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              3. How this model was built
            </h2>
            <div className="space-y-5 text-[14px] leading-[1.65] text-[var(--muted-soft)]">
              <div>
                <p className="font-medium text-[var(--foreground)]">Training rows</p>
                <p className="mt-1">
                  One row per rated title from your IMDb export. Every title you&apos;ve rated (with a numeric rating) is included. Genres, year, and title type come from your ratings CSV; country and cast/crew come from enriched metadata when available. Titles without metadata still appear—they just have empty or partial features. This run used {diag?.dataset_stats?.n_rows ?? "—"} rows.
                </p>
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">Target construction</p>
                <p className="mt-1">
                  Target = 1 if rating ≥ 8, else 0. This models &quot;strong favorite / highly likely 8+&quot;—the model predicts whether you&apos;re likely to rate a title 8 or higher. In this system, 7 is still a good rating; it&apos;s not a negative. The binary split is a design choice for interpretability.
                </p>
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">Feature construction</p>
                <p className="mt-1">
                  Genres and countries are multi-hot (each category is a 0/1 flag). Decade and title type are one-hot. Taste flags: favorite_people_match (title has a director/actor/writer from your favorites) and in_favorite_list. Support thresholds filter rare categories: countries need ≥5 titles, genres ≥3, decades and title types ≥3. This reduces noisy coefficients from sparse categories. {diag?.feature_count != null ? `Total: ${diag.feature_count} features.` : ""}
                </p>
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">Train/test setup</p>
                <p className="mt-1">
                  80/20 stratified split (same proportion of 8+ in train and test). <strong>Accuracy</strong> = % of test titles correctly classified as 8+ or not. <strong>ROC-AUC</strong> = area under the ROC curve; it measures how well the model ranks positives above negatives across all thresholds. ROC-AUC is useful here because we care about ranking (which watchlist items to try first), not just a single cutoff.
                </p>
                {diag?.eval_metrics && (
                  <p className="mt-2 text-[13px] text-[var(--foreground)]">
                    This model: Accuracy {diag.eval_metrics.accuracy} · ROC-AUC {diag.eval_metrics.roc_auc} · positive rate {(diag.dataset_stats?.positive_rate ?? 0) * 100}%
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* 4. How prediction works */}
          <section className="rounded-xl border border-[var(--section-border)] bg-[var(--section-bg)] px-5 py-5 sm:px-6 sm:py-6">
            <h2 className="mb-4 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              4. How one prediction is formed
            </h2>
            <div className="space-y-4 text-[14px] leading-[1.65] text-[var(--muted-soft)]">
              <div className="rounded-lg border border-[var(--section-border)] bg-[var(--card-bg)]/50 px-4 py-3">
                <p className="text-[12px] font-medium text-[var(--foreground)]">Scoring flow</p>
                <p className="mt-1 text-[13px]">
                  Title metadata → feature vector → logistic regression applies learned weights → positive weights push score up, negative push down → logistic function converts score into a probability. See the prediction comparison below for concrete examples.
                </p>
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">Details</p>
                <p className="mt-1">
                  Each watchlist title becomes a feature vector (genres, country, decade, title type, taste flags). Logistic regression combines these with learned coefficients. The logistic function squashes the weighted sum into a probability between 0 and 1.
                </p>
                <div className="mt-3 space-y-3 rounded-lg border border-[var(--section-border)] bg-[var(--section-bg)] px-4 py-3">
                  <div className="space-y-1">
                    <MathBlock tex={String.raw`P(y=1 \mid x) = \sigma(w^\top x + b)`} />
                    <p className="text-[12px] leading-snug text-[var(--muted-soft)]">Probability of 8+ given features: weighted sum passed through the logistic function.</p>
                  </div>
                  <div className="space-y-1">
                    <MathBlock tex={String.raw`\sigma(z) = \frac{1}{1 + e^{-z}}`} />
                    <p className="text-[12px] leading-snug text-[var(--muted-soft)]">Logistic function squashes the score into a probability between 0 and 1.</p>
                  </div>
                </div>
              </div>
              <p className="text-[13px]">
                Watchlist titles are sorted by predicted 8+ probability. Highest first. Top contributing features per title can be shown for interpretability.
              </p>
            </div>
          </section>

          {/* 5. Coefficient inspection */}
          {diag?.available && (diag.top_positive?.length || diag.top_negative?.length) && (
            <section className="rounded-xl border border-[var(--section-border)] bg-[var(--section-bg)] px-5 py-5 sm:px-6 sm:py-6">
              <h2 className="mb-2 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
                5. Coefficient inspection
              </h2>
              <p className="mb-4 text-[13px] text-[var(--muted-soft)]">
                Positive coefficient = more associated with 8+ (strong favorite) ratings. Negative = less associated. 7 is still a good rating—not a negative. Post-scaler; magnitude reflects relative importance.
              </p>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-[12px] font-medium text-[var(--overview-muted)]">Top positive (predict 8+)</p>
                  <ul className="space-y-1">
                    {(diag.top_positive ?? []).map(({ name, coef }, i) => (
                      <li key={i} className="flex min-w-0 justify-between gap-2 text-[13px]">
                        <span className="min-w-0 truncate text-[var(--foreground)]">{formatFeat(name)}</span>
                        <span className="shrink-0 tabular-nums text-[var(--muted-soft)]">{coef > 0 ? "+" : ""}{coef}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-2 text-[12px] font-medium text-[var(--overview-muted)]">Top negative (predict &lt;8+; 7 is still good)</p>
                  <ul className="space-y-1">
                    {(diag.top_negative ?? []).map(({ name, coef }, i) => (
                      <li key={i} className="flex min-w-0 justify-between gap-2 text-[13px]">
                        <span className="min-w-0 truncate text-[var(--foreground)]">{formatFeat(name)}</span>
                        <span className="shrink-0 tabular-nums text-[var(--muted-soft)]">{coef}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {diag.grouped_positive && Object.keys(diag.grouped_positive).length > 0 && (
                <div className="mt-6">
                  <p className="mb-2 text-[12px] font-medium text-[var(--overview-muted)]">By feature type (positive)</p>
                  <div className="flex flex-wrap gap-4">
                    {Object.entries(diag.grouped_positive).map(([type, items]) => (
                      <div key={type} className="min-w-0 basis-32 sm:basis-40">
                        <p className="text-[11px] font-medium text-[var(--muted-soft)]">{type}</p>
                        <ul className="mt-1 space-y-0.5">
                          {items.slice(0, 4).map(({ name, coef }, i) => (
                            <li key={i} className="text-[12px]">
                              {formatFeat(name)} <span className="tabular-nums text-[var(--muted-soft)]">{coef > 0 ? "+" : ""}{coef}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* 6. Prediction inspection & recommender comparison */}
          <section className="rounded-xl border border-[var(--section-border)] bg-[var(--section-bg)] px-5 py-5 sm:px-6 sm:py-6">
            <h2 className="mb-2 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              6. Compare ML vs High-Fit
            </h2>
            <p className="mb-3 text-[13px] text-[var(--muted-soft)]">
              ML learns weighted patterns from past ratings; High-Fit uses explicit taste-signal overlap. Disagreement is expected and useful.
            </p>
            <p className="mb-4 text-[12px] text-[var(--overview-muted)]">
              Overlap: {overlap} · ML-only: {mlOnly} · High-Fit-only: {hfOnly}
            </p>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--overview-muted)]">Overlap</p>
                <ul className="space-y-3 text-[13px]">
                  {overlap === 0 ? (
                    <li className="rounded-md border border-dashed border-[var(--section-border)] bg-[var(--card-bg)]/30 px-3 py-2.5 text-[12px] text-[var(--muted-soft)]">
                      No overlap — ML and High-Fit picked different top items.
                    </li>
                  ) : (
                    [...mlIds].filter((id) => hfIds.has(id)).slice(0, 8).map((id) => {
                      const ml = comparison?.ml?.find((m) => m.imdb_title_id === id);
                      const reason = comparison?.highfit?.find((h) => h.imdb_title_id === id)?.explanation?.top_reasons?.[0];
                      return (
                        <li key={id} className="block min-w-0">
                          <a href={`https://www.imdb.com/title/${id}/`} target="_blank" rel="noopener noreferrer" className="block break-words font-medium text-[var(--foreground)] underline underline-offset-2 hover:text-[var(--accent)]">
                            {ml?.title ?? id}
                          </a>
                          <p className="mt-0.5 break-words text-[12px] text-[var(--muted-soft)]">
                            {ml && formatProb(ml.prob_8plus)}
                            {reason && ` · ${shortenReason(reason)}`}
                          </p>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--overview-muted)]">ML only</p>
                <ul className="space-y-3 text-[13px]">
                  {mlOnly === 0 ? (
                    <li className="text-[12px] text-[var(--muted-soft)]">—</li>
                  ) : (
                    [...mlIds].filter((id) => !hfIds.has(id)).slice(0, 8).map((id) => {
                      const ml = comparison?.ml?.find((m) => m.imdb_title_id === id);
                      const feats = (ml?.top_features ?? []).slice(0, 2).map(formatFeat);
                      return (
                        <li key={id} className="block min-w-0">
                          <a href={`https://www.imdb.com/title/${id}/`} target="_blank" rel="noopener noreferrer" className="block break-words font-medium text-[var(--foreground)] underline underline-offset-2 hover:text-[var(--accent)]">
                            {ml?.title ?? id}
                          </a>
                          <p className="mt-0.5 break-words text-[12px] text-[var(--muted-soft)]">
                            {ml && formatProb(ml.prob_8plus)}
                            {feats.length > 0 && ` · ${feats.join(", ")}`}
                          </p>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--overview-muted)]">High-Fit only</p>
                <ul className="space-y-3 text-[13px]">
                  {hfOnly === 0 ? (
                    <li className="text-[12px] text-[var(--muted-soft)]">—</li>
                  ) : (
                    [...hfIds].filter((id) => !mlIds.has(id)).slice(0, 8).map((id) => {
                      const hf = comparison?.highfit?.find((m) => m.imdb_title_id === id);
                      const reason = hf?.explanation?.top_reasons?.[0];
                      return (
                        <li key={id} className="block min-w-0">
                          <a href={`https://www.imdb.com/title/${id}/`} target="_blank" rel="noopener noreferrer" className="block break-words font-medium text-[var(--foreground)] underline underline-offset-2 hover:text-[var(--accent)]">
                            {hf?.title ?? id}
                          </a>
                          {reason && (
                            <p className="mt-0.5 break-words text-[12px] text-[var(--muted-soft)]">
                              {shortenReason(reason)}
                            </p>
                          )}
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            </div>
          </section>

          {/* 7. Model limitations */}
          <section className="rounded-xl border border-[var(--section-border)] bg-[var(--section-bg)] px-5 py-5 sm:px-6 sm:py-6">
            <h2 className="mb-4 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              7. Model limitations
            </h2>
            <ul className="space-y-2 text-[14px] leading-[1.6] text-[var(--muted-soft)]">
              <li><strong>Single-user model</strong> — Your data only. No collaborative filtering.</li>
              <li><strong>Content-based only</strong> — Genres, countries, decade, title type, taste flags. No embeddings or semantic similarity yet.</li>
              <li><strong>Dependent on metadata coverage</strong> — Missing country, genres, or cast weakens the score.</li>
              <li><strong>Target = 8+ as strong-favorite proxy</strong> — The binary split is a design choice. 7 is still a good rating even though it&apos;s on the negative side of the current target.</li>
              <li><strong>Association, not causation</strong> — Features correlate with 8+ but don&apos;t necessarily cause high ratings. Predictions are estimates, not guarantees.</li>
            </ul>
          </section>

          {/* 8. Learning notes */}
          <section className="rounded-xl border border-[var(--section-border)] bg-[var(--section-bg)] px-5 py-5 sm:px-6 sm:py-6">
            <h2 className="mb-4 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              8. Learning notes
            </h2>
            <div className="space-y-4 text-[14px] leading-[1.6] text-[var(--muted-soft)]">
              <div>
                <p className="font-medium text-[var(--foreground)]">Coefficients</p>
                <p>In logistic regression, a positive coefficient means the feature is associated with higher P(8+). Negative means lower. Magnitude reflects strength after scaling.</p>
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">Lift (Studies)</p>
                <p>Lift = (8+ rate for a feature) ÷ (global 8+ rate). Lift &gt; 1 = you rate higher when this feature is present. Used in heuristic analysis, not in the ML model.</p>
                <div className="mt-2 space-y-1 rounded-lg border border-[var(--section-border)] bg-[var(--section-bg)] px-4 py-2.5">
                  <MathBlock tex={String.raw`\text{lift} = \frac{P(8+ \mid \text{feature})}{P(8+)}`} />
                  <p className="text-[12px] leading-snug text-[var(--muted-soft)]">How much more often you rate 8+ when the feature is present vs. overall.</p>
                </div>
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">Support thresholds</p>
                <p>Min-support (e.g. 5 for countries) filters sparse categories. Rare features can have noisy coefficients; excluding them makes the model more stable and interpretable.</p>
              </div>
            </div>
          </section>

          {/* 9. Future model directions */}
          <section className="rounded-xl border border-dashed border-[var(--section-border)] bg-[var(--section-bg)]/50 px-5 py-5 sm:px-6 sm:py-6">
            <h2 className="mb-4 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              9. Future model directions
            </h2>
            <ul className="space-y-2 text-[14px] leading-[1.55] text-[var(--muted-soft)]">
              <li><strong>7+ model</strong> — Broader target (&quot;likely to like&quot;) than strong favorites</li>
              <li><strong>Multi-tier / ordinal</strong> — Model 7 vs 8 vs 9+ instead of binary</li>
              <li><strong>Similarity-based</strong> — Content or embedding similarity to titles you loved</li>
              <li><strong>Blended heuristic + ML</strong> — Combine High-Fit and ML scores</li>
              <li><strong>Grounded LLM watchlist search</strong> — Natural-language queries over your watchlist, grounded in your data</li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
