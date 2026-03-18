"use client";

import { useEffect, useRef, useState } from "react";

const API_URL = "http://localhost:8000";

type GenreMultiSelectProps = {
  selected: string[];
  onChange: (genres: string[]) => void;
  disabled?: boolean;
  /** Override genres endpoint (e.g. for watchlist). Default: /recommendations/genres */
  genresUrl?: string;
};

export function GenreMultiSelect({
  selected,
  onChange,
  disabled = false,
  genresUrl = `${API_URL}/recommendations/genres`,
}: GenreMultiSelectProps) {
  const [genres, setGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(genresUrl)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        setGenres(Array.isArray(data) ? data : []);
      })
      .catch(() => setGenres([]))
      .finally(() => setLoading(false));
  }, [genresUrl]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const toggle = (g: string) => {
    if (selected.includes(g)) {
      onChange(selected.filter((s) => s !== g));
    } else {
      onChange([...selected, g]);
    }
  };

  const noGenres = !loading && genres.length === 0;
  const triggerLabel = noGenres
    ? "Genres appear after enrichment"
    : selected.length === 0
      ? "Genre"
      : selected.length <= 3
        ? selected.join(" · ")
        : `${selected.slice(0, 2).join(" · ")} · +${selected.length - 2}`;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => !noGenres && setOpen((o) => !o)}
        disabled={disabled || noGenres}
        className="min-w-[5rem] border-b border-[var(--muted-subtle)] bg-transparent py-2 pr-6 text-left text-sm text-[var(--foreground)] transition-colors duration-150 focus:border-[var(--muted-soft)] focus:outline-none disabled:cursor-default disabled:opacity-60 [color-scheme:inherit] sm:min-w-[6rem]"
        aria-label={noGenres ? "Genres unavailable" : "Select genres"}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span
          className={
            selected.length === 0 || noGenres ? "text-[var(--muted-subtle)]" : ""
          }
        >
          {triggerLabel}
        </span>
      </button>

      {open && !noGenres && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-10 mt-1.5 max-h-48 min-w-[10rem] overflow-y-auto rounded-md border border-[var(--section-border)] bg-[var(--background)] py-1.5 shadow-sm"
        >
          {loading ? (
            <p className="px-3 py-2 text-sm text-[var(--muted-soft)]">Loading…</p>
          ) : genres.length === 0 ? (
            <p className="px-3 py-2 text-sm text-[var(--muted-soft)]">
              Genres will appear as metadata is enriched
            </p>
          ) : (
            genres.map((g) => (
              <label
                key={g}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[var(--foreground)] hover:bg-[var(--muted-subtle)]/20"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(g)}
                  onChange={() => toggle(g)}
                  className="h-3.5 w-3.5 accent-[var(--foreground)]"
                />
                {g}
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
