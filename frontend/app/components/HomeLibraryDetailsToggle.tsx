"use client";

import { useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export function HomeLibraryDetailsToggle({ children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-6 border-t border-[var(--section-border)] pt-5 sm:mt-7 sm:pt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left text-[13px] font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)] sm:text-[14px]"
      >
        <span
          className="inline-block text-[10px] leading-none text-[var(--overview-muted)] transition-transform duration-200 ease-out"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
          aria-hidden
        >
          ▾
        </span>
        {open ? "Hide library details" : "Show more about your library"}
      </button>
      {open ? <div className="mt-6 sm:mt-7">{children}</div> : null}
    </div>
  );
}
