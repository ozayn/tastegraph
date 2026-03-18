"use client";

import { useEffect, useRef, useState } from "react";

const API_URL = "http://localhost:8000";

type GenreMultiSelectProps = {
  selected: string[];
  onChange: (genres: string[]) => void;
  disabled?: boolean;
};

export function GenreMultiSelect({
  selected,
  onChange,
  disabled = false,
}: GenreMultiSelectProps) {
  const [genres, setGenres] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_URL}/recommendations/genres`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setGenres)
      .catch(() => setGenres([]));
  }, []);

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

  const triggerLabel =
    selected.length === 0
      ? "Genre"
      : selected.length <= 3
        ? selected.join(" · ")
        : `${selected.slice(0, 2).join(" · ")} · +${selected.length - 2}`;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="min-w-[5rem] border-b border-[var(--muted-subtle)] bg-transparent py-2 pr-6 text-left text-sm text-[var(--foreground)] transition-colors focus:border-[var(--muted-soft)] focus:outline-none disabled:opacity-50 [color-scheme:inherit] sm:min-w-[6rem]"
        aria-label="Select genres"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className={selected.length === 0 ? "text-[var(--muted-subtle)]" : ""}>
          {triggerLabel}
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-10 mt-1 max-h-48 min-w-[10rem] overflow-y-auto border border-[var(--muted-subtle)] bg-[var(--background)] py-1.5 shadow-sm"
        >
          {genres.length === 0 ? (
            <p className="px-3 py-2 text-sm text-[var(--muted-soft)]">Loading…</p>
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
