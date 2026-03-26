import type { ReactNode } from "react";

type RowItem = {
  imdb_title_id: string;
  title: string | null;
};

type Props<T extends RowItem> = {
  items: T[];
  afterTitle?: (item: T) => ReactNode;
  trailing?: (item: T) => ReactNode;
};

const linkClass =
  "min-w-0 truncate font-medium text-[var(--foreground)] no-underline decoration-transparent " +
  "transition-colors hover:text-[var(--foreground)] hover:opacity-90 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

export function OverviewTitleRows<T extends RowItem>({
  items,
  afterTitle,
  trailing,
}: Props<T>) {
  return (
    <ul className="mt-2.5 space-y-1.5">
      {items.map((item) => (
        <li
          key={item.imdb_title_id}
          className="flex items-baseline justify-between gap-3 text-[13px] leading-snug"
        >
          <span className="min-w-0 flex flex-1 flex-wrap items-baseline gap-x-1.5">
            {item.imdb_title_id ? (
              <a
                href={`https://www.imdb.com/title/${item.imdb_title_id}/`}
                target="_blank"
                rel="noreferrer noopener"
                className={linkClass}
              >
                {item.title ?? item.imdb_title_id}
              </a>
            ) : (
              <span className="min-w-0 truncate text-[var(--muted-soft)]">
                {item.title ?? "—"}
              </span>
            )}
            {afterTitle?.(item)}
          </span>
          {trailing?.(item)}
        </li>
      ))}
    </ul>
  );
}
