"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { API_URL } from "../lib/api";

type CountryMultiSelectProps = {
  selected: string[];
  onChange: (countries: string[]) => void;
  disabled?: boolean;
  /** Override countries endpoint (e.g. for watchlist). Default: /recommendations/countries */
  countriesUrl?: string;
};

export function CountryMultiSelect({
  selected,
  onChange,
  disabled = false,
  countriesUrl = `${API_URL}/recommendations/countries`,
}: CountryMultiSelectProps) {
  const [countries, setCountries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(countriesUrl)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => (Array.isArray(data) ? data : []))
      .then(setCountries)
      .catch(() => setCountries([]))
      .finally(() => setLoading(false));
  }, [countriesUrl]);

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

  const toggle = (c: string) => {
    if (selected.includes(c)) {
      onChange(selected.filter((s) => s !== c));
    } else {
      onChange([...selected, c]);
    }
  };

  const noCountries = !loading && countries.length === 0;
  const triggerLabel = noCountries
    ? "Countries appear after enrichment"
    : selected.length === 0
      ? "Country"
      : selected.length <= 3
        ? selected.join(" · ")
        : `${selected.slice(0, 2).join(" · ")} · +${selected.length - 2}`;

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !noCountries && setOpen((o) => !o)}
        disabled={disabled || noCountries}
        className="min-w-[5rem] border-b border-[var(--muted-subtle)] bg-transparent pb-1.5 pt-0.5 pr-6 text-left text-[14px] text-[var(--foreground)] transition-colors duration-150 focus:border-[var(--muted-soft)] focus:outline-none disabled:cursor-default disabled:opacity-60 [color-scheme:inherit] sm:min-w-[6rem]"
        aria-label={noCountries ? "Countries unavailable" : "Select countries"}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span
          className={
            selected.length === 0 || noCountries ? "text-[var(--muted-subtle)]" : ""
          }
        >
          {triggerLabel}
        </span>
      </button>

      {open &&
        !noCountries &&
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
            ) : countries.length === 0 ? (
              <p className="px-3 py-2 text-sm text-[var(--muted-soft)]">
                Countries will appear as metadata is enriched
              </p>
            ) : (
              countries.map((c) => (
                <label
                  key={c}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[var(--foreground)] hover:bg-[var(--muted-subtle)]/20"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(c)}
                    onChange={() => toggle(c)}
                    className="h-3.5 w-3.5 accent-[var(--foreground)]"
                  />
                  {c}
                </label>
              ))
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
