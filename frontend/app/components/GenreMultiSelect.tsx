"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { API_URL } from "../lib/api";

type GenreMultiSelectProps = {
  selected: string[];
  onChange: (genres: string[]) => void;
  disabled?: boolean;
  /** Override genres endpoint (e.g. for watchlist). Default: /recommendations/genres */
  genresUrl?: string;
  /**
   * Temporary fallback when primary returns empty (e.g. watchlist → ratings genres).
   * Remove once watchlist metadata enrichment is common.
   */
  fallbackGenresUrl?: string;
};

const FALLBACK_GENRES = [
  "Action",
  "Comedy",
  "Drama",
  "Horror",
  "Romance",
  "Sci-Fi",
  "Thriller",
];

export function GenreMultiSelect({
  selected,
  onChange,
  disabled = false,
  genresUrl = `${API_URL}/recommendations/genres`,
  fallbackGenresUrl,
}: GenreMultiSelectProps) {
  const [genres, setGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(genresUrl)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        if (list.length === 0 && fallbackGenresUrl) {
          return fetch(fallbackGenresUrl)
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((fallback) => (Array.isArray(fallback) && fallback.length > 0 ? fallback : FALLBACK_GENRES))
            .catch(() => FALLBACK_GENRES);
        }
        return list;
      })
      .then((list) => (list.length > 0 ? list : FALLBACK_GENRES))
      .then(setGenres)
      .catch(() => setGenres(FALLBACK_GENRES))
      .finally(() => setLoading(false));
  }, [genresUrl, fallbackGenresUrl]);

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + 6, left: rect.left });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const inContainer = containerRef.current?.contains(target);
      const inDropdown = dropdownRef.current?.contains(target);
      if (!inContainer && !inDropdown) setOpen(false);
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
        ref={buttonRef}
        type="button"
        onClick={() => !noGenres && setOpen((o) => !o)}
        disabled={disabled || noGenres}
        className="min-w-[5rem] border-b border-[var(--muted-subtle)] bg-transparent pb-1.5 pt-0.5 pr-6 text-left text-[14px] text-[var(--foreground)] transition-colors duration-150 focus:border-[var(--muted-soft)] focus:outline-none disabled:cursor-default disabled:opacity-60 [color-scheme:inherit] sm:min-w-[6rem]"
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

      {open &&
        !noGenres &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={dropdownRef}
            role="listbox"
            className="fixed z-[9999] max-h-48 min-w-[10rem] overflow-y-auto rounded-md border border-[var(--section-border)] bg-[var(--background)] py-1.5 shadow-lg"
            style={{ top: position.top, left: position.left }}
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
          </div>,
          document.body
        )}
    </div>
  );
}
