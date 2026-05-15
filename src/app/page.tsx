import Link from "next/link";

const features = ["Time tracking", "Finance", "Health", "More coming"];

export default function LandingPage() {
  return (
    <main className="relative flex flex-1 items-center overflow-hidden px-6 py-20 sm:px-8 sm:py-24">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(24,24,27,0.08),_transparent_45%)] dark:bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_35%)]" />

      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-center">
        <section className="rounded-3xl border border-zinc-200/80 bg-white/80 p-8 shadow-[0_20px_80px_-40px_rgba(24,24,27,0.35)] backdrop-blur sm:p-10 dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:shadow-[0_20px_80px_-40px_rgba(0,0,0,0.7)]">
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-zinc-500">
                  aucosto
                </p>
                <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  Private beta
                </span>
              </div>
              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                Run your personal systems in one place.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-400">
                Aucosto brings together the tools that keep your life moving
                &mdash; time, money, health, people, and whatever matters next.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {features.map((feature) => (
                <span
                  key={feature}
                  className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                >
                  {feature}
                </span>
              ))}
            </div>

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Link
                href="/login"
                className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                Sign in
              </Link>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Quiet, personal, and invite-only for now.
              </p>
            </div>
          </div>
        </section>

        <aside className="rounded-3xl border border-zinc-200/80 bg-gradient-to-br from-white to-zinc-100 p-6 shadow-[0_20px_80px_-50px_rgba(24,24,27,0.35)] dark:border-zinc-800/80 dark:from-zinc-900 dark:to-zinc-950 dark:shadow-[0_20px_80px_-50px_rgba(0,0,0,0.7)]">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Daily overview
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  A calmer view of what needs your attention.
                </p>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                Live
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Time
                </p>
                <p className="mt-3 text-2xl font-semibold">4.5h</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Focused so far today
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Spend
                </p>
                <p className="mt-3 text-2xl font-semibold">$38</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Mostly groceries and coffee
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Health
                </p>
                <p className="mt-3 text-2xl font-semibold">7.8h</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Sleep, recovery, and trends
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200/80 bg-zinc-950 p-5 text-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                Why it works
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-300">
                Instead of scattering context across separate apps, aucosto is
                built to make your day easier to read, steer, and improve.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
