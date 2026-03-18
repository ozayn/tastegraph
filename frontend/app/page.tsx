import { BackendHealth } from "./components/BackendHealth";
import { EnrichedSample } from "./components/EnrichedSample";
import { ImportStatus } from "./components/ImportStatus";
import { MetadataCoverage } from "./components/MetadataCoverage";
import { WatchlistImportStatus } from "./components/WatchlistImportStatus";
import { RatingsSummary } from "./components/RatingsSummary";
import { RatingsTimeline } from "./components/RatingsTimeline";
import { RecentRatings } from "./components/RecentRatings";
import { SimpleRecommendations } from "./components/SimpleRecommendations";
import { WatchlistRecommendations } from "./components/WatchlistRecommendations";
import { StrongPositiveSample } from "./components/StrongPositiveSample";
import { TasteHints } from "./components/TasteHints";

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <main className="mx-auto max-w-2xl px-5 pb-24 pt-14 sm:px-8 sm:pt-20 md:pt-[18vh] md:pb-32">
        <header>
          <h1>
            <img
              src="/logo-horizontal.svg"
              alt="TasteGraph"
              className="h-7 w-auto sm:h-8"
            />
          </h1>
          <p className="mt-6 text-[15px] font-normal leading-[1.65] text-[var(--foreground)] sm:mt-7 sm:text-base">
            Recommend what to watch based on your IMDb ratings, watchlist, mood,
            and platform preferences.
          </p>
        </header>

        <RatingsSummary />

        <section className="mt-12 sm:mt-14" aria-label="Data overview">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-soft)]">
            Overview
          </p>
          <div className="mt-3 space-y-2.5">
            <ImportStatus />
            <WatchlistImportStatus />
            <MetadataCoverage />
            <RatingsTimeline />
            <TasteHints />
            <StrongPositiveSample />
            <EnrichedSample />
            <RecentRatings />
          </div>
        </section>

        <SimpleRecommendations />
        <WatchlistRecommendations />

        <section className="mt-20 sm:mt-24">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-soft)]">
            Example queries
          </p>
          <ul className="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
            <li className="text-[15px] font-normal leading-[1.6] text-[var(--foreground)] sm:text-base">
              &ldquo;What should I watch on BritBox?&rdquo;
            </li>
            <li className="text-[15px] font-normal leading-[1.6] text-[var(--foreground)] sm:text-base">
              &ldquo;What fits my mood from my watchlist?&rdquo;
            </li>
            <li className="text-[15px] font-normal leading-[1.6] text-[var(--foreground)] sm:text-base">
              &ldquo;Recommend a Persian romance movie from my watchlist.&rdquo;
            </li>
          </ul>
        </section>

        <div className="mt-20 sm:mt-28">
          <BackendHealth />
        </div>
      </main>
    </div>
  );
}
