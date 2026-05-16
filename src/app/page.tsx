import Link from "next/link";

const heroStats = [
  {
    value: "4.5h",
    label: "Focused work",
    note: "deep work protected before the day got noisy",
  },
  {
    value: "$6.2k",
    label: "Cash on hand",
    note: "steady, with a couple transactions worth cleaning up",
  },
  {
    value: "82%",
    label: "Recovery",
    note: "good enough to push, not good enough to waste",
  },
];

const trustStats = [
  { value: "1", label: "daily home for the important signals" },
  { value: "3", label: "domains read together" },
  { value: "0", label: "interest in productivity theater" },
];

const features = [
  {
    step: "01",
    eyebrow: "Daily overview",
    title: "See time, money, and recovery in one pass.",
    body:
      "Aucosto puts the important signals next to each other so you can understand the shape of the day without rebuilding context in your head every time you check in.",
    bullets: ["Running work blocks", "Cash and spend pressure", "Energy and recovery context"],
  },
  {
    step: "02",
    eyebrow: "Private by default",
    title: "Keep the useful parts visible without exposing your life.",
    body:
      "Finance can stay hidden until you explicitly turn it on. The app can lock behind a PIN. And demo mode gives you a safe fake workspace when you want to show the product without showing your real numbers.",
    bullets: ["Finance hidden by default", "PIN-based app lock", "Isolated demo workspace"],
  },
  {
    step: "03",
    eyebrow: "Actionable signal",
    title: "The best output is a better next decision.",
    body:
      "This is not trying to impress you with dashboards. It is trying to tell you what is drifting, what deserves attention now, and what can wait until tomorrow.",
    bullets: ["High-signal watchlists", "Cross-domain context", "Calmer daily steering"],
  },
];

const flow = [
  {
    title: "Capture",
    body: "Track time, review spending, and keep recovery in view without creating another maintenance-heavy system.",
  },
  {
    title: "Read",
    body: "Let the important patterns sit together so the real story becomes obvious faster.",
  },
  {
    title: "Adjust",
    body: "Protect the work block, fix the misleading transaction, scale the day to your actual energy.",
  },
];

const quotes = [
  {
    quote:
      "It feels less like opening a productivity app and more like checking a clean page that already knows what matters.",
    source: "Designed for one person, not a team dashboard.",
  },
  {
    quote:
      "The useful part is seeing the categories collide. That is usually where the truth is.",
    source: "Time, money, and recovery belong in the same conversation.",
  },
];

