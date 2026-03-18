import { BackendHealth } from "./components/BackendHealth";
import { EnrichedSample } from "./components/EnrichedSample";
import { ImportStatus } from "./components/ImportStatus";
import { MetadataCoverage } from "./components/MetadataCoverage";
import { RatingsSummary } from "./components/RatingsSummary";
import { RatingsTimeline } from "./components/RatingsTimeline";
import { RecentRatings } from "./components/RecentRatings";
import { SimpleRecommendations } from "./components/SimpleRecommendations";
import { StrongPositiveSample } from "./components/StrongPositiveSample";
import { TasteHints } from "./components/TasteHints";

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <main className="mx-auto max-w-xl px-4 pb-20 pt-12 sm:px-6 sm:pt-16 md:px-8 md:pt-[20vh] md:pb-24">
        <h1 className="text-3xl font-normal tracking-tight text-[var(--foreground)] sm:text-4xl">
          TasteGraph
        </h1>
        <p className="mt-6 text-base font-normal leading-relaxed text-[var(--foreground)] sm:mt-8 sm:text-lg">
          Recommend what to watch based on your IMDb ratings, watchlist, mood,
          and platform preferences.
        </p>

        <RatingsSummary />
        <div className="mt-6 space-y-0 sm:mt-8">
          <ImportStatus />
          <MetadataCoverage />
          <RatingsTimeline />
          <TasteHints />
          <StrongPositiveSample />
          <EnrichedSample />
          <RecentRatings />
        </div>

        <SimpleRecommendations />

        <section className="mt-16 sm:mt-20">
          <p className="text-sm font-normal tracking-wide text-[var(--muted)]">
            Example queries
          </p>
          <ul className="mt-4 space-y-4 sm:mt-6 sm:space-y-5">
            <li className="font-normal italic leading-relaxed text-[var(--foreground)]">
              &ldquo;What should I watch on BritBox?&rdquo;
            </li>
            <li className="font-normal italic leading-relaxed text-[var(--foreground)]">
              &ldquo;What fits my mood from my watchlist?&rdquo;
            </li>
            <li className="font-normal italic leading-relaxed text-[var(--foreground)]">
              &ldquo;Recommend a Persian romance movie from my watchlist.&rdquo;
            </li>
          </ul>
        </section>

        <div className="mt-16 sm:mt-24">
          <BackendHealth />
        </div>
      </main>
    </div>
  );
}
