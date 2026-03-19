"use client";

/**
 * TasteGraph pipeline flowchart — product-quality diagram for Learn page.
 * Built with React/CSS/Tailwind. Light/dark compatible, responsive.
 */

function FlowNode({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "heuristic" | "ml";
}) {
  const variantStyles = {
    default:
      "border-[var(--section-border)] bg-[var(--card-bg)] text-[var(--muted-soft)]",
    heuristic:
      "border-[var(--section-border)] bg-[var(--card-bg)] text-[var(--foreground)] ring-1 ring-[var(--section-border)]",
    ml: "border-[var(--accent)]/30 bg-[var(--accent-muted)]/50 text-[var(--foreground)]",
  };
  return (
    <span
      className={`inline-flex items-center rounded-xl border px-3 py-1.5 text-[12px] font-medium sm:text-[13px] ${variantStyles[variant]}`}
    >
      {children}
    </span>
  );
}

function FlowConnector() {
  return (
    <div className="flex flex-col items-center py-1" aria-hidden>
      <div className="h-4 w-px bg-[var(--section-border)]" />
      <svg
        width="8"
        height="6"
        viewBox="0 0 8 6"
        fill="none"
        className="text-[var(--section-border)]"
      >
        <path
          d="M4 6L0 0h8L4 6z"
          fill="currentColor"
          fillOpacity="0.6"
        />
      </svg>
    </div>
  );
}

export function TasteGraphFlowchart() {
  return (
    <div className="flowchart flex flex-col rounded-xl bg-[var(--card-bg)]/40 px-4 py-5 sm:px-6 sm:py-6">
      {/* 1. Inputs */}
      <div className="flex flex-col items-center">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--overview-muted)]">
          Inputs
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {[
            "Ratings",
            "Watchlist",
            "Favorite people",
            "Favorite list",
            "Title metadata",
          ].map((label) => (
            <FlowNode key={label}>{label}</FlowNode>
          ))}
        </div>
      </div>

      <FlowConnector />

      {/* 2. Feature / signal layer */}
      <div className="flex flex-col items-center">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--overview-muted)]">
          Features & signals
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {[
            "Genres",
            "Countries",
            "Decades",
            "Title type",
            "Favorite matches",
            "Strong directors",
            "Support-thresholded",
          ].map((label) => (
            <FlowNode key={label}>{label}</FlowNode>
          ))}
        </div>
      </div>

      <FlowConnector />

      {/* 3. Recommendation paths */}
      <div className="flex flex-col items-center">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--overview-muted)]">
          Recommendation paths
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <FlowNode variant="heuristic">Explore favorites</FlowNode>
          <FlowNode variant="heuristic">Watchlist browse</FlowNode>
          <FlowNode variant="heuristic">High-Fit (rule-based)</FlowNode>
          <FlowNode variant="ml">ML (8+ likelihood)</FlowNode>
        </div>
      </div>

      <FlowConnector />

      {/* 4. Comparison / interpretation */}
      <div className="flex flex-col items-center">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--overview-muted)]">
          Compare & interpret
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {[
            "Compare ML vs High-Fit",
            "Coefficients",
            "Explanations",
            "Studies / lift / thresholds",
          ].map((label) => (
            <FlowNode key={label}>{label}</FlowNode>
          ))}
        </div>
      </div>

      <FlowConnector />

      {/* 5. Outputs */}
      <div className="flex flex-col items-center">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--overview-muted)]">
          Outputs
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {[
            "Homepage recommendations",
            "Insights",
            "Studies",
            "Model Lab",
          ].map((label) => (
            <FlowNode key={label}>{label}</FlowNode>
          ))}
        </div>
      </div>
    </div>
  );
}
