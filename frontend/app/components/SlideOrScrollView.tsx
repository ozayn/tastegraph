"use client";

import { Children, useCallback, useEffect, useRef } from "react";

export type ViewMode = "scroll" | "slide";

export function ViewModeToggle({
  mode,
  onModeChange,
  className,
}: {
  mode: ViewMode;
  onModeChange: (m: ViewMode) => void;
  className?: string;
}) {
  return (
    <div
      className={`flex rounded-lg border border-[var(--section-border)] bg-[var(--section-bg)] p-0.5${className ? ` ${className}` : ""}`}
      role="group"
      aria-label="View mode"
    >
      <button
        type="button"
        onClick={() => onModeChange("scroll")}
        className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
          mode === "scroll"
            ? "bg-[var(--accent)] text-white"
            : "text-[var(--muted-soft)] hover:text-[var(--foreground)]"
        }`}
      >
        Scroll
      </button>
      <button
        type="button"
        onClick={() => onModeChange("slide")}
        className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
          mode === "slide"
            ? "bg-[var(--accent)] text-white"
            : "text-[var(--muted-soft)] hover:text-[var(--foreground)]"
        }`}
      >
        Slide
      </button>
    </div>
  );
}

export function SlideOrScrollContainer({
  mode,
  slideIndex,
  onSlideChange,
  children,
  ariaLabel,
  scrollClassName = "space-y-16 sm:space-y-20 md:space-y-24",
}: {
  mode: ViewMode;
  slideIndex: number;
  onSlideChange: (i: number) => void;
  children: React.ReactNode;
  ariaLabel: string;
  scrollClassName?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const slides = Children.toArray(children).filter(Boolean);
  const count = slides.length;

  const goTo = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(i, count - 1));
      onSlideChange(next);
      containerRef.current?.children[next]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    },
    [count, onSlideChange]
  );

  useEffect(() => {
    if (mode !== "slide") return;
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const idx = Math.round(el.scrollLeft / el.clientWidth);
      if (idx >= 0 && idx < count) onSlideChange(idx);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [mode, count, onSlideChange]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (mode !== "slide") return;
      if (e.key === "ArrowLeft") goTo(slideIndex - 1);
      if (e.key === "ArrowRight") goTo(slideIndex + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, slideIndex, goTo]);

  if (mode === "scroll") {
    return <div className={scrollClassName}>{children}</div>;
  }

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="flex h-[calc(100vh-12rem)] min-h-[420px] overflow-x-auto snap-x snap-mandatory overscroll-x-contain scroll-smooth"
        style={{ scrollSnapType: "x mandatory" }}
        role="region"
        aria-label={ariaLabel}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            className="flex min-w-full flex-shrink-0 snap-center justify-center overflow-y-auto px-2 sm:px-4"
            style={{ scrollSnapAlign: "center" }}
          >
            <div className="w-full max-w-2xl py-2">{slide}</div>
          </div>
        ))}
      </div>
      {count > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => goTo(slideIndex - 1)}
            disabled={slideIndex <= 0}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--section-border)] bg-[var(--section-bg)] text-[var(--foreground)] transition-colors hover:bg-[var(--card-hover)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--section-bg)]"
            aria-label="Previous slide"
          >
            ←
          </button>
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Slide navigation">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === slideIndex}
                onClick={() => goTo(i)}
                className={`h-2 rounded-full transition-all ${
                  i === slideIndex
                    ? "w-6 bg-[var(--accent)]"
                    : "w-2 bg-[var(--muted-subtle)]/50 hover:bg-[var(--muted-subtle)]"
                }`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => goTo(slideIndex + 1)}
            disabled={slideIndex >= count - 1}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--section-border)] bg-[var(--section-bg)] text-[var(--foreground)] transition-colors hover:bg-[var(--card-hover)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--section-bg)]"
            aria-label="Next slide"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
