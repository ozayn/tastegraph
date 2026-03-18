import { BackendHealth } from "./components/BackendHealth";
import { ImportStatus } from "./components/ImportStatus";
import { MetadataCoverage } from "./components/MetadataCoverage";
import { RatingsSummary } from "./components/RatingsSummary";
import { RatingsTimeline } from "./components/RatingsTimeline";
import { RecentRatings } from "./components/RecentRatings";
import { StrongPositiveSample } from "./components/StrongPositiveSample";
import { TasteHints } from "./components/TasteHints";

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <main className="mx-auto max-w-xl px-8 pt-[20vh] pb-24">
        <h1 className="text-4xl font-light tracking-tight text-[var(--foreground)]">
          TasteGraph
        </h1>
        <p className="mt-8 text-lg font-light leading-relaxed text-[var(--foreground)]/70">
          Recommend what to watch based on your IMDb ratings, watchlist, mood,
          and platform preferences.
        </p>

        <RatingsSummary />
        <ImportStatus />
        <MetadataCoverage />
        <RatingsTimeline />
        <TasteHints />
        <StrongPositiveSample />
        <RecentRatings />

        <section className="mt-20">
          <p className="text-sm font-normal tracking-wide text-[var(--foreground)]/50">
            Example queries
          </p>
          <ul className="mt-6 space-y-5">
            <li className="font-light italic leading-relaxed text-[var(--foreground)]/80">
              &ldquo;What should I watch on BritBox?&rdquo;
            </li>
            <li className="font-light italic leading-relaxed text-[var(--foreground)]/80">
              &ldquo;What fits my mood from my watchlist?&rdquo;
            </li>
            <li className="font-light italic leading-relaxed text-[var(--foreground)]/80">
              &ldquo;Recommend a Persian romance movie from my watchlist.&rdquo;
            </li>
          </ul>
        </section>

        <div className="mt-24">
          <BackendHealth />
        </div>
      </main>
    </div>
  );
}
