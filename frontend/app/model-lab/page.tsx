"use client";

/**
 * Model Lab: internal page for understanding and inspecting ML and recommender logic.
 * For builder/portfolio use. Not part of normal user flow.
 */

import { useEffect, useState } from "react";
import { API_URL } from "../lib/api";
import Link from "next/link";

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
    <div className="min-h-screen bg-[var(--background)]">
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-10 sm:px-8 sm:pt-12 sm:pb-32 md:max-w-3xl md:px-10 md:pt-14 md:pb-40 lg:max-w-4xl lg:px-12">
        <header className="mb-10 sm:mb-12">
          <div className="flex items-center justify-between gap-4">
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
              </div>
            )}
          </section>

          {/* 2. Coefficient inspection */}
          {diag?.available && (diag.top_positive?.length || diag.top_negative?.length) && (
            <section className="rounded-xl border border-[var(--section-border)] bg-[var(--section-bg)] px-5 py-5 sm:px-6 sm:py-6">
              <h2 className="mb-2 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
                2. Coefficient inspection
              </h2>
              <p className="mb-4 text-[13px] text-[var(--muted-soft)]">
                Positive coefficient = more associated with 8+ (strong favorite) ratings. Negative = less associated. 7 is still a good rating—not a negative. Post-scaler; magnitude reflects relative importance.
              </p>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-[12px] font-medium text-[var(--overview-muted)]">Top positive (predict 8+)</p>
                  <ul className="space-y-1">
                    {(diag.top_positive ?? []).map(({ name, coef }, i) => (
                      <li key={i} className="flex justify-between gap-2 text-[13px]">
                        <span className="truncate text-[var(--foreground)]">{formatFeat(name)}</span>
                        <span className="shrink-0 tabular-nums text-[var(--muted-soft)]">{coef > 0 ? "+" : ""}{coef}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-2 text-[12px] font-medium text-[var(--overview-muted)]">Top negative (predict &lt;8+; 7 is still good)</p>
                  <ul className="space-y-1">
                    {(diag.top_negative ?? []).map(({ name, coef }, i) => (
                      <li key={i} className="flex justify-between gap-2 text-[13px]">
                        <span className="truncate text-[var(--foreground)]">{formatFeat(name)}</span>
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
                      <div key={type} className="min-w-0">
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

          {/* 3. Prediction inspection & 4. Recommender comparison */}
          <section className="rounded-xl border border-[var(--section-border)] bg-[var(--section-bg)] px-5 py-5 sm:px-6 sm:py-6">
            <h2 className="mb-2 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              3. Prediction inspection & 4. Recommender comparison
            </h2>
            <p className="mb-4 text-[13px] text-[var(--muted-soft)]">
              Top 15 watchlist items from each strategy. Overlap: {overlap} · ML-only: {mlOnly} · High-Fit–only: {hfOnly}
            </p>
            <div className="grid gap-6 sm:grid-cols-3">
              <div>
                <p className="mb-2 text-[12px] font-medium text-[var(--overview-muted)]">Overlap</p>
                <ul className="space-y-1 text-[13px]">
                  {[...mlIds].filter((id) => hfIds.has(id)).slice(0, 8).map((id) => {
                    const ml = comparison?.ml?.find((m) => m.imdb_title_id === id);
                    return (
                      <li key={id}>
                        <a href={`https://www.imdb.com/title/${id}/`} target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--accent)]">
                          {ml?.title ?? id}
                        </a>
                        {ml && <span className="ml-1 text-[var(--muted-soft)]">{(ml.prob_8plus * 100).toFixed(0)}%</span>}
                      </li>
                    );
                  })}
                  {overlap === 0 && <li className="text-[var(--muted-soft)]">—</li>}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-[12px] font-medium text-[var(--overview-muted)]">ML only</p>
                <ul className="space-y-1 text-[13px]">
                  {[...mlIds].filter((id) => !hfIds.has(id)).slice(0, 8).map((id) => {
                    const ml = comparison?.ml?.find((m) => m.imdb_title_id === id);
                    const feat = ml?.top_features?.[0];
                    return (
                      <li key={id}>
                        <a href={`https://www.imdb.com/title/${id}/`} target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--accent)]">
                          {ml?.title ?? id}
                        </a>
                        <span className="ml-1 text-[var(--muted-soft)]">
                          {(ml?.prob_8plus ?? 0) * 100}%{feat ? ` · ${formatFeat(feat)}` : ""}
                        </span>
                      </li>
                    );
                  })}
                  {mlOnly === 0 && <li className="text-[var(--muted-soft)]">—</li>}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-[12px] font-medium text-[var(--overview-muted)]">High-Fit only</p>
                <ul className="space-y-1 text-[13px]">
                  {[...hfIds].filter((id) => !mlIds.has(id)).slice(0, 8).map((id) => {
                    const hf = comparison?.highfit?.find((m) => m.imdb_title_id === id);
                    const reason = hf?.explanation?.top_reasons?.[0];
                    return (
                      <li key={id}>
                        <a href={`https://www.imdb.com/title/${id}/`} target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--accent)]">
                          {hf?.title ?? id}
                        </a>
                        {reason && <span className="ml-1 text-[var(--muted-soft)]">· {reason}</span>}
                      </li>
                    );
                  })}
                  {hfOnly === 0 && <li className="text-[var(--muted-soft)]">—</li>}
                </ul>
              </div>
            </div>
          </section>

          {/* 5. Learning-oriented explanations */}
          <section className="rounded-xl border border-[var(--section-border)] bg-[var(--section-bg)] px-5 py-5 sm:px-6 sm:py-6">
            <h2 className="mb-4 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              5. Learning notes
            </h2>
            <div className="space-y-4 text-[14px] leading-[1.6] text-[var(--muted-soft)]">
              <div>
                <p className="font-medium text-[var(--foreground)]">Coefficients</p>
                <p>In logistic regression, a positive coefficient means the feature is associated with higher P(8+). Negative means lower. Magnitude reflects strength after scaling.</p>
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">Lift (Studies)</p>
                <p>Lift = (8+ rate for a feature) ÷ (global 8+ rate). Lift &gt; 1 = you rate higher when this feature is present. Used in heuristic analysis, not in the ML model.</p>
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">Heuristic vs ML</p>
                <p>High-Fit uses explicit overlap with your 8+ taste signals (genres, countries, creators). ML learns weights from data. Both are association-based; neither guarantees you&apos;ll love a title.</p>
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">Support thresholds</p>
                <p>Min-support (e.g. 5 for countries) filters sparse categories. Rare features can have noisy coefficients; excluding them makes the model more stable and interpretable.</p>
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">Association ≠ causation</p>
                <p>Correlation with 8+ does not mean the feature causes high ratings. Confounders (e.g. era, platform) may explain both.</p>
              </div>
            </div>
          </section>

          {/* 6. Future-ready structure */}
          <section className="rounded-xl border border-dashed border-[var(--section-border)] bg-[var(--section-bg)]/50 px-5 py-5 sm:px-6 sm:py-6">
            <h2 className="mb-4 text-[17px] font-semibold text-[var(--foreground)] sm:text-[18px]">
              6. Future models (placeholder)
            </h2>
            <ul className="space-y-1.5 text-[14px] text-[var(--muted-soft)]">
              <li>7+ model for &quot;likely to like&quot; (broader than strong favorites)</li>
              <li>Multi-tier / ordinal rating model</li>
              <li>Similarity model (content-based, embedding-based)</li>
              <li>Blended model (heuristic + ML + similarity)</li>
              <li>LLM search / explanation layer</li>
              <li>Additional evaluation metrics (precision@k, NDCG, etc.)</li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
