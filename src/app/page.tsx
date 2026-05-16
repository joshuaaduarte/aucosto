import Link from "next/link";
import { Parallax } from "./landing-parallax";

const topStats = [
  { label: "Focus", value: "4.5h" },
  { label: "Cash", value: "$6.2k" },
  { label: "Recovery", value: "82%" },
];

const surfaces = [
  {
    title: "Today",
    tone: "bg-sky-50",
    items: ["Move deep work earlier", "Protein is low for training", "Fix one misleading transaction"],
  },
  {
    title: "Health",
    tone: "bg-emerald-50",
    items: ["2,140 / 2,300 kcal", "168g protein", "74 oz water"],
  },
  {
    title: "Planning",
    tone: "bg-violet-50",
    items: ["Trip in 4 days", "Leave at 5:40 PM", "3 errands on one route"],
  },
  {
    title: "Home",
    tone: "bg-amber-50",
    items: ["Doors locked", "$74 subscriptions", "Restock paper towels"],
  },
];

const tools = [
  {
    title: "Food + body",
    chips: ["calories", "protein", "weight", "water"],
    visual: [72, 58, 81, 66],
  },
  {
    title: "Projects + habits",
    chips: ["deep work", "tasks", "follow-ups", "habits"],
    visual: [84, 41, 63, 77],
  },
  {
    title: "Calendar + travel",
    chips: ["agenda", "trips", "packing", "errands"],
    visual: [38, 69, 56, 88],
  },
  {
    title: "Home + life ops",
    chips: ["wishlist", "subscriptions", "shopping", "IoT"],
    visual: [61, 43, 78, 57],
  },
];

const reasons = [
  "Less guessing",
  "Less tab switching",
  "Less decision fatigue",
  "More useful context",
];

