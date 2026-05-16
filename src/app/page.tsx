import Link from "next/link";

const pillars = [
  "Know where your time went",
  "See real cash position",
  "Track recovery trends",
  "Plan the next right move",
];

const differentiators = [
  {
    title: "Personal, not performative",
    description:
      "Built for one person reading their actual life, not feeding a social feed or a team dashboard.",
  },
  {
    title: "Context across domains",
    description:
      "Time, money, health, and priorities sit together so one signal can explain another.",
  },
  {
    title: "Designed for daily steering",
    description:
      "The goal is not more data. It is a calmer, sharper read on what to do next.",
  },
];

const previewStats = [
  {
    label: "Focus",
    value: "4.5h",
    note: "+1.2h vs last Friday",
  },
  {
    label: "Cash",
    value: "$6,240",
    note: "Bills covered, cards steady",
  },
  {
    label: "Recovery",
    value: "82%",
    note: "Sleep trending up",
  },
];

const watchlist = [
  "Move Costco payment out of true spend",
  "Protect 90 minutes for deep work",
  "Refill the low-energy weekend plan",
];

export default function LandingPage() {
  return (
    <main className="relative overflow-hidden">
      <div className="absolute inset-0 -z-20 bg-zinc-50 dark:bg-zinc-950" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.12),_transparent_28%),linear-gradient(to_bottom,_transparent,_rgba(24,24,27,0.03))] dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(192,132,252,0.14),_transparent_24%),linear-gradient(to_bottom,_transparent,_rgba(255,255,255,0.03))]" />

      <section className="px-6 pb-14 pt-18 sm:px-8 sm:pb-20 sm:pt-24">
        <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[minmax(0,1.02fr)_minmax(360px,0.98fr)] lg:items-center">
          <div className="space-y-8">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <p className="font-mono text-xs uppercase tracking-[0.28em] text-zinc-500">
                  aucosto
                </p>
                <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-100/80 px-3 py-1 text-[11px] font-medium text-sky-700 dark:border-sky-900 dark:bg-sky-950/70 dark:text-sky-300">
                  Private beta
                </span>
              </div>

              <div className="space-y-4">
                <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-balance text-zinc-950 sm:text-6xl lg:text-7xl dark:text-white">
                  Understand your life clearly enough to steer it.
                </h1>
                <p className="max-w-2xl text-base leading-8 text-zinc-600 sm:text-lg dark:text-zinc-300">
                  Aucosto turns your time, money, recovery, and priorities into
                  one calm daily system so you can notice what matters and act
                  sooner.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {pillars.map((pillar) => (
                <span
                  key={pillar}
                  className="inline-flex items-center rounded-full border border-white/70 bg-white/80 px-3.5 py-1.5 text-sm text-zinc-700 shadow-sm shadow-zinc-200/60 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/85 dark:text-zinc-300 dark:shadow-black/10"
                >
                  {pillar}
                </span>
              ))}
            </div>

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-950 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                Sign in
              </Link>
              <Link
                href="#why"
                className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-300 bg-white/75 px-6 text-sm font-medium text-zinc-800 transition-colors hover:bg-white dark:border-zinc-700 dark:bg-zinc-900/75 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Why aucosto works
              </Link>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Quiet, personal, and invite-only for now.
              </p>
            </div>
          </div>

          <aside className="relative rounded-[2rem] border border-white/70 bg-white/85 p-4 shadow-[0_30px_120px_-45px_rgba(24,24,27,0.35)] backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/85 dark:shadow-[0_30px_120px_-50px_rgba(0,0,0,0.75)]">
            <div className="absolute inset-x-10 top-0 -z-10 h-24 rounded-full bg-sky-400/20 blur-3xl dark:bg-sky-500/20" />

            <div className="rounded-[1.6rem] border border-zinc-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(244,244,245,0.94))] p-5 dark:border-zinc-800 dark:bg-[linear-gradient(180deg,rgba(24,24,27,0.96),rgba(9,9,11,0.94))]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-zinc-950 dark:text-zinc-100">
                    Daily overview
                  </p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    A cleaner read on where the day is drifting.
                  </p>
                </div>
                <span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  Live
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {previewStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-zinc-200/80 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-900/90"
                  >
                    <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">
                      {stat.label}
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {stat.note}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-900/90">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      This week
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Friction dropping
                    </p>
                  </div>
                  <div className="mt-4 flex h-28 items-end gap-2">
                    {[38, 56, 44, 72, 64, 82, 58].map((height, index) => (
                      <div key={index} className="flex h-full flex-1 items-end">
                        <div
                          className="w-full rounded-t-2xl bg-gradient-to-t from-sky-500 via-cyan-400 to-violet-400"
                          style={{ height: `${height}%` }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
                    <span>Mon</span>
                    <span>Sun</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200/80 bg-zinc-950 p-4 text-zinc-50 dark:border-zinc-800 dark:bg-black">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-400">
                    Right now
                  </p>
                  <ul className="mt-3 space-y-3 text-sm leading-6 text-zinc-300">
                    {watchlist.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-400" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section id="why" className="px-6 pb-20 sm:px-8 sm:pb-24">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-zinc-200/80 bg-white/70 p-6 shadow-[0_24px_80px_-50px_rgba(24,24,27,0.28)] backdrop-blur sm:p-8 dark:border-zinc-800/80 dark:bg-zinc-900/60 dark:shadow-[0_24px_80px_-55px_rgba(0,0,0,0.7)]">
          <div className="max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-zinc-500">
              Why it feels different
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl dark:text-zinc-50">
              Less dashboard theater. More useful clarity.
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600 dark:text-zinc-300">
              Most tools help you collect data. Aucosto is meant to help you
              read your life, spot drift early, and make better small decisions.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {differentiators.map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-zinc-200/80 bg-white/85 p-5 dark:border-zinc-800 dark:bg-zinc-950/70"
              >
                <p className="text-lg font-medium text-zinc-950 dark:text-zinc-50">
                  {item.title}
                </p>
                <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
