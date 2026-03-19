"use client";

import { useEffect, useState } from "react";

type HighFitExplanation = {
  matched_genres: string[];
  matched_countries: string[];
  matched_decade: string | null;
  matched_people: { name: string; role: string }[];
  top_reasons: string[];
};

type HighFitCardProps = {
  imdb_title_id: string;
  title: string | null;
  title_type: string | null;
  year: number | null;
  poster: string | null;
  explanation: HighFitExplanation;
};

const chipBase =
  "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium";

function SignalChips({ explanation }: { explanation: HighFitExplanation }) {
  const hasAny =
    explanation.matched_genres.length > 0 ||
    explanation.matched_countries.length > 0 ||
    explanation.matched_decade ||
    explanation.matched_people.length > 0;

  if (!hasAny) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {explanation.matched_genres.map((g) => (
        <span
          key={g}
          className={`${chipBase} bg-[var(--accent-muted)]/30 text-[var(--accent)]`}
        >
          {g}
        </span>
      ))}
      {explanation.matched_countries.map((c) => (
        <span
          key={c}
          className={`${chipBase} bg-[var(--muted-subtle)]/25 text-[var(--muted-soft)]`}
        >
          {c}
        </span>
      ))}
      {explanation.matched_decade && (
        <span
          className={`${chipBase} bg-[var(--muted-subtle)]/25 text-[var(--muted-soft)]`}
        >
          {explanation.matched_decade}
        </span>
      )}
      {explanation.matched_people.map((p) => {
        const roleAbbr = { director: "dir", actor: "act", writer: "wri" }[p.role] ?? p.role;
        return (
          <span
            key={`${p.role}-${p.name}`}
            className={`${chipBase} bg-[var(--muted-subtle)]/20 text-[var(--muted-soft)]`}
          >
            {p.name} ({roleAbbr})
          </span>
        );
      })}
    </div>
  );
}

export function HighFitCard({
  imdb_title_id,
  title,
  title_type,
  year,
  poster,
  explanation,
}: HighFitCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const displayTitle = title ?? imdb_title_id;
  const hasUsablePoster = poster && poster.trim() && poster !== "N/A";
  const showPoster = hasUsablePoster && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [poster]);

  return (
    <a
      href={`https://www.imdb.com/title/${imdb_title_id}/`}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] overflow-hidden transition-all duration-150 hover:border-[var(--muted-subtle)] hover:bg-[var(--card-hover)] hover:shadow-sm"
    >
      <div className="flex gap-4 px-5 py-4 sm:px-6 sm:py-5">
        {showPoster && (
          <div className="shrink-0 w-14 h-20 sm:w-16 sm:h-24 rounded-lg overflow-hidden bg-[var(--section-bg)] border border-[var(--section-border)]">
            <img
              src={poster!}
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
            {year != null && (
              <span className="rounded-md bg-[var(--muted-subtle)]/20 px-2 py-0.5 text-[12px] font-medium text-[var(--muted-soft)]">
                {year}
              </span>
            )}
            {title_type && (
              <span className="rounded-md bg-[var(--muted-subtle)]/20 px-2 py-0.5 text-[12px] text-[var(--muted-soft)]">
                {title_type}
              </span>
            )}
          </div>
          <SignalChips explanation={explanation} />
        </div>
      </div>
    </a>
  );
}
