/**
 * UI + API wiring for Watchmode-backed catalog providers (BritBox, MUBI, …).
 *
 * To add a provider: extend CATALOG_PROVIDERS, add backend CATALOG_PROVIDERS entry,
 * snapshot fetch script, and HighFitCard variant if layout differs.
 */

export type CatalogProviderModeId = "britbox" | "mubi";

export type CatalogProviderUiConfig = {
  /** Home recommendation tab id */
  modeId: CatalogProviderModeId;
  /** Matches backend provider_catalog slug */
  slug: string;
  label: string;
  switcherAccentVar: string;
  apiHigh: string;
  apiMl: string;
  filterIdPrefix: string;
  highFitCardVariant: "britbox" | "mubi";
  poolLabel: string;
  intro: string;
  helpPool: string;
  /** Shown after cd backend && */
  fetchModule: string;
  /** Optional second command (metadata gaps), without cd prefix */
  enrichModule?: string;
};

export const CATALOG_PROVIDERS: readonly CatalogProviderUiConfig[] = [
  {
    modeId: "britbox",
    slug: "britbox-us",
    label: "BritBox",
    switcherAccentVar: "var(--mondrian-red)",
    apiHigh: "britbox",
    apiMl: "britbox-ml",
    filterIdPrefix: "britbox",
    highFitCardVariant: "britbox",
    poolLabel: "BritBox",
    intro:
      "Full BritBox snapshot (series and films), ranked for you. Watchlist feeds taste only—those titles stay out of the list.",
    helpPool:
      "Pool = the BritBox US snapshot, not your watchlist. Decade and similar-to narrow the pool before ranking.",
    fetchModule: "python -m app.scripts.fetch_britbox_catalog",
    enrichModule: "python -m app.scripts.britbox_catalog_metadata --enrich",
  },
  {
    modeId: "mubi",
    slug: "mubi-us",
    label: "MUBI",
    switcherAccentVar: "var(--mondrian-blue)",
    apiHigh: "mubi",
    apiMl: "mubi-ml",
    filterIdPrefix: "mubi",
    highFitCardVariant: "mubi",
    poolLabel: "MUBI",
    intro:
      "MUBI US catalog from Watchmode—mostly films—ranked for your taste. Watchlist shapes scoring only; those titles are not in the pool.",
    helpPool:
      "Pool = the MUBI US snapshot, not your watchlist. Decade and similar-to narrow the pool before ranking (same controls as other catalog providers).",
    fetchModule: "python -m app.scripts.fetch_mubi_catalog",
    enrichModule: "python -m app.scripts.mubi_catalog_metadata --enrich",
  },
] as const;

export function catalogProviderByModeId(
  id: CatalogProviderModeId
): CatalogProviderUiConfig {
  const c = CATALOG_PROVIDERS.find((p) => p.modeId === id);
  if (!c) throw new Error(`Unknown catalog provider mode: ${id}`);
  return c;
}

export function isCatalogProviderMode(mode: string): mode is CatalogProviderModeId {
  return CATALOG_PROVIDERS.some((p) => p.modeId === mode);
}
