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
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-12 sm:px-6 sm:pt-16 sm:pb-32 md:pt-[14vh] md:pb-36">
        <header className="mb-10 sm:mb-12">
          <h1>
            <img
              src="/logo-horizontal.svg"
              alt="TasteGraph"
              className="h-7 w-auto sm:h-8"
            />
          </h1>
          <p className="mt-5 text-[15px] leading-[1.7] text-[var(--muted)] sm:mt-6 sm:text-base">
            Recommend what to watch based on your IMDb ratings, watchlist, mood,
            and platform preferences.
          </p>
        </header>

        <div className="space-y-4 sm:space-y-5">
          <RatingsSummary />
          <section
            className="rounded-lg border border-[var(--section-border)] bg-[var(--section-bg)] px-4 py-4 sm:px-5 sm:py-4"
            aria-label="Data overview"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--overview-muted)]">
              Overview
            </p>
            <div className="mt-3 space-y-2 sm:mt-3.5 sm:space-y-2.5">
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
        </div>

        <div className="mt-16 space-y-14 sm:mt-20 sm:space-y-16">
          <SimpleRecommendations />
          <WatchlistRecommendations />
        </div>

        <section className="mt-16 sm:mt-20">
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--overview-muted)]">
            Example queries
          </p>
          <ul className="mt-3 space-y-2.5 sm:mt-3.5 sm:space-y-3">
            <li className="text-[14px] leading-[1.6] text-[var(--muted-soft)] sm:text-[15px]">
              &ldquo;What should I watch on BritBox?&rdquo;
            </li>
            <li className="text-[14px] leading-[1.6] text-[var(--muted-soft)] sm:text-[15px]">
              &ldquo;What fits my mood from my watchlist?&rdquo;
            </li>
            <li className="text-[14px] leading-[1.6] text-[var(--muted-soft)] sm:text-[15px]">
              &ldquo;Recommend a Persian romance movie from my watchlist.&rdquo;
            </li>
          </ul>
        </section>

        <div className="mt-16 pt-2 sm:mt-20">
          <BackendHealth />
        </div>
      </main>
    </div>
  );
}
