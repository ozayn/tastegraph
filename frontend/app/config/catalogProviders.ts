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
  /** Primary line — short, direct */
  intro: string;
  /** Optional quieter line under intro (snapshot vs watchlist, etc.) */
  introSub?: string;
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
    intro: "BritBox US catalog—series and films ranked from your taste.",
    introSub:
      "Pool is the snapshot, not your watchlist; ratings and list shape how titles score.",
    helpPool:
      "Filters (decade, similar-to) narrow the snapshot before ranking.",
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
    intro: "MUBI US catalog—films from the snapshot, ranked from your taste.",
    introSub:
      "Same provider flow as BritBox: snapshot pool, taste-informed scores.",
    helpPool:
      "Filters narrow the MUBI snapshot before ranking, like other provider tabs.",
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
