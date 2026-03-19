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
        <div className="min-w-0 flex-1 flex items-start justify-between gap-4">
          <div>
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
              {genres &&
                genres
                  .split(",")
                  .slice(0, 3)
                  .map((g) => (
                    <span
                      key={g}
                      className="rounded-md bg-[var(--muted-subtle)]/20 px-2 py-0.5 text-[12px] text-[var(--muted-soft)]"
                    >
                      {g.trim()}
                    </span>
                  ))}
            </div>
            {reasons && reasons.length > 0 && (
              <p className="mt-1.5 text-[12px] leading-[1.4] text-[var(--muted-soft)]">
                {reasons.slice(0, 3).join(" · ")}
              </p>
            )}
          </div>
          {rating != null && (
            <span className="shrink-0 rounded-lg bg-[var(--accent-muted)] px-2.5 py-1 text-[13px] font-semibold tabular-nums text-[var(--accent)]">
              {rating}
            </span>
          )}
        </div>
      </div>
    </a>
  );
}
