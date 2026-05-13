import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="w-full max-w-xl space-y-10 text-center sm:text-left">
        <div className="space-y-3">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
            aucosto
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Your personal hub.
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            One place for the tools that run your day &mdash; time, money,
            health, people, and whatever else gets added next.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-md bg-zinc-900 px-6 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Sign in
          </Link>
          <span className="font-mono text-xs text-zinc-500">
            invite-only for now
          </span>
        </div>
      </div>
    </main>
  );
}
