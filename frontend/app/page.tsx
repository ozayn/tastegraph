import { BackendHealth } from "./components/BackendHealth";
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
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-12 sm:px-8 sm:pt-16 sm:pb-32 md:max-w-3xl md:px-10 md:pt-[10vh] md:pb-40 lg:max-w-4xl lg:px-12">
        <header className="mb-14 sm:mb-16 md:mb-20">
          <h1>
            <img
              src="/logo-horizontal.svg"
              alt="TasteGraph"
              className="h-9 w-auto sm:h-10 md:h-11"
            />
          </h1>
          <p className="mt-5 max-w-lg text-[16px] leading-[1.6] text-[var(--muted)] sm:mt-6 sm:text-[17px] md:mt-7 md:text-[18px]">
            Discover what to watch based on your IMDb ratings and watchlist.
          </p>
          <p className="mt-2 text-[13px] text-[var(--muted-subtle)] sm:text-[14px]">
            Personalized recommendations, filtered by genre, country, and year.
          </p>
        </header>

        <div className="space-y-6 sm:space-y-8">
          <RatingsSummary />
          <section
            className="rounded-xl border border-[var(--section-border)] bg-[var(--section-bg)] px-5 py-5 sm:px-6 sm:py-6"
            aria-label="Data overview"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--overview-muted)]">
              Your library
              <SectionHelp title="What these mean">
                <p><strong>Strong signals</strong> = sample of titles you rated 8+. <strong>8+ / &lt;5</strong> = thresholds for strong vs weak taste signals.</p>
                <p>More ratings and metadata improve recommendations. Studies and high-fit watchlist use these signals.</p>
              </SectionHelp>
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
              <div className="rounded-lg border border-[var(--section-border)] bg-[var(--card-bg)] px-3 py-2.5 sm:px-4 sm:py-3">
                <ImportStatus />
              </div>
              <div className="rounded-lg border border-[var(--section-border)] bg-[var(--card-bg)] px-3 py-2.5 sm:px-4 sm:py-3">
                <WatchlistImportStatus />
              </div>
              <div className="rounded-lg border border-[var(--section-border)] bg-[var(--card-bg)] px-3 py-2.5 sm:px-4 sm:py-3">
                <MetadataCoverage />
              </div>
              <div className="rounded-lg border border-[var(--section-border)] bg-[var(--card-bg)] px-3 py-2.5 sm:px-4 sm:py-3">
                <RatingsTimeline />
              </div>
              <div className="rounded-lg border border-[var(--section-border)] bg-[var(--card-bg)] px-3 py-2.5 sm:px-4 sm:py-3">
                <TasteHints />
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:mt-5 sm:grid-cols-3 sm:gap-4">
              <div className="rounded-lg border border-[var(--section-border)] bg-[var(--card-bg)] px-3 py-3 sm:px-4 sm:py-3.5">
                <StrongPositiveSample />
              </div>
              <div className="rounded-lg border border-[var(--section-border)] bg-[var(--card-bg)] px-3 py-3 sm:px-4 sm:py-3.5">
                <EnrichedSample />
              </div>
              <div className="rounded-lg border border-[var(--section-border)] bg-[var(--card-bg)] px-3 py-3 sm:px-4 sm:py-3.5">
                <RecentRatings />
              </div>
            </div>
          </section>
        </div>

        <div className="mt-16 sm:mt-20 md:mt-24">
          <RecommendationsContainer />
        </div>

        <section className="mt-16 sm:mt-20 md:mt-24">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--overview-muted)]">
            Example queries
          </p>
          <ul className="mt-3 space-y-2 sm:mt-4 sm:space-y-2.5">
            <li className="text-[14px] leading-[1.65] text-[var(--muted-soft)] sm:text-[15px]">
              &ldquo;What should I watch on BritBox?&rdquo;
            </li>
            <li className="text-[14px] leading-[1.65] text-[var(--muted-soft)] sm:text-[15px]">
              &ldquo;What fits my mood from my watchlist?&rdquo;
            </li>
            <li className="text-[14px] leading-[1.65] text-[var(--muted-soft)] sm:text-[15px]">
              &ldquo;Recommend a Persian romance movie from my watchlist.&rdquo;
            </li>
          </ul>
        </section>

        <div className="mt-16 pt-2 sm:mt-20 md:mt-24">
          <BackendHealth />
        </div>
      </main>
    </div>
  );
}
