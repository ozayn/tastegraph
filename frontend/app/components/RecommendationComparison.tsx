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
  if (reason.length > 45) return `${reason.slice(0, 42)}…`;
  return reason;
}

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
    <li className="block py-2 text-[13px]">
      <a
        href={`https://www.imdb.com/title/${id}/`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-[var(--foreground)] underline decoration-[var(--muted-subtle)] underline-offset-2 hover:text-[var(--accent)]"
      >
        {display}
      </a>
      {hint && (
        <p className="mt-0.5 text-[12px] leading-snug text-[var(--muted-soft)]">
          {hint}
        </p>
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
          Compare ML vs High-Fit (top 15 from each)
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
                    const hint = ml ? formatProb(ml.prob_8plus) : undefined;
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
                    const feats = (ml?.top_features ?? []).slice(0, 2).map((f) => f.replace(/^[^:]+:/, ""));
                    const hint = ml
                      ? feats.length > 0
                        ? `${formatProb(ml.prob_8plus)} · ${feats.join(", ")}`
                        : formatProb(ml.prob_8plus)
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
                        hint={reason ? shortenReason(reason) : undefined}
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
