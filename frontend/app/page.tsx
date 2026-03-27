import { EnrichedSample } from "./components/EnrichedSample";
import { ImportStatus } from "./components/ImportStatus";
import { MetadataCoverage } from "./components/MetadataCoverage";
import { WatchlistImportStatus } from "./components/WatchlistImportStatus";
import { RatingsSummary } from "./components/RatingsSummary";
import { RatingsTimeline } from "./components/RatingsTimeline";
import { RecentRatings } from "./components/RecentRatings";
import { SectionHelp } from "./components/SectionHelp";
import { HomeLibraryDetailsToggle } from "./components/HomeLibraryDetailsToggle";
import { RecommendationsContainer } from "./components/RecommendationsContainer";
import { StrongPositiveSample } from "./components/StrongPositiveSample";
import { TasteHints } from "./components/TasteHints";

export default function Home() {
  return (
    <div className="min-h-screen min-w-0 bg-[var(--background)]">
      <main className="tg-main pb-28 pt-6 sm:pt-8 sm:pb-32 md:pt-10 md:pb-40">
        {/* Overview band: grouped intro + stats; subtle surface separates from nav and from recommendations */}
        <div className="tg-bleed-x rounded-b-xl bg-[var(--section-bg)] pb-8 pt-6 sm:pb-10 sm:pt-8">
          <header className="border-b border-[var(--section-border)] pb-5 sm:pb-6">
            <h1 className="font-display max-w-2xl text-[22px] font-medium leading-[1.3] tracking-[-0.02em] text-[var(--foreground)] sm:text-[26px]">
              Recommendations from your IMDb ratings, watchlist, and taste signals.
            </h1>
          </header>

          <div className="mt-6 space-y-0 sm:mt-7">
            <RatingsSummary />
            <section
              className="mt-7 border-t border-[var(--section-border)] pt-7 sm:mt-8 sm:pt-8"
              aria-labelledby="home-library-heading"
            >
              <div className="mb-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 sm:mb-5">
                <h2 id="home-library-heading" className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--overview-muted)]">
                  Your library
                </h2>
                <SectionHelp title="What these mean">
                  <p><strong>Strong signals</strong> = sample of titles you rated 8+. <strong>8+ / &lt;5</strong> = thresholds for strong vs weak taste signals.</p>
                  <p>More ratings and metadata improve recommendations. Studies and high-fit watchlist use these signals.</p>
                </SectionHelp>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-x-10">
                <ImportStatus />
                <WatchlistImportStatus />
                <MetadataCoverage />
                <RatingsTimeline />
                <TasteHints />
              </div>
              <HomeLibraryDetailsToggle>
                <div className="grid gap-8 sm:grid-cols-3 sm:gap-x-8 lg:gap-x-10">
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
              </HomeLibraryDetailsToggle>
            </section>
          </div>
        </div>

        <div className="mt-10 border-t border-[var(--card-border)] pt-8 sm:mt-12 sm:pt-10 md:mt-14 md:pt-12">
          <RecommendationsContainer />
        </div>

      </main>
    </div>
  );
}
