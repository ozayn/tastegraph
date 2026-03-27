"use client";

import { useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export function HomeLibraryDetailsToggle({ children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3 sm:mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-md py-2 pl-1 pr-2 text-left text-[12px] font-medium text-[var(--muted-soft)] transition-colors hover:bg-[var(--card-hover)] hover:text-[var(--foreground)] sm:w-auto sm:text-[13px]"
      >
        <span
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[var(--section-border)] bg-[var(--background)] text-[10px] leading-none text-[var(--overview-muted)] transition-[transform,border-color] duration-200 ease-out"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
          aria-hidden
        >
          ▾
        </span>
        <span>{open ? "Hide library details" : "Show more about your library"}</span>
      </button>
      {open ? <div className="mt-5 border-t border-[var(--section-border)] pt-5 sm:mt-6 sm:pt-6">{children}</div> : null}
    </div>
  );
}
