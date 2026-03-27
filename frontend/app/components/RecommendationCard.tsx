"use client";

import { useEffect, useState } from "react";

type RecommendationCardProps = {
  imdb_title_id: string;
  title: string | null;
  year?: number | null;
  title_type?: string | null;
  genres?: string | null;
  user_rating?: number | null;
  your_rating?: number | null;
  poster?: string | null;
  reasons?: string[];
};

function metaLine(
  year: number | null | undefined,
  title_type: string | null | undefined,
  genres: string | null | undefined,
): string | null {
  const parts: string[] = [];
  if (year != null) parts.push(String(year));
  if (title_type?.trim()) parts.push(title_type.trim());
  if (genres?.trim()) {
    const g = genres
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3);
    if (g.length) parts.push(g.join(", "));
  }
  return parts.length ? parts.join(" · ") : null;
}

export function RecommendationCard({
  imdb_title_id,
  title,
  year,
  title_type,
  genres,
  user_rating,
  your_rating,
  poster,
  reasons,
}: RecommendationCardProps) {
  const rating = user_rating ?? your_rating;
  const displayTitle = title ?? imdb_title_id;
  const [imageFailed, setImageFailed] = useState(false);
  const hasUsablePoster = poster && poster.trim() && poster !== "N/A";

  useEffect(() => {
    setImageFailed(false);
  }, [poster]);

  const showPoster = hasUsablePoster && !imageFailed;
  const meta = metaLine(year, title_type, genres);

  return (
    <a
      href={`https://www.imdb.com/title/${imdb_title_id}/`}
      target="_blank"
      rel="noopener noreferrer"
      className="group block overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--control-surface)] transition-[border-color,box-shadow] duration-200 hover:border-[var(--muted-soft)] hover:shadow-sm"
    >
      <div className="flex gap-3 px-3 py-3.5 sm:gap-5 sm:px-5 sm:py-5">
        {showPoster && (
          <div className="h-[5rem] w-[3.4rem] shrink-0 overflow-hidden rounded-md bg-[var(--control-track-bg)] ring-1 ring-[var(--card-border)] sm:h-[6.75rem] sm:w-[4.5rem]">
            <img
              src={poster!}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setImageFailed(true)}
            />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
          <div className="min-w-0 flex-1">
            <h3 className="break-words text-[17px] font-semibold leading-snug tracking-[-0.015em] text-[var(--foreground)] sm:text-[18px]">
              {displayTitle}
            </h3>
            {meta && (
              <p className="mt-1.5 text-[13px] leading-snug text-[var(--muted)]">{meta}</p>
            )}
            {reasons && reasons.length > 0 && (
              reasons.length === 2 ? (
                <div className="mt-2 space-y-1.5">
                  <p className="text-[13px] leading-snug text-[var(--foreground)]">{reasons[0]}</p>
                  <p className="text-[12px] leading-relaxed text-[var(--muted-soft)]">{reasons[1]}</p>
                </div>
              ) : (
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted-soft)]">
                  {reasons.slice(0, 3).join(" · ")}
                </p>
              )
            )}
          </div>
          {rating != null && (
            <span className="w-fit shrink-0 self-start rounded-md bg-[var(--accent-muted)] px-3 py-1.5 text-[15px] font-semibold tabular-nums tracking-tight text-[var(--accent)] ring-1 ring-[var(--accent)]/15 sm:py-2">
              {rating}
            </span>
          )}
        </div>
      </div>
    </a>
  );
}
