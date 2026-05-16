import Link from "next/link";

const performanceSignals = [
  {
    value: "4.5h",
    label: "Focused work",
    detail: "enough for a good day if the evening does not get sloppy",
  },
  {
    value: "$6.2k",
    label: "Cash on hand",
    detail: "stable, but two transactions are distorting the real picture",
  },
  {
    value: "82%",
    label: "Recovery",
    detail: "sleep is trending up, which usually means better decisions tomorrow",
  },
];

const featureRows = [
  {
    eyebrow: "Daily read",
    title: "See the state of the day in one pass.",
    body:
      "Time, money, and recovery sit together so the story is obvious faster. No bouncing between trackers just to figure out what is off.",
    points: ["Running time blocks", "Cash and spend pressure", "Recovery context"],
  },
  {
    eyebrow: "Private by default",
    title: "Built for a real life, not a social feed.",
    body:
      "Hide finance until you want it, lock the app with a PIN, and switch into demo mode when you need to show the product without exposing your actual data.",
    points: ["Finance hidden by default", "PIN lock", "Isolated demo workspace"],
  },
  {
    eyebrow: "Useful signal",
    title: "The point is better decisions, not prettier charts.",
    body:
      "Aucosto is for the moment when you want an honest read on what needs attention today: the task you are avoiding, the spend that needs recategorizing, the energy you should stop wasting.",
    points: ["Watchlist-style notes", "Cross-domain context", "Personal daily steering"],
  },
];

const quotes = [
  {
    quote:
      "It feels less like using an app and more like checking a well-kept notebook that already knows what matters.",
    source: "Designed for one person, not a department.",
  },
  {
    quote:
      "The useful part is seeing time, spending, and recovery next to each other. That is where the real story usually is.",
    source: "Context beats isolated metrics.",
  },
];

const stripItems = [
  "Time tracking that does not feel like timesheet software",
  "Finance visibility you control",
  "Recovery context without wearable-brand theater",
  "A calmer daily operating panel",
];

export default function LandingPage() {
  return (
    <main className="bg-[#05070b] text-white">
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_34%),radial-gradient(circle_at_80%_20%,_rgba(59,130,246,0.12),_transparent_26%),linear-gradient(180deg,#05070b_0%,#05070b_45%,#0a1220_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:28px_28px] opacity-30" />

        <div className="relative mx-auto max-w-7xl px-6 pb-16 pt-10 sm:px-8 sm:pb-24 sm:pt-12">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs uppercase tracking-[0.34em] text-zinc-400">aucosto</span>
              <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-zinc-200">
                Private beta
              </span>
            </div>
            <p className="text-sm text-zinc-400">Personal performance, but for your actual life.</p>
          </div>

          <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)] lg:items-center">
            <div className="max-w-4xl">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-sky-300">Understand the full picture</p>
              <h1 className="mt-5 text-5xl font-semibold leading-[0.95] tracking-[-0.05em] text-white sm:text-6xl lg:text-[5.6rem]">
                A daily system for
                <br />
                time, money, recovery,
                <br />
                and what to do next.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-300 sm:text-lg">
                Aucosto gives you one high-signal read on how things are going so you can make better calls before the day slips, spending drifts, or your energy quietly falls apart.
              </p>

              <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-200"
                >
                  Sign in
                </Link>
                <Link
                  href="#features"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 text-sm font-medium text-white transition-colors hover:bg-white/10"
                >
                  Explore the system
                </Link>
                <span className="text-sm text-zinc-400">Private, local-first, and built for daily use.</span>
              </div>
            </div>

            <aside className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 shadow-[0_40px_120px_-50px_rgba(0,0,0,0.8)] backdrop-blur-xl">
              <div className="rounded-[1.7rem] border border-white/10 bg-[#0b1220] p-5">
                <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <p className="text-sm font-medium text-white">Daily overview</p>
                    <p className="mt-1 text-sm text-zinc-400">A read on performance without pretending life comes in separate tabs.</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">Live</span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  {performanceSignals.map((item) => (
                    <article key={item.label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-zinc-500">{item.label}</p>
                      <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{item.value}</p>
                      <p className="mt-2 text-sm leading-6 text-zinc-400">{item.detail}</p>
                    </article>
                  ))}
                </div>

                <div className="mt-4 rounded-[1.4rem] border border-sky-500/20 bg-[linear-gradient(180deg,rgba(14,23,39,0.96),rgba(7,11,18,0.98))] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">What needs attention</p>
                    <p className="text-xs uppercase tracking-[0.18em] text-sky-300">Today</p>
                  </div>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-300">
                    <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-sky-400" /><span>That Costco payment is inflating spend. Fix the category before you trust the month.</span></li>
                    <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-sky-400" /><span>You still have enough energy for one serious block of work. Protect it now or lose it.</span></li>
                    <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-sky-400" /><span>Recovery is improving. Good time to push a little harder without overdoing it.</span></li>
                  </ul>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-black/30 py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap gap-x-8 gap-y-2 px-6 text-sm text-zinc-400 sm:px-8">
          {stripItems.map((item) => (
            <span key={item} className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              {item}
            </span>
          ))}
        </div>
      </section>

      <section id="features" className="bg-[#070b12] px-6 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-sky-300">Built for the whole system</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
              The point is not tracking more.
              <br />
              The point is seeing sooner.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-400 sm:text-lg">
              Most personal tools isolate one category and leave you to do the interpretation yourself. Aucosto tries to do the opposite.
            </p>
          </div>

          <div className="mt-10 space-y-4">
            {featureRows.map((row, index) => (
              <article
                key={row.title}
                className="grid gap-6 rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 sm:p-8 lg:grid-cols-[180px_minmax(0,1fr)_320px] lg:items-start"
              >
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.24em] text-zinc-500">0{index + 1}</p>
                  <p className="mt-2 text-sm text-sky-300">{row.eyebrow}</p>
                </div>
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{row.title}</h3>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">{row.body}</p>
                </div>
                <ul className="space-y-3 rounded-[1.5rem] border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
                  {row.points.map((point) => (
                    <li key={point} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-sky-400" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#05070b] px-6 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-2">
          {quotes.map((item) => (
            <article key={item.quote} className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
              <p className="text-2xl font-medium leading-10 text-white sm:text-3xl sm:leading-[1.45]">“{item.quote}”</p>
              <p className="mt-5 text-sm uppercase tracking-[0.2em] text-zinc-500">{item.source}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-white/10 bg-[linear-gradient(180deg,#05070b_0%,#0b1220_100%)] px-6 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl rounded-[2.4rem] border border-white/10 bg-white/[0.04] p-6 sm:p-10">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-sky-300">One more thing</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
                This is not trying to be WHOOP for everything.
                <br />
                It is trying to be useful in the same way.
              </h2>
              <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-400 sm:text-lg">
                Premium signal. Daily behavior. A strong opinion about what matters. But aimed at the whole shape of your day — not just physiology.
              </p>
            </div>
            <div className="space-y-3">
              <Link
                href="/login"
                className="inline-flex h-12 w-full items-center justify-center rounded-full bg-white px-6 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-200"
              >
                Open aucosto
              </Link>
              <p className="text-sm text-zinc-500">Invite-only for now. Private data stays private.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
