"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Matches ``GenreMultiSelect`` / ``CountryMultiSelect`` trigger (Explore your favorites). */
export const RECO_FILTER_TRIGGER_CLASS =
  "min-w-[6rem] rounded-lg border border-[var(--card-border)] bg-[var(--control-surface)] px-3 py-2.5 pr-8 text-left text-[14px] text-[var(--foreground)] transition-colors focus:border-[var(--accent)]/45 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 disabled:cursor-default disabled:opacity-60 [color-scheme:inherit] sm:min-w-[7rem]";

/** ``w-max`` avoids fixed layers stretching to the viewport; pair with inline ``minWidth`` from the trigger. */
const DROPDOWN_LISTBOX_CLASS =
  "fixed z-[9999] max-h-48 w-max overflow-y-auto rounded-lg border border-[var(--card-border)] bg-[var(--control-surface)] py-1.5 shadow-lg";

export const RECO_DECADE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Decade" },
  ...(["1980s", "1990s", "2000s", "2010s", "2020s"] as const).map((d) => ({
    value: d,
    label: d,
  })),
];

export const RECO_EXPLORE_TITLE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All types" },
  { value: "movie", label: "Movie" },
  { value: "series", label: "Series" },
  { value: "episode", label: "Episode" },
];

export const RECO_WATCHLIST_TITLE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All types" },
  { value: "Movie", label: "Movie" },
  { value: "TV Series", label: "TV Series" },
  { value: "TV Mini Series", label: "TV Mini Series" },
];

export const RECO_POOL_TITLE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "movie", label: "Movies" },
  { value: "show", label: "Series" },
];

const EXPLORE_TITLE_TYPE_PLACEHOLDERS = new Set(["", "all", "all types"]);
const EXPLORE_DECADE_PLACEHOLDERS = new Set(["", "decade"]);

/** UI placeholder / unset — do not send as an API filter (Explore your favorites). */
export function normalizeExploreTitleType(value: string): string {
  const t = value.trim();
  return EXPLORE_TITLE_TYPE_PLACEHOLDERS.has(t.toLowerCase()) ? "" : t;
}

export function normalizeExploreDecade(value: string): string {
  const t = value.trim();
  return EXPLORE_DECADE_PLACEHOLDERS.has(t.toLowerCase()) ? "" : t;
}

export function exploreFiltersActive(filters: {
  genres: string[];
  countries: string[];
  titleType: string;
  decade: string;
}): boolean {
  return (
    filters.genres.some((g) => g.trim()) ||
    filters.countries.some((c) => c.trim()) ||
    !!normalizeExploreTitleType(filters.titleType) ||
    !!normalizeExploreDecade(filters.decade)
  );
}

/** Query params for ``/recommendations/simple`` and ``/simple-explanation``. */
export function exploreFiltersToSearchParams(filters: {
  genres: string[];
  countries: string[];
  titleType: string;
  decade: string;
}): URLSearchParams {
  const p = new URLSearchParams();
  for (const g of filters.genres) {
    const t = g.trim();
    if (t) p.append("genres", t);
  }
  for (const c of filters.countries) {
    const t = c.trim();
    if (t) p.append("countries", t);
  }
  const tt = normalizeExploreTitleType(filters.titleType);
  if (tt) p.set("title_type", tt);
  const dec = normalizeExploreDecade(filters.decade);
  if (dec) p.set("decade", dec);
  return p;
}

type RecoSingleSelectProps = {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  /** Values that use muted trigger text (e.g. empty or ``"all"``). */
  mutedValues?: string[];
  disabled?: boolean;
  ariaLabel: string;
  buttonClassName?: string;
  wrapClassName?: string;
};

export function RecoSingleSelect({
  id,
  value,
  onChange,
  options,
  mutedValues = [""],
  disabled = false,
  ariaLabel,
  buttonClassName = "",
  wrapClassName = "",
}: RecoSingleSelectProps) {
  const [open, setOpen] = useState(false);
  const [menuPlacement, setMenuPlacement] = useState({ top: 0, left: 0, minWidth: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPlacement({
        top: rect.bottom + 6,
        left: rect.left,
        minWidth: rect.width,
      });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!containerRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const opt = options.find((o) => o.value === value);
  const triggerLabel =
    opt?.label ?? (value.trim() ? value : options.find((o) => o.value === "")?.label ?? "—");
  const muted = mutedValues.includes(value);

  const btnClass = [RECO_FILTER_TRIGGER_CLASS, buttonClassName].filter(Boolean).join(" ");

  return (
    <div className={wrapClassName || "relative"} ref={containerRef}>
      <button
        id={id}
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={btnClass}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className={muted ? "text-[var(--muted-soft)]" : ""}>{triggerLabel}</span>
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={dropdownRef}
            role="listbox"
            className={DROPDOWN_LISTBOX_CLASS}
            style={{
              top: menuPlacement.top,
              left: menuPlacement.left,
              minWidth: menuPlacement.minWidth > 0 ? menuPlacement.minWidth : undefined,
            }}
          >
            {options.map((o) => (
              <button
                key={o.value === "" ? "__empty" : o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                className="block w-full min-w-0 px-3 py-1.5 text-left text-sm text-[var(--foreground)] hover:bg-[var(--muted-subtle)]/20"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {o.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
