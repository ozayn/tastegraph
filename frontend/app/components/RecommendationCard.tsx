type RecommendationCardProps = {
  imdb_title_id: string;
  title: string | null;
  year?: number | null;
  title_type?: string | null;
  genres?: string | null;
  user_rating?: number | null;
  your_rating?: number | null;
};

export function RecommendationCard({
  imdb_title_id,
  title,
  year,
  title_type,
  genres,
  user_rating,
  your_rating,
}: RecommendationCardProps) {
  const rating = user_rating ?? your_rating;
  const displayTitle = title ?? imdb_title_id;

  return (
    <a
      href={`https://www.imdb.com/title/${imdb_title_id}/`}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-5 py-4 transition-all duration-150 hover:border-[var(--muted-subtle)] hover:bg-[var(--card-hover)] hover:shadow-sm sm:px-6 sm:py-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] font-semibold leading-[1.35] text-[var(--foreground)] sm:text-[17px]">
            {displayTitle}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
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
        </div>
        {rating != null && (
          <span className="shrink-0 rounded-lg bg-[var(--accent-muted)] px-2.5 py-1 text-[13px] font-semibold tabular-nums text-[var(--accent)]">
            {rating}
          </span>
        )}
      </div>
    </a>
  );
}
