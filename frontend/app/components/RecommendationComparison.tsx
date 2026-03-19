"use client";

import { useEffect, useState } from "react";
import { API_URL } from "../lib/api";

type MLItem = {
  imdb_title_id: string;
  title: string | null;
  year: number | null;
  prob_8plus: number;
  top_features?: string[];
};

type HighFitItem = {
  imdb_title_id: string;
  title: string | null;
  year: number | null;
  explanation: { top_reasons?: string[] };
};

const LIMIT = 15;

function Row({
  id,
  title,
  hint,
}: {
  id: string;
  title: string | null;
  hint?: string;
}) {
  const display = title ?? id;
  return (
    <li className="flex items-baseline justify-between gap-3 py-1 text-[13px]">
      <a
        href={`https://www.imdb.com/title/${id}/`}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 truncate text-[var(--foreground)] underline decoration-[var(--muted-subtle)] underline-offset-2 hover:text-[var(--accent)]"
      >
        {display}
      </a>
      {hint && (
        <span className="shrink-0 truncate max-w-[12rem] text-right text-[12px] text-[var(--muted-soft)]">
          {hint}
        </span>
      )}
    </li>
  );
}

export function RecommendationComparison() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{
    ml: MLItem[];
    highfit: HighFitItem[];
    modelAvailable: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || data) return;
    setLoading(true);
    Promise.all([
      fetch(`${API_URL}/recommendations/watchlist-ml?limit=${LIMIT}`).then((r) =>
        r.ok ? r.json() : { items: [], model_available: false }
      ),
      fetch(`${API_URL}/recommendations/watchlist-high-fit?limit=${LIMIT}`).then(
        (r) => (r.ok ? r.json() : [])
      ),
    ])
      .then(([mlRes, highfitItems]) => {
        const mlItems = (mlRes.model_available ? mlRes.items : []) as MLItem[];
        const highfit = Array.isArray(highfitItems) ? highfitItems : [];
        setData({
          ml: mlItems,
          highfit: highfit as HighFitItem[],
          modelAvailable: mlRes.model_available ?? false,
        });
      })
      .catch(() => setData({ ml: [], highfit: [], modelAvailable: false }))
      .finally(() => setLoading(false));
  }, [open, data]);

  const mlIds = new Set((data?.ml ?? []).map((x) => x.imdb_title_id));
  const highfitIds = new Set((data?.highfit ?? []).map((x) => x.imdb_title_id));
  const overlapIds = [...mlIds].filter((id) => highfitIds.has(id));
  const mlOnlyIds = [...mlIds].filter((id) => !highfitIds.has(id));
  const highfitOnlyIds = [...highfitIds].filter((id) => !mlIds.has(id));

  const mlById = new Map((data?.ml ?? []).map((x) => [x.imdb_title_id, x]));
  const highfitById = new Map((data?.highfit ?? []).map((x) => [x.imdb_title_id, x]));

  return (
    <details
      className="mt-6 rounded-lg border border-[var(--section-border)] bg-[var(--card-bg)]"
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer list-none px-4 py-3 text-[13px] font-medium text-[var(--muted-soft)] hover:text-[var(--foreground)] [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          Compare ML vs High-Fit
          {data && (
            <span className="text-[12px] font-normal">
              ({overlapIds.length} overlap · {mlOnlyIds.length} ML-only · {highfitOnlyIds.length} High-Fit–only)
            </span>
          )}
        </span>
      </summary>
      <div className="border-t border-[var(--section-border)] px-4 py-3">
        {loading ? (
          <p className="text-[13px] text-[var(--muted-soft)]">Loading…</p>
        ) : !data ? (
          <p className="text-[13px] text-[var(--muted-soft)]">Open to load comparison.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3 text-[12px]">
            <div>
              <p className="mb-1.5 font-medium text-[var(--overview-muted)]">Overlap ({overlapIds.length})</p>
              <ul className="space-y-0">
                {overlapIds.length === 0 ? (
                  <li className="py-1 text-[var(--muted-soft)]">—</li>
                ) : (
                  overlapIds.map((id) => {
                    const ml = mlById.get(id);
                    const hf = highfitById.get(id);
                    const hint = ml ? `${(ml.prob_8plus * 100).toFixed(0)}%` : undefined;
                    return (
                      <Row
                        key={id}
                        id={id}
                        title={(ml ?? hf)?.title ?? null}
                        hint={hint}
                      />
                    );
                  })
                )}
              </ul>
            </div>
            <div>
              <p className="mb-1.5 font-medium text-[var(--overview-muted)]">ML only ({mlOnlyIds.length})</p>
              <ul className="space-y-0">
                {mlOnlyIds.length === 0 ? (
                  <li className="py-1 text-[var(--muted-soft)]">—</li>
                ) : (
                  mlOnlyIds.map((id) => {
                    const ml = mlById.get(id);
                    const feat = ml?.top_features?.[0];
                    const hint = ml
                      ? feat
                        ? `${(ml.prob_8plus * 100).toFixed(0)}% · ${feat.replace(/^[^:]+:/, "")}`
                        : `${(ml.prob_8plus * 100).toFixed(0)}%`
                      : undefined;
                    return (
                      <Row
                        key={id}
                        id={id}
                        title={ml?.title ?? null}
                        hint={hint}
                      />
                    );
                  })
                )}
              </ul>
            </div>
            <div>
              <p className="mb-1.5 font-medium text-[var(--overview-muted)]">High-Fit only ({highfitOnlyIds.length})</p>
              <ul className="space-y-0">
                {highfitOnlyIds.length === 0 ? (
                  <li className="py-1 text-[var(--muted-soft)]">—</li>
                ) : (
                  highfitOnlyIds.map((id) => {
                    const hf = highfitById.get(id);
                    const reason = hf?.explanation?.top_reasons?.[0];
                    return (
                      <Row
                        key={id}
                        id={id}
                        title={hf?.title ?? null}
                        hint={reason}
                      />
                    );
                  })
                )}
              </ul>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
