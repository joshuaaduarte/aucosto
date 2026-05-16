import Link from "next/link";

const heroStats = [
  {
    value: "4.5h",
    label: "Focused work",
    note: "deep work protected before the day fell apart",
  },
  {
    value: "$6.2k",
    label: "Cash on hand",
    note: "stable, with a couple transactions worth cleaning up",
  },
  {
    value: "82%",
    label: "Recovery",
    note: "good enough to push, not good enough to waste",
  },
];

const trustStats = [
  { value: "24/7", label: "personal context across the day" },
  { value: "3", label: "systems finally brought together" },
  { value: "1", label: "private place to read what matters" },
  { value: "0", label: "interest in social productivity theater" },
];

const features = [
  {
    step: "01",
    eyebrow: "Daily overview",
    title: "See time, money, and recovery in one read.",
    body:
      "Aucosto puts the important signals next to each other so you can understand the shape of the day without switching between tools and rebuilding the context in your head.",
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
      "This is not trying to win a dashboard beauty contest. It is trying to tell you what is drifting, what deserves attention now, and what can wait until tomorrow.",
    bullets: ["High-signal watchlists", "Cross-domain context", "Calmer daily steering"],
  },
];

const flow = [
  {
    title: "Capture",
    body: "Track time, review spending, and keep recovery in view without creating more admin for yourself.",
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
      "It feels less like opening a productivity app and more like checking a well-kept control room for your actual life.",
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
    <main className="bg-[#04070c] text-white">
      <div className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_30%),radial-gradient(circle_at_80%_18%,_rgba(99,102,241,0.18),_transparent_24%),linear-gradient(180deg,#04070c_0%,#06101d_46%,#091526_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] opacity-30" />
        <div className="absolute -left-24 top-24 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-6 pb-16 pt-6 sm:px-8 sm:pb-24 sm:pt-8">
          <header className="sticky top-0 z-30 rounded-full border border-white/10 bg-black/20 px-4 py-3 backdrop-blur xl:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_18px_rgba(56,189,248,0.7)]" />
                <span className="font-mono text-xs uppercase tracking-[0.34em] text-zinc-300">aucosto</span>
              </div>
              <nav className="hidden items-center gap-6 text-sm text-zinc-400 md:flex">
                <a href="#features" className="transition-colors hover:text-white">Features</a>
                <a href="#how-it-works" className="transition-colors hover:text-white">How it works</a>
                <a href="#why" className="transition-colors hover:text-white">Why it works</a>
              </nav>
              <div className="flex items-center gap-3">
                <span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-zinc-300 sm:inline-flex">
                  Private beta
                </span>
                <Link
                  href="/login"
                  className="inline-flex h-10 items-center justify-center rounded-full bg-white px-4 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-200"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </header>

          <section className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(380px,0.92fr)] lg:items-center">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-sky-200">
                Premium signal for your actual life
              </div>
              <h1 className="mt-6 text-5xl font-semibold leading-[0.92] tracking-[-0.055em] text-white sm:text-6xl lg:text-[6rem]">
                A better read on
                <br />
                how your day,
                <br />
                money, and energy
                <br />
                are really going.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-300 sm:text-lg">
                Aucosto brings together time, spending, recovery, and the next thing that needs attention so you can make sharper decisions before the drift gets expensive.
              </p>

              <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-200"
                >
                  Open aucosto
                </Link>
                <a
                  href="#features"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 text-sm font-medium text-white transition-colors hover:bg-white/10"
                >
                  Explore the system
                </a>
                <span className="text-sm text-zinc-400">Private, local-first, and built for daily use.</span>
              </div>
            </div>

            <aside className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 shadow-[0_40px_120px_-50px_rgba(0,0,0,0.82)] backdrop-blur-xl">
              <div className="rounded-[1.7rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.98),rgba(4,8,14,0.98))] p-5">
                <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <p className="text-sm font-medium text-white">Daily overview</p>
                    <p className="mt-1 text-sm text-zinc-400">
                      A high-signal read on performance without pretending your life comes in separate apps.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  {heroStats.map((item) => (
                    <article key={item.label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">{item.label}</p>
                      <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{item.value}</p>
                      <p className="mt-2 text-sm leading-6 text-zinc-400">{item.note}</p>
                    </article>
                  ))}
                </div>

                <div className="mt-4 rounded-[1.4rem] border border-sky-400/15 bg-[linear-gradient(180deg,rgba(12,24,40,0.96),rgba(6,10,17,1))] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">What needs attention</p>
                    <p className="text-xs uppercase tracking-[0.18em] text-sky-300">Today</p>
                  </div>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-300">
                    <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-sky-400" /><span>That Costco payment is inflating spend. Fix the category before you trust the month.</span></li>
                    <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-sky-400" /><span>You still have enough energy for one serious block of work. Protect it now or lose it.</span></li>
                    <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-sky-400" /><span>Recovery is improving. Good moment to push a little harder without being reckless.</span></li>
                  </ul>
                </div>
              </div>
            </aside>
          </section>
        </div>
      </div>

      <section className="border-b border-white/10 bg-black/30 py-5">
        <div className="mx-auto grid max-w-7xl gap-4 px-6 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
          {trustStats.map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
              <p className="text-3xl font-semibold tracking-tight text-white">{item.value}</p>
              <p className="mt-1 text-sm text-zinc-400">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="bg-[#060b12] px-6 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-sky-300">Features</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
              Built for reading the whole system,
              <br />
              not just collecting more numbers.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-400 sm:text-lg">
              Most tools isolate a single category and leave you to interpret the rest. Aucosto is more useful when the categories are allowed to collide.
            </p>
          </div>

          <div className="mt-10 space-y-4">
            {features.map((feature, index) => (
              <article
                key={feature.title}
                className={`grid gap-6 rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 sm:p-8 lg:grid-cols-[160px_minmax(0,1fr)_320px] lg:items-start ${index === 1 ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(56,189,248,0.04))]" : ""}`}
              >
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.24em] text-zinc-500">{feature.step}</p>
                  <p className="mt-2 text-sm text-sky-300">{feature.eyebrow}</p>
                </div>
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{feature.title}</h3>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">{feature.body}</p>
                </div>
                <ul className="space-y-3 rounded-[1.5rem] border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
                  {feature.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-sky-400" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-white/10 bg-[#04070c] px-6 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-sky-300">How it works</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
              Capture. Read. Adjust.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {flow.map((item, index) => (
              <article key={item.title} className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-sm font-medium text-zinc-300">
                  0{index + 1}
                </div>
                <h3 className="mt-5 text-2xl font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-zinc-400 sm:text-base">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="why" className="bg-[#07101b] px-6 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 lg:grid-cols-2">
            {quotes.map((item) => (
              <article key={item.quote} className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
                <p className="text-2xl font-medium leading-10 text-white sm:text-3xl sm:leading-[1.45]">“{item.quote}”</p>
                <p className="mt-6 text-sm uppercase tracking-[0.2em] text-zinc-500">{item.source}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[linear-gradient(180deg,#04070c_0%,#081221_100%)] px-6 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl rounded-[2.4rem] border border-white/10 bg-white/[0.04] p-6 sm:p-10">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-sky-300">A different kind of personal tool</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
                Premium signal,
                <br />
                but for the whole shape of your life.
              </h2>
              <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-400 sm:text-lg">
                Strong opinionated design. Serious daily use. Privacy where it matters. Aucosto is trying to be useful in the same way premium performance tools are useful — just aimed at time, money, and recovery together instead of physiology alone.
              </p>
            </div>
            <div className="space-y-3">
              <Link
                href="/login"
                className="inline-flex h-12 w-full items-center justify-center rounded-full bg-white px-6 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-200"
              >
                Open aucosto
              </Link>
              <p className="text-sm text-zinc-500">Invite-only for now. Real data stays private.</p>
            </div>
          </div>
        </div>

        <footer className="mx-auto mt-8 max-w-7xl px-1 text-sm text-zinc-500">
          <div className="flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p>aucosto — personal performance, but for your actual life.</p>
            <div className="flex gap-4">
              <a href="#features" className="hover:text-zinc-300">Features</a>
              <a href="#how-it-works" className="hover:text-zinc-300">How it works</a>
              <Link href="/login" className="hover:text-zinc-300">Sign in</Link>
            </div>
          </div>
        </footer>
      </section>
    </main>
  );
}