export default function LandingPage() {
  return (
    <main className="overflow-hidden bg-[#fbfbfa] text-zinc-950">
      <section className="relative border-b border-zinc-200/80 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.1),_transparent_34%),linear-gradient(180deg,#fbfbfa_0%,#f6f6f3_100%)]">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(24,24,27,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(24,24,27,0.035)_1px,transparent_1px)] bg-[size:28px_28px] opacity-50" />
        <Parallax speed={0.05} className="pointer-events-none absolute -left-16 top-20 hidden h-56 w-56 rounded-full bg-sky-200/40 blur-3xl lg:block" />
        <Parallax speed={0.08} className="pointer-events-none absolute right-0 top-10 hidden h-64 w-64 rounded-full bg-violet-200/30 blur-3xl lg:block" />

        <div className="relative mx-auto max-w-7xl px-6 pb-16 pt-6 sm:px-8 sm:pb-24 sm:pt-8">
          <header className="z-30 rounded-2xl border border-zinc-200/80 bg-white/92 px-4 py-3 shadow-sm backdrop-blur sm:sticky sm:top-3 sm:rounded-full xl:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-900" />
                <span className="font-mono text-xs uppercase tracking-[0.34em] text-zinc-500">aucosto</span>
              </div>
              <nav className="hidden items-center gap-6 text-sm text-zinc-500 md:flex">
                <a href="#surfaces" className="transition-colors hover:text-zinc-950">Surfaces</a>
                <a href="#tools" className="transition-colors hover:text-zinc-950">Tools</a>
                <a href="#cta" className="transition-colors hover:text-zinc-950">Open it</a>
              </nav>
              <Link
                href="/login"
                className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-950 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
              >
                Sign in
              </Link>
            </div>
          </header>

          <div className="mt-10 grid gap-8 lg:mt-12 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-center">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-600 shadow-sm">
                One home for daily life
              </div>
              <h1 className="mt-6 text-4xl font-semibold leading-[0.96] tracking-[-0.05em] text-zinc-950 sm:text-6xl lg:text-[5.8rem]">
                The app that helps
                <br />
                you run your life
                <br />
                without fighting it.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-600 sm:text-lg">
                Time, money, health, planning, home, and the next decision — together.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  href="/login"
                  className="inline-flex h-12 w-full items-center justify-center rounded-full bg-zinc-950 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-800 sm:w-auto"
                >
                  Open aucosto
                </Link>
                <a
                  href="#tools"
                  className="inline-flex h-12 w-full items-center justify-center rounded-full border border-zinc-200 bg-white px-6 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 sm:w-auto"
                >
                  See the toolset
                </a>
              </div>

              <div className="mt-8 flex flex-wrap gap-2.5">
                {reasons.map((reason) => (
                  <span key={reason} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600">
                    {reason}
                  </span>
                ))}
              </div>
            </div>

            <Parallax speed={-0.04} minWidth={1200}>
              <aside className="rounded-[2rem] border border-zinc-200/80 bg-white/95 p-4 shadow-[0_24px_80px_-42px_rgba(24,24,27,0.18)] backdrop-blur">
                <div className="rounded-[1.7rem] border border-zinc-200 bg-[#fcfcfb] p-5">
                  <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4">
                    <div>
                      <p className="text-sm font-medium text-zinc-950">Daily brief</p>
                      <p className="mt-1 text-sm text-zinc-500">What matters, before the day runs away.</p>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Live
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {topStats.map((item) => (
                      <article key={item.label} className="rounded-2xl border border-zinc-200 bg-white p-4">
                        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">{item.label}</p>
                        <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">{item.value}</p>
                      </article>
                    ))}
                  </div>

                  <div className="mt-4 rounded-[1.4rem] border border-zinc-200 bg-zinc-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-zinc-950">Today</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Guidance</p>
                    </div>
                    <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-600">
                      <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-zinc-900" /><span>Move the hard work block earlier.</span></li>
                      <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-zinc-900" /><span>Fix one misleading finance category.</span></li>
                      <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-zinc-900" /><span>Eat for the workout you still want tonight.</span></li>
                    </ul>
                  </div>
                </div>
              </aside>
            </Parallax>
          </div>
        </div>
      </section>

      <section id="surfaces" className="border-b border-zinc-200/80 bg-[#f7f7f5] px-6 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-zinc-500">Surfaces</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-zinc-950 sm:text-5xl">
              Fewer words.
              <br />
              More of the actual product.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {surfaces.map((surface, index) => (
              <Parallax key={surface.title} speed={index % 2 === 0 ? 0.03 : 0.06} minWidth={1200}>
                <article className={`rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-[0_16px_50px_-40px_rgba(24,24,27,0.14)] transition-transform duration-300 md:hover:-translate-y-1`}>
                  <div className={`rounded-[1.4rem] border border-zinc-200 p-4 ${surface.tone}`}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-zinc-950">{surface.title}</p>
                      <span className="h-2 w-2 rounded-full bg-zinc-900" />
                    </div>
                    <ul className="mt-4 space-y-2 text-sm leading-6 text-zinc-600">
                      {surface.items.map((item) => (
                        <li key={item} className="rounded-xl bg-white/80 px-3 py-2">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              </Parallax>
            ))}
          </div>
        </div>
      </section>

      <section id="tools" className="bg-[#fbfbfa] px-6 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-zinc-500">Toolset</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-zinc-950 sm:text-5xl">
              The only app you need
              <br />
              for the small decisions.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-600 sm:text-lg">
              Each tool solves a real problem. Together, they reduce friction across the whole day.
            </p>
          </div>

          <div className="mt-10 grid gap-5 xl:grid-cols-2">
            {tools.map((tool, index) => (
              <Parallax key={tool.title} speed={index % 2 === 0 ? -0.025 : -0.045} minWidth={1200}>
                <article className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-[0_16px_50px_-40px_rgba(24,24,27,0.14)] transition-transform duration-300 md:hover:-translate-y-1 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-2xl font-semibold tracking-tight text-zinc-950">{tool.title}</p>
                    </div>
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                      Coming into system
                    </span>
                  </div>

                  <div className="mt-5 rounded-[1.6rem] border border-zinc-200 bg-[#fcfcfb] p-4">
                    <div className="grid grid-cols-4 gap-2">
                      {tool.visual.map((height, i) => (
                        <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-2">
                          <div className="flex h-16 items-end rounded-xl bg-zinc-50 p-1 sm:h-24">
                            <div className="w-full rounded-lg bg-gradient-to-t from-zinc-900 via-zinc-700 to-zinc-400" style={{ height: `${height}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {tool.chips.map((chip) => (
                        <span key={chip} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600">
                          {chip}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              </Parallax>
            ))}
          </div>
        </div>
      </section>

      <section id="cta" className="border-t border-zinc-200/80 bg-[#f7f7f5] px-6 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl rounded-[2.4rem] border border-zinc-200 bg-white p-6 shadow-[0_24px_80px_-42px_rgba(24,24,27,0.12)] sm:p-10">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-zinc-500">aucosto</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-zinc-950 sm:text-5xl">
                One home for the things
                <br />
                that keep life running.
              </h2>
              <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-600 sm:text-lg">
                Less scattered tracking. Less repeated thinking. More clarity about what to do next.
              </p>
            </div>
            <div className="space-y-3">
              <Link
                href="/login"
                className="inline-flex h-12 w-full items-center justify-center rounded-full bg-zinc-950 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
              >
                Open aucosto
              </Link>
              <p className="text-sm text-zinc-500">Invite-only for now. Real data stays private.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
