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
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-6 sm:px-8 sm:pt-8 sm:pb-32 md:max-w-3xl md:px-10 md:pt-10 md:pb-40 lg:max-w-4xl lg:px-12">
        {/* Overview band: grouped intro + stats; subtle surface separates from nav and from recommendations */}
        <div className="-mx-4 rounded-b-xl bg-[var(--section-bg)] px-4 pb-10 pt-6 sm:-mx-8 sm:px-8 sm:pb-12 sm:pt-8 md:-mx-10 md:px-10 lg:-mx-12 lg:px-12">
          <header className="border-b border-[var(--section-border)] pb-7 sm:pb-8">
            <h1 className="font-display max-w-xl text-[24px] font-medium leading-[1.25] tracking-[-0.02em] text-[var(--foreground)] sm:text-[28px]">
              What to watch next—grounded in your library.
            </h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--muted)] sm:mt-4 sm:text-[16px]">
              Recommendations shaped by your IMDb ratings, watchlist, and taste signals across genre, country, and era.
            </p>
          </header>

          <div className="mt-7 space-y-0 sm:mt-8">
            <RatingsSummary />
            <section
              className="mt-9 border-t border-[var(--section-border)] pt-8 sm:mt-10 sm:pt-9"
              aria-labelledby="home-library-heading"
            >
              <div className="mb-5 flex flex-wrap items-baseline gap-x-2 gap-y-1 sm:mb-6">
                <h2 id="home-library-heading" className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--overview-muted)]">
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
        </div>

        <div className="mt-12 border-t border-[var(--card-border)] pt-10 sm:mt-14 sm:pt-12 md:mt-16 md:pt-14">
          <RecommendationsContainer />
        </div>

      </main>
    </div>
  );
}
