"use client";

type ExpandableRecoListFooterProps = {
  expanded: boolean;
  onToggle: () => void;
  initialVisible: number;
  total: number;
};

/** Calm inline expand/collapse for long recommendation lists (page scroll only). */
export function ExpandableRecoListFooter({
  expanded,
  onToggle,
  initialVisible,
  total,
}: ExpandableRecoListFooterProps) {
  if (total <= initialVisible) return null;
  const hidden = total - initialVisible;
  return (
    <div className="mt-3 flex justify-center sm:mt-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="rounded-md px-2 py-1 text-[12px] font-medium text-[var(--muted-soft)] transition-colors hover:bg-[var(--section-bg)] hover:text-[var(--foreground)]"
      >
        {expanded ? "Show less" : `Show more (${hidden})`}
      </button>
    </div>
  );
}
