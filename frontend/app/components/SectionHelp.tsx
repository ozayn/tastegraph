"use client";

import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Lightweight info icon with popover for "What this means" / "How to read this" explanations.
 * Keeps the UI minimal while offering interpretive help on demand.
 */
export function SectionHelp({
  title = "How to read this",
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const pos =
    open && buttonRef.current
      ? (() => {
          const rect = buttonRef.current!.getBoundingClientRect();
          return {
            top: rect.bottom + 6,
            left: Math.min(rect.left, window.innerWidth - 288 - 16),
          };
        })()
      : null;

  const popover = open && typeof document !== "undefined" && pos && (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={title}
      className="fixed z-50 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-[var(--section-border)] bg-[var(--card-bg)] px-3.5 py-3 text-left shadow-lg"
      style={{ top: pos.top, left: pos.left }}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--overview-muted)]">
        {title}
      </p>
      <div className="mt-2 text-[13px] leading-[1.55] text-[var(--muted-soft)] [&>p+p]:mt-2">
        {children}
      </div>
    </div>
  );

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={title}
        className="ml-1.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[var(--muted-subtle)] transition-colors hover:bg-[var(--section-bg)] hover:text-[var(--muted-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:ring-offset-2 focus:ring-offset-[var(--background)]"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-3.5 w-3.5"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {typeof document !== "undefined" && popover
        ? createPortal(popover, document.body)
        : null}
    </span>
  );
}
