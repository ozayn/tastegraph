import { EnrichedSample } from "./components/EnrichedSample";
import { ImportStatus } from "./components/ImportStatus";
import { MetadataCoverage } from "./components/MetadataCoverage";
import { WatchlistImportStatus } from "./components/WatchlistImportStatus";
import { RatingsSummary } from "./components/RatingsSummary";
import { RatingsTimeline } from "./components/RatingsTimeline";
import { RecentRatings } from "./components/RecentRatings";
import { SectionHelp } from "./components/SectionHelp";
import { RecommendationsContainer } from "./components/RecommendationsContainer";
import { StrongPositiveSample } from "./components/StrongPositiveSample";
import { TasteHints } from "./components/TasteHints";

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-8 sm:px-8 sm:pt-10 sm:pb-32 md:max-w-3xl md:px-10 md:pt-12 md:pb-40 lg:max-w-4xl lg:px-12">
        <header className="mb-10 sm:mb-12">
          <p className="max-w-xl text-[15px] leading-[1.6] text-[var(--muted-soft)] sm:text-[16px]">
            Discover what to watch from your IMDb ratings and watchlist — personalized recommendations by genre, country, and year.
          </p>
        </header>

        <div className="space-y-6 sm:space-y-8">
          <RatingsSummary />
          <section aria-label="Data overview">
            <p className="mb-4 text-[12px] font-medium uppercase tracking-[0.04em] text-[var(--overview-muted)]">
              Your library
              <SectionHelp title="What these mean">
                <p><strong>Strong signals</strong> = sample of titles you rated 8+. <strong>8+ / &lt;5</strong> = thresholds for strong vs weak taste signals.</p>
                <p>More ratings and metadata improve recommendations. Studies and high-fit watchlist use these signals.</p>
              </SectionHelp>
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
              <div className="px-1 py-2">
                <ImportStatus />
              </div>
              <div className="px-1 py-2">
                <WatchlistImportStatus />
              </div>
              <div className="px-1 py-2">
                <MetadataCoverage />
              </div>
              <div className="px-1 py-2">
                <RatingsTimeline />
              </div>
              <div className="px-1 py-2">
                <TasteHints />
              </div>
            </div>
            <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-3">
              <div className="border-t border-[var(--section-border)] px-1 pt-3">
                <StrongPositiveSample />
              </div>
              <div className="border-t border-[var(--section-border)] px-1 pt-3">
                <EnrichedSample />
              </div>
              <div className="border-t border-[var(--section-border)] px-1 pt-3">
                <RecentRatings />
              </div>
            </div>
          </section>
        </div>

        <div className="mt-20 sm:mt-24 md:mt-28">
          <RecommendationsContainer />
        </div>

      </main>
    </div>
  );
}
