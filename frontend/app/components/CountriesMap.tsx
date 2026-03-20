"use client";

import { useEffect, useRef, useState } from "react";

const WORLD_MAP_URL = "/world-map.svg";

/** Country name (API) -> ISO 2-letter code for map paths. Covers common film-production countries. */
const COUNTRY_TO_ISO: Record<string, string> = {
  "United States": "us",
  "United Kingdom": "gb",
  UK: "gb",
  France: "fr",
  Japan: "jp",
  "South Korea": "kr",
  Germany: "de",
  Italy: "it",
  Spain: "es",
  India: "in",
  China: "cn",
  Brazil: "br",
  Mexico: "mx",
  Argentina: "ar",
  Canada: "ca",
  Australia: "au",
  Russia: "ru",
  "Czech Republic": "cz",
  Czech: "cz",
  Poland: "pl",
  Sweden: "se",
  Denmark: "dk",
  Norway: "no",
  Finland: "fi",
  Netherlands: "nl",
  Belgium: "be",
  Austria: "at",
  Switzerland: "ch",
  Ireland: "ie",
  Portugal: "pt",
  Greece: "gr",
  Turkey: "tr",
  Israel: "il",
  Iran: "ir",
  Thailand: "th",
  Vietnam: "vn",
  Indonesia: "id",
  Philippines: "ph",
  Malaysia: "my",
  Singapore: "sg",
  "New Zealand": "nz",
  "South Africa": "za",
  Egypt: "eg",
  Nigeria: "ng",
  Colombia: "co",
  Chile: "cl",
  Peru: "pe",
  Hungary: "hu",
  Romania: "ro",
  Bulgaria: "bg",
  Croatia: "hr",
  Serbia: "rs",
  "North Macedonia": "mk",
  Macedonia: "mk",
  Slovenia: "si",
  Slovakia: "sk",
  Ukraine: "ua",
  Georgia: "ge",
  Armenia: "am",
  Azerbaijan: "az",
  Kazakhstan: "kz",
  Taiwan: "tw",
  Pakistan: "pk",
  Bangladesh: "bd",
  Morocco: "ma",
  Tunisia: "tn",
  Algeria: "dz",
  Cuba: "cu",
  "Puerto Rico": "pr",
  Iceland: "is",
  Luxembourg: "lu",
  Bosnia: "ba",
  "Bosnia and Herzegovina": "ba",
  "Bosnia and Herzegowina": "ba",
};

type CountriesMapProps = {
  items: { country: string; count: number }[];
};

/** Map of countries with rated titles. Shading and tooltip show country + count. */
export function CountriesMap({ items }: CountriesMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<{ country: string; count: number } | null>(null);
  const [svgLoaded, setSvgLoaded] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    fetch(WORLD_MAP_URL)
      .then((r) => r.text())
      .then((svgText) => {
        if (cancelled) return;
        container.innerHTML = svgText;
        setSvgLoaded(true);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !svgLoaded || !items.length) return;

    const svg = container.querySelector("svg");
    if (!svg) return;

    const title = svg.querySelector("title");
    if (title) title.remove();

    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.style.width = "100%";
    svg.style.height = "100%";

    const byIso = new Map<string, { country: string; count: number }>();
    for (const item of items) {
      const iso = COUNTRY_TO_ISO[item.country];
      if (iso) byIso.set(iso.toLowerCase(), item);
    }

    const sortedCounts = [...new Set([...byIso.values()].map((d) => d.count))].sort((a, b) => a - b);
    const countToRank = new Map<number, number>();
    sortedCounts.forEach((c, i) => {
      countToRank.set(c, sortedCounts.length > 1 ? i / (sortedCounts.length - 1) : 1);
    });

    const OPACITY_HOVER_BOOST = 0.08;

    const styleCountry = (node: Element) => {
      const id = node.getAttribute("id");
      if (!id) return;
      const iso = id.toLowerCase();
      if (id.startsWith("_")) {
        node.setAttribute("fill", "var(--section-border)");
        node.setAttribute("fill-opacity", "0.2");
        return;
      }
      const data = byIso.get(iso);
      if (!data) {
        node.setAttribute("fill", "var(--section-border)");
        node.setAttribute("fill-opacity", "0.2");
        return;
      }

      const rank = countToRank.get(data.count) ?? 0;
      const hue = 50 - rank * 25;
      const sat = 85;
      const light = 75 - rank * 35;
      const fillColor = `hsl(${hue}, ${sat}%, ${light}%)`;
      node.setAttribute("fill", fillColor);
      node.setAttribute("fill-opacity", "1");
      (node as HTMLElement).style.cursor = "pointer";
      (node as HTMLElement).style.transition = "fill 0.15s";

      node.addEventListener("mouseenter", () => {
        node.setAttribute("fill", `hsl(${Math.max(hue - 5, 20)}, ${sat}%, ${Math.max(light - 10, 35)}%)`);
        setHovered(data);
      });
      node.addEventListener("mouseleave", () => {
        node.setAttribute("fill", fillColor);
        setHovered(null);
      });
    };

    const paths = svg.querySelectorAll("path[id], g[id]");
    paths.forEach(styleCountry);

    return () => {
      Array.from(paths).forEach((node) => {
        node.replaceWith(node.cloneNode(true));
      });
    };
  }, [items, svgLoaded]);

  const byIso = new Map<string, { country: string; count: number }>();
  for (const item of items) {
    const iso = COUNTRY_TO_ISO[item.country];
    if (iso) byIso.set(iso.toLowerCase(), item);
  }
  const hasMappable = byIso.size > 0;

  if (!hasMappable) return null;

  return (
    <div className="relative space-y-1.5">
      <div
        ref={containerRef}
        className="aspect-[784/459] w-full overflow-hidden rounded-md border border-[var(--section-border)] [&_svg]:h-full [&_svg]:w-full [&_svg]:object-contain"
        aria-hidden
      />
      <div className="flex items-center gap-2 text-[10px] text-[var(--muted-soft)]">
        <span>Few</span>
        <div
          className="h-1.5 flex-1 max-w-[80px] rounded-sm border border-[var(--section-border)]"
          style={{
            background: `linear-gradient(to right, hsl(50, 85%, 75%), hsl(25, 85%, 40%))`,
          }}
          aria-hidden
        />
        <span>Many</span>
      </div>
      {hovered && (
        <div
          className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 rounded-md border border-[var(--section-border)] bg-[var(--card-bg)] px-2.5 py-1.5 text-[11px] shadow-sm"
        >
          <div className="font-medium text-[var(--foreground)]">{hovered.country}</div>
          <div className="mt-0.5 tabular-nums text-[var(--muted-soft)]">
            {hovered.count} titles
          </div>
        </div>
      )}
    </div>
  );
}
