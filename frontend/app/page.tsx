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
        <header className="border-b border-[var(--section-border)] pb-8 sm:pb-10">
          <p className="max-w-xl text-[15px] leading-[1.65] text-[var(--muted-soft)] sm:text-[16px]">
            Discover what to watch from your IMDb ratings and watchlist — personalized recommendations by genre, country, and year.
          </p>
        </header>

        <div className="mt-8 space-y-0 sm:mt-10">
          <RatingsSummary />
          <section
            className="mt-10 border-t border-[var(--section-border)] pt-8 sm:mt-12 sm:pt-10"
            aria-labelledby="home-library-heading"
          >
            <div className="mb-5 flex flex-wrap items-baseline gap-x-2 gap-y-1 sm:mb-6">
              <h2 id="home-library-heading" className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--overview-muted)]">
                Your library
              </h2>
              <SectionHelp title="What these mean">
                <p><strong>Strong signals</strong> = sample of titles you rated 8+. <strong>8+ / &lt;5</strong> = thresholds for strong vs weak taste signals.</p>
                <p>More ratings and metadata improve recommendations. Studies and high-fit watchlist use these signals.</p>
              </SectionHelp>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 lg:grid-cols-5 lg:gap-x-10">
              <ImportStatus />
              <WatchlistImportStatus />
              <MetadataCoverage />
              <RatingsTimeline />
              <TasteHints />
            </div>
            <div className="mt-8 grid gap-8 sm:mt-10 sm:grid-cols-3 sm:gap-x-8 lg:gap-x-10">
              <div className="border-t border-[var(--section-border)] pt-5 sm:border-t-0 sm:border-l sm:border-[var(--section-border)] sm:pl-6 sm:pt-0 first:border-l-0 first:pl-0">
                <StrongPositiveSample />
              </div>
              <div className="border-t border-[var(--section-border)] pt-5 sm:border-t-0 sm:border-l sm:border-[var(--section-border)] sm:pl-6 sm:pt-0 first:border-l-0 first:pl-0">
                <EnrichedSample />
              </div>
              <div className="border-t border-[var(--section-border)] pt-5 sm:border-t-0 sm:border-l sm:border-[var(--section-border)] sm:pl-6 sm:pt-0 first:border-l-0 first:pl-0">
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
