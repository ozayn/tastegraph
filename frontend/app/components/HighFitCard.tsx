"use client";

import { useEffect, useState } from "react";

type HighFitExplanation = {
  in_favorite_list?: boolean;
  matched_genres: string[];
  matched_countries: string[];
  matched_decade: string | null;
  matched_people: { name: string; role: string }[];
  matched_strong_directors?: string[];
  plot_matched?: string[];
  similar_to_matched?: string[];
  top_reasons: string[];
};

type HighFitCardProps = {
  imdb_title_id: string;
  title: string | null;
  title_type: string | null;
  year: number | null;
  poster: string | null;
  explanation: HighFitExplanation;
  user_rating?: number | null;
  date_rated?: string | null;
  provider?: string | null;
};

const chipBase =
  "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide";

function condensedSignals(explanation: HighFitExplanation): string | null {
  const bits: string[] = [];
  if (explanation.in_favorite_list) bits.push("Curated list");
  explanation.matched_genres.slice(0, 2).forEach((g) => bits.push(g));
  if (explanation.matched_decade) bits.push(explanation.matched_decade);
  explanation.matched_countries.slice(0, 1).forEach((c) => bits.push(c));
  explanation.matched_strong_directors?.slice(0, 1).forEach((d) => bits.push(d));
  explanation.matched_people.slice(0, 1).forEach((p) => bits.push(p.name));
  explanation.plot_matched?.slice(0, 1).forEach((m) => bits.push(m));
  explanation.similar_to_matched?.slice(0, 1).forEach((s) => bits.push(s));
  return bits.length ? bits.slice(0, 5).join(" · ") : null;
}

export function HighFitCard({
  imdb_title_id,
  title,
  title_type,
  year,
  poster,
  explanation,
  user_rating,
  provider,
}: HighFitCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const displayTitle = title ?? imdb_title_id;
  const hasUsablePoster = poster && poster.trim() && poster !== "N/A";
  const showPoster = hasUsablePoster && !imageFailed;
  const reasonsText =
    explanation.top_reasons?.length > 0
      ? explanation.top_reasons.slice(0, 2).join(" · ")
      : null;
  const signalsLine = condensedSignals(explanation);

  useEffect(() => {
    setImageFailed(false);
  }, [poster]);

  const metaParts: string[] = [];
  if (year != null) metaParts.push(String(year));
  if (title_type?.trim()) metaParts.push(title_type.trim());
  const meta = metaParts.length ? metaParts.join(" · ") : null;

  return (
    <a
      href={`https://www.imdb.com/title/${imdb_title_id}/`}
      target="_blank"
      rel="noopener noreferrer"
      className="group block overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--background)] transition-[border-color,box-shadow] duration-200 hover:border-[var(--muted-subtle)] hover:shadow-md"
    >
      <div className="flex gap-4 px-4 py-4 sm:gap-5 sm:px-5 sm:py-5">
        {showPoster && (
          <div className="h-[5.5rem] w-[3.75rem] shrink-0 overflow-hidden rounded-md bg-[var(--section-bg)] ring-1 ring-[var(--section-border)] sm:h-[6.75rem] sm:w-[4.5rem]">
            <img
              src={poster!}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setImageFailed(true)}
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3 gap-y-2">
            <h3 className="break-words text-[17px] font-semibold leading-snug tracking-[-0.015em] text-[var(--foreground)] sm:text-[18px]">
              {displayTitle}
            </h3>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              {provider && (
                <span
                  className={`${chipBase} bg-[var(--mondrian-red)]/12 text-[var(--mondrian-red)]`}
                >
                  {provider}
                </span>
              )}
              {user_rating != null && (
                <span
                  className={`${chipBase} bg-[var(--accent-muted)] text-[var(--accent)] ring-1 ring-[var(--accent)]/15`}
                >
                  {user_rating}
                </span>
              )}
            </div>
          </div>
          {meta && (
            <p className="mt-1.5 text-[13px] leading-snug text-[var(--muted)]">{meta}</p>
          )}
          {reasonsText && (
            <p className="mt-2 text-[13px] font-medium leading-relaxed text-[var(--foreground)]">
              {reasonsText}
            </p>
          )}
          {signalsLine && (
            <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--muted-soft)]">
              {signalsLine}
            </p>
          )}
        </div>
      </div>
    </a>
  );
}
