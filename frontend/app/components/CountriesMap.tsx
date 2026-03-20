"use client";

import { useEffect, useRef, useState } from "react";

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
  const objectRef = useRef<HTMLObjectElement>(null);
  const [hovered, setHovered] = useState<{ country: string; count: number } | null>(null);

  useEffect(() => {
    const el = objectRef.current;
    if (!el || !items.length) return;

    const onLoad = () => {
      const doc = el.contentDocument;
      if (!doc) return;

      const byIso = new Map<string, { country: string; count: number }>();
      for (const item of items) {
        const iso = COUNTRY_TO_ISO[item.country];
        if (iso) byIso.set(iso.toLowerCase(), item);
      }

      const paths = doc.querySelectorAll("path[id], g[id]");
      paths.forEach((node) => {
        const id = node.getAttribute("id");
        if (!id || id.startsWith("_")) return;
        const iso = id.toLowerCase();
        const data = byIso.get(iso);
        if (!data) {
          node.setAttribute("fill", "var(--section-border)");
          node.setAttribute("fill-opacity", "0.2");
          return;
        }

        node.setAttribute("fill", "var(--mondrian-yellow)");
        node.setAttribute("fill-opacity", "0.35");
        node.style.cursor = "pointer";
        node.style.transition = "fill-opacity 0.15s";

        node.addEventListener("mouseenter", () => {
          node.setAttribute("fill-opacity", "0.6");
          setHovered(data);
        });
        node.addEventListener("mouseleave", () => {
          node.setAttribute("fill-opacity", "0.35");
          setHovered(null);
        });
      });
    };

    if (el.contentDocument?.body) onLoad();
    else el.addEventListener("load", onLoad);
    return () => el.removeEventListener("load", onLoad);
  }, [items]);

  const byIso = new Map<string, { country: string; count: number }>();
  for (const item of items) {
    const iso = COUNTRY_TO_ISO[item.country];
    if (iso) byIso.set(iso.toLowerCase(), item);
  }
  const hasMappable = byIso.size > 0;

  if (!hasMappable) return null;

  return (
    <div className="relative">
      <object
        ref={objectRef}
        data="/world-map.svg"
        type="image/svg+xml"
        className="h-[120px] w-full rounded-md border border-[var(--section-border)]"
        aria-hidden
      />
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
