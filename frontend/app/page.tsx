import { BackendHealth } from "./components/BackendHealth";

export default function Home() {
  return (
    <div className="min-h-screen bg-white font-sans dark:bg-zinc-950">
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          TasteGraph
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          Recommend what to watch based on your IMDb ratings, watchlist, mood,
          and platform preferences.
        </p>

        <section className="mt-12">
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
            Example queries
          </h2>
          <ul className="mt-3 space-y-2">
            <li className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              &ldquo;What should I watch on BritBox?&rdquo;
            </li>
            <li className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              &ldquo;What fits my mood from my watchlist?&rdquo;
            </li>
            <li className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              &ldquo;Recommend a Persian romance movie from my watchlist.&rdquo;
            </li>
          </ul>
        </section>

        <div className="mt-12">
          <BackendHealth />
        </div>
      </main>
    </div>
  );
}