export default function LandingPage() {
  return (
    <main className="bg-[#fbfbfa] text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <section className="relative overflow-hidden border-b border-zinc-200/80 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.08),_transparent_34%),linear-gradient(180deg,#fbfbfa_0%,#f7f7f5_100%)] dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_30%),linear-gradient(180deg,#09090b_0%,#0f172a_100%)]">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(24,24,27,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(24,24,27,0.04)_1px,transparent_1px)] bg-[size:28px_28px] opacity-50 dark:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] dark:opacity-30" />

        <div className="relative mx-auto max-w-7xl px-6 pb-16 pt-6 sm:px-8 sm:pb-24 sm:pt-8">
          <header className="sticky top-0 z-30 rounded-full border border-zinc-200/80 bg-white/85 px-4 py-3 backdrop-blur xl:px-6 dark:border-zinc-800 dark:bg-zinc-900/70">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-900 dark:bg-sky-400" />
                <span className="font-mono text-xs uppercase tracking-[0.34em] text-zinc-500 dark:text-zinc-300">aucosto</span>
              </div>
              <nav className="hidden items-center gap-6 text-sm text-zinc-500 md:flex dark:text-zinc-400">
                <a href="#features" className="transition-colors hover:text-zinc-950 dark:hover:text-white">Features</a>
                <a href="#how-it-works" className="transition-colors hover:text-zinc-950 dark:hover:text-white">How it works</a>
                <a href="#why" className="transition-colors hover:text-zinc-950 dark:hover:text-white">Why it works</a>
              </nav>
              <div className="flex items-center gap-3">
                <span className="hidden rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-medium text-zinc-600 sm:inline-flex dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                  Private beta
                </span>
                <Link
                  href="/login"
                  className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-950 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </header>

          <section className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(380px,0.92fr)] lg:items-center">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-600 shadow-sm dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200">
                A cleaner read on your actual life
              </div>
              <h1 className="mt-6 text-5xl font-semibold leading-[0.94] tracking-[-0.055em] text-zinc-950 sm:text-6xl lg:text-[5.7rem] dark:text-white">
                A better place to
                <br />
                understand how
                <br />
                your day, money,
                <br />
                and energy are going.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-600 sm:text-lg dark:text-zinc-300">
                Aucosto brings together time, spending, recovery, and the next thing that needs attention so you can make sharper decisions before the drift gets expensive.
              </p>

              <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-950 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  Open aucosto
                </Link>
                <a
                  href="#features"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-200 bg-white px-6 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-white dark:hover:bg-zinc-900"
                >
                  Explore the system
                </a>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">Private, local-first, and built for daily use.</span>
              </div>
            </div>

            <aside className="rounded-[2rem] border border-zinc-200/80 bg-white/95 p-4 shadow-[0_24px_80px_-42px_rgba(24,24,27,0.18)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70 dark:shadow-[0_40px_120px_-50px_rgba(0,0,0,0.82)]">
              <div className="rounded-[1.7rem] border border-zinc-200 bg-[#fcfcfb] p-5 dark:border-zinc-800 dark:bg-[linear-gradient(180deg,rgba(10,18,32,0.98),rgba(4,8,14,0.98))]">
                <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-white/10">
                  <div>
                    <p className="text-sm font-medium text-zinc-950 dark:text-white">Daily overview</p>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      A high-signal read on the day without pretending your life comes in separate apps.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                    Live
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  {heroStats.map((item) => (
                    <article key={item.label} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-black/20">
                      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">{item.label}</p>
                      <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white">{item.value}</p>
                      <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{item.note}</p>
                    </article>
                  ))}
                </div>

                <div className="mt-4 rounded-[1.4rem] border border-zinc-200 bg-zinc-50 p-4 dark:border-sky-400/15 dark:bg-[linear-gradient(180deg,rgba(12,24,40,0.96),rgba(6,10,17,1))]">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-zinc-950 dark:text-white">What needs attention</p>
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-sky-300">Today</p>
                  </div>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                    <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-zinc-900 dark:bg-sky-400" /><span>That Costco payment is inflating spend. Fix the category before you trust the month.</span></li>
                    <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-zinc-900 dark:bg-sky-400" /><span>You still have enough energy for one serious block of work. Protect it now or lose it.</span></li>
                    <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-zinc-900 dark:bg-sky-400" /><span>Recovery is improving. Good moment to push a little harder without being reckless.</span></li>
                  </ul>
                </div>
              </div>
            </aside>
          </section>
        </div>
      </section>

      <section className="border-b border-zinc-200/80 bg-[#f7f7f5] py-5 dark:border-white/10 dark:bg-black/30">
        <div className="mx-auto grid max-w-7xl gap-4 px-6 sm:grid-cols-3 sm:px-8">
          {trustStats.map((item) => (
            <div key={item.label} className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white">{item.value}</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="bg-[#fbfbfa] px-6 py-16 sm:px-8 sm:py-24 dark:bg-[#060b12]">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-zinc-500 dark:text-sky-300">Features</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-zinc-950 sm:text-5xl dark:text-white">
              Built for reading the whole system,
              <br />
              not just collecting more numbers.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-600 sm:text-lg dark:text-zinc-400">
              Most tools isolate a single category and leave you to interpret the rest. Aucosto is more useful when the categories are allowed to collide.
            </p>
          </div>

          <div className="mt-10 space-y-4">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="grid gap-6 rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-[0_16px_50px_-40px_rgba(24,24,27,0.14)] sm:p-8 lg:grid-cols-[160px_minmax(0,1fr)_320px] lg:items-start dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none"
              >
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.24em] text-zinc-400 dark:text-zinc-500">{feature.step}</p>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-sky-300">{feature.eyebrow}</p>
                </div>
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl dark:text-white">{feature.title}</h3>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600 sm:text-base dark:text-zinc-400">{feature.body}</p>
                </div>
                <ul className="space-y-3 rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-white/10 dark:bg-black/20 dark:text-zinc-300">
                  {feature.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-zinc-900 dark:bg-sky-400" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-zinc-200/80 bg-[#f7f7f5] px-6 py-16 sm:px-8 sm:py-24 dark:border-white/10 dark:bg-[#04070c]">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-zinc-500 dark:text-sky-300">How it works</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-zinc-950 sm:text-5xl dark:text-white">
              Capture. Read. Adjust.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {flow.map((item, index) => (
              <article key={item.title} className="rounded-[2rem] border border-zinc-200 bg-white p-6 sm:p-8 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-sm font-medium text-zinc-500 dark:border-white/10 dark:text-zinc-300">
                  0{index + 1}
                </div>
                <h3 className="mt-5 text-2xl font-semibold text-zinc-950 dark:text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-zinc-600 sm:text-base dark:text-zinc-400">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="why" className="bg-[#fbfbfa] px-6 py-16 sm:px-8 sm:py-24 dark:bg-[#07101b]">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 lg:grid-cols-2">
            {quotes.map((item) => (
              <article key={item.quote} className="rounded-[2rem] border border-zinc-200 bg-white p-6 sm:p-8 dark:border-white/10 dark:bg-white/[0.04]">
                <p className="text-2xl font-medium leading-10 text-zinc-950 sm:text-3xl sm:leading-[1.45] dark:text-white">“{item.quote}”</p>
                <p className="mt-6 text-sm uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">{item.source}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-200/80 bg-[#f7f7f5] px-6 py-16 sm:px-8 sm:py-24 dark:border-white/10 dark:bg-[linear-gradient(180deg,#04070c_0%,#081221_100%)]">
        <div className="mx-auto max-w-7xl rounded-[2.4rem] border border-zinc-200 bg-white p-6 shadow-[0_24px_80px_-42px_rgba(24,24,27,0.12)] sm:p-10 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-zinc-500 dark:text-sky-300">A different kind of personal tool</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-zinc-950 sm:text-5xl dark:text-white">
                Premium signal,
                <br />
                but with a calmer surface.
              </h2>
              <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-600 sm:text-lg dark:text-zinc-400">
                Strong opinionated design. Serious daily use. Privacy where it matters. Aucosto is trying to be useful in the same way premium performance tools are useful — just with a lighter, cleaner place to read the day.
              </p>
            </div>
            <div className="space-y-3">
              <Link
                href="/login"
                className="inline-flex h-12 w-full items-center justify-center rounded-full bg-zinc-950 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                Open aucosto
              </Link>
              <p className="text-sm text-zinc-500 dark:text-zinc-500">Invite-only for now. Real data stays private.</p>
            </div>
          </div>
        </div>

        <footer className="mx-auto mt-8 max-w-7xl px-1 text-sm text-zinc-500 dark:text-zinc-500">
          <div className="flex flex-col gap-3 border-t border-zinc-200 pt-6 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
            <p>aucosto — personal performance, but for your actual life.</p>
            <div className="flex gap-4">
              <a href="#features" className="hover:text-zinc-950 dark:hover:text-zinc-300">Features</a>
              <a href="#how-it-works" className="hover:text-zinc-950 dark:hover:text-zinc-300">How it works</a>
              <Link href="/login" className="hover:text-zinc-950 dark:hover:text-zinc-300">Sign in</Link>
            </div>
          </div>
        </footer>
      </section>
    </main>
  );
}
