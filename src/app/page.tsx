import Link from "next/link";

const heroStats = [
  { value: "4.5h", label: "Focused work", note: "protected before the day got noisy" },
  { value: "$6.2k", label: "Cash position", note: "clear enough to act without guessing" },
  { value: "82%", label: "Recovery", note: "strong enough to push, not enough to waste" },
];

const benefits = [
  {
    title: "See the real shape of the day faster",
    body: "Time, money, energy, and planning stop living in separate tabs, so the important pattern shows up sooner.",
  },
  {
    title: "Reduce tiny decisions that quietly burn attention",
    body: "What to eat, what to work on, what to defer, what to bring, what to buy, what to fix first — all easier when the context is already assembled.",
  },
  {
    title: "Use one system instead of maintaining ten half-systems",
    body: "The value is not another tracker. The value is one place where the trackers finally talk to each other.",
  },
];

const decisionAreas = [
  {
    name: "Health + intake",
    outcome: "Eat better, hydrate better, train better, and stop relying on vague memory.",
    tools: ["calories", "protein", "water", "supplements", "weight", "recovery"],
    insight: "Low recovery + low protein + late workout → adjust tomorrow instead of forcing it.",
  },
  {
    name: "Projects + focus",
    outcome: "Know what deserves your best hours and stop letting the day get hijacked.",
    tools: ["projects", "deep work", "tasks", "habits", "follow-ups", "weekly review"],
    insight: "Your hardest project keeps slipping to low-energy windows → move it to morning blocks.",
  },
  {
    name: "Calendar + planning",
    outcome: "Spend less time figuring out logistics and more time actually moving through the day.",
    tools: ["calendar", "trip planning", "packing", "errands", "reminders", "agenda"],
    insight: "Three errands are in the same area as tonight’s dinner reservation → group them into one trip.",
  },
  {
    name: "Home + life ops",
    outcome: "Keep the background systems of life from becoming recurring friction.",
    tools: ["wish lists", "subscriptions", "home devices", "shopping", "maintenance", "IoT"],
    insight: "Air filter, detergent, and dog food all need restocking this week → batch the purchase once.",
  },
];

const mockPanels = [
  {
    title: "Today",
    badge: "Live brief",
    items: [
      "Lunch should be higher protein if you still want to train tonight.",
      "Move the strategy block before 1 PM — energy drops after that.",
      "Reclassify the Costco payment before trusting month-end spend.",
    ],
  },
  {
    title: "Planning",
    badge: "Calendar intelligence",
    items: [
      "Trip to San Diego in 4 days — packing list is 60% complete.",
      "Leave by 5:40 PM to avoid the worst traffic.",
      "Bring charger, laptop stand, and gym clothes.",
    ],
  },
  {
    title: "Body",
    badge: "Health system",
    items: [
      "2,140 / 2,300 calories",
      "168g protein",
      "74 oz water",
      "Recovery trending up for 3 days",
    ],
  },
  {
    title: "Home",
    badge: "Life ops",
    items: [
      "Front door locked",
      "Subscriptions: $74 / mo",
      "Wishlist: 8 tracked items",
      "Restock paper towels this weekend",
    ],
  },
];

const proofNotes = [
  "Time tracking that actually informs planning",
  "Finance that helps with decisions, not just recordkeeping",
  "Private-by-default design with lock and demo mode",
  "A path to food, fitness, projects, travel, home, and more",
];

export default function LandingPage() {
  return (
    <main className="bg-[#fbfbfa] text-zinc-950">
      <section className="relative overflow-hidden border-b border-zinc-200/80 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.08),_transparent_34%),linear-gradient(180deg,#fbfbfa_0%,#f6f6f3_100%)]">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(24,24,27,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(24,24,27,0.035)_1px,transparent_1px)] bg-[size:28px_28px] opacity-50" />

        <div className="relative mx-auto max-w-7xl px-6 pb-16 pt-6 sm:px-8 sm:pb-24 sm:pt-8">
          <header className="sticky top-0 z-30 rounded-full border border-zinc-200/80 bg-white/90 px-4 py-3 backdrop-blur xl:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-900" />
                <span className="font-mono text-xs uppercase tracking-[0.34em] text-zinc-500">aucosto</span>
              </div>
              <nav className="hidden items-center gap-6 text-sm text-zinc-500 md:flex">
                <a href="#why-it-lands" className="transition-colors hover:text-zinc-950">Why it lands</a>
                <a href="#tool-surfaces" className="transition-colors hover:text-zinc-950">Tool surfaces</a>
                <a href="#decision-engine" className="transition-colors hover:text-zinc-950">Decision engine</a>
                <a href="#cta" className="transition-colors hover:text-zinc-950">Open it</a>
              </nav>
              <div className="flex items-center gap-3">
                <span className="hidden rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-medium text-zinc-600 sm:inline-flex">
                  Private beta
                </span>
                <Link
                  href="/login"
                  className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-950 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </header>

          <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(390px,0.92fr)] lg:items-center">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-600 shadow-sm">
                One system for the small decisions that run your life
              </div>
              <h1 className="mt-6 text-5xl font-semibold leading-[0.93] tracking-[-0.055em] text-zinc-950 sm:text-6xl lg:text-[5.8rem]">
                The app that helps you
                <br />
                decide what to do,
                <br />
                what to ignore,
                <br />
                and what needs care now.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-600 sm:text-lg">
                Aucosto is not just a dashboard. It is where your time, money, health, planning, home, and follow-through can eventually live together — so you stop struggling through the same micro decisions with incomplete context.
              </p>

              <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-950 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
                >
                  Open aucosto
                </Link>
                <a
                  href="#tool-surfaces"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-200 bg-white px-6 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
                >
                  See the future system
                </a>
                <span className="text-sm text-zinc-500">Private, local-first, and meant for daily life.</span>
              </div>
            </div>

            <aside className="rounded-[2rem] border border-zinc-200/80 bg-white/95 p-4 shadow-[0_24px_80px_-42px_rgba(24,24,27,0.18)] backdrop-blur">
              <div className="rounded-[1.7rem] border border-zinc-200 bg-[#fcfcfb] p-5">
                <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4">
                  <div>
                    <p className="text-sm font-medium text-zinc-950">Daily brief</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      The point is to reduce friction before it compounds into a bad day.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Live
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  {heroStats.map((item) => (
                    <article key={item.label} className="rounded-2xl border border-zinc-200 bg-white p-4">
                      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">{item.label}</p>
                      <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">{item.value}</p>
                      <p className="mt-2 text-sm leading-6 text-zinc-500">{item.note}</p>
                    </article>
                  ))}
                </div>

                <div className="mt-4 rounded-[1.4rem] border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-zinc-950">What aucosto would tell you</p>
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Today</p>
                  </div>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-600">
                    <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-zinc-900" /><span>Move the hard work block earlier. Your energy is already telling on you.</span></li>
                    <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-zinc-900" /><span>Reclassify the warehouse payment before you trust the spending number.</span></li>
                    <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-zinc-900" /><span>If you still want to train tonight, lunch should be higher protein and water needs to catch up.</span></li>
                  </ul>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-200/80 bg-[#f7f7f5] py-5">
        <div className="mx-auto grid max-w-7xl gap-4 px-6 sm:grid-cols-3 sm:px-8">
          {heroStats.map((item) => (
            <div key={item.label} className="rounded-2xl border border-zinc-200 bg-white px-4 py-4">
              <p className="text-3xl font-semibold tracking-tight text-zinc-950">{item.value}</p>
              <p className="mt-1 text-sm text-zinc-500">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="why-it-lands" className="bg-[#fbfbfa] px-6 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-zinc-500">Why it lands</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-zinc-950 sm:text-5xl">
              Most people do not need more tools.
              <br />
              They need fewer blind spots.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {benefits.map((benefit) => (
              <article key={benefit.title} className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-[0_16px_50px_-40px_rgba(24,24,27,0.14)] sm:p-8">
                <h3 className="text-2xl font-semibold tracking-tight text-zinc-950">{benefit.title}</h3>
                <p className="mt-3 text-sm leading-7 text-zinc-600 sm:text-base">{benefit.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-[0_16px_50px_-40px_rgba(24,24,27,0.14)] sm:p-8">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-zinc-500">Already true of the product direction</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {proofNotes.map((note) => (
                <div key={note} className="flex gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-600">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-zinc-900" />
                  <span>{note}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="tool-surfaces" className="border-y border-zinc-200/80 bg-[#f7f7f5] px-6 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-zinc-500">Tool surfaces</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-zinc-950 sm:text-5xl">
              Not a wish list of features.
              <br />
              A growing system for real daily leverage.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-600 sm:text-lg">
              Each area below is valuable on its own. The bigger payoff is that they share context, so the app can start helping with the next decision instead of just storing another set of records.
            </p>
          </div>

          <div className="mt-10 grid gap-5 xl:grid-cols-2">
            {decisionAreas.map((area, index) => (
              <article
                key={area.name}
                className={`rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-[0_16px_50px_-40px_rgba(24,24,27,0.14)] sm:p-6 ${index % 2 === 1 ? "xl:translate-y-8" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-xl">
                    <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                      {area.name}
                    </span>
                    <p className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">{area.outcome}</p>
                  </div>
                </div>

                <div className="mt-5 rounded-[1.6rem] border border-zinc-200 bg-[#fcfcfb] p-4">
                  <div className="flex items-center justify-between gap-3 border-b border-zinc-200 pb-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-950">Mock workspace</p>
                      <p className="mt-1 text-xs text-zinc-500">What this could feel like inside aucosto</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">Guided</span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {area.tools.map((tool) => (
                      <span key={tool} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600">
                        {tool}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-zinc-950">What aucosto would notice</p>
                      <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">Insight</span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-zinc-600">{area.insight}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="decision-engine" className="bg-[#fbfbfa] px-6 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[420px_minmax(0,1fr)] lg:items-start">
          <div className="lg:sticky lg:top-24">
            <div className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-[0_24px_80px_-42px_rgba(24,24,27,0.16)]">
              <div className="rounded-[1.6rem] border border-zinc-200 bg-[#fcfcfb] p-4">
                <div className="flex items-center justify-between gap-3 border-b border-zinc-200 pb-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-950">The decision engine</p>
                    <p className="mt-1 text-xs text-zinc-500">The more life lives here, the better the suggestions get.</p>
                  </div>
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-600">Preview</span>
                </div>

                <div className="mt-4 space-y-3">
                  {mockPanels.map((panel) => (
                    <div key={panel.title} className="rounded-2xl border border-zinc-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-zinc-950">{panel.title}</p>
                        <span className="rounded-full bg-zinc-50 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                          {panel.badge}
                        </span>
                      </div>
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-600">
                        {panel.items.map((item) => (
                          <li key={item} className="flex gap-2">
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-zinc-900" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="max-w-2xl">
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-zinc-500">Decision engine</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-zinc-950 sm:text-5xl">
                The real benefit is not tracking more.
                <br />
                It is struggling less.
              </h2>
              <p className="mt-5 text-base leading-8 text-zinc-600 sm:text-lg">
                When one app knows your calendar, your food, your workload, your cash pressure, your habits, your trip prep, and your home routines, it can start removing friction instead of just observing it.
              </p>
            </div>

            {decisionAreas.map((area, index) => (
              <article key={area.name} className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-[0_16px_50px_-40px_rgba(24,24,27,0.14)] sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.24em] text-zinc-400">0{index + 1}</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">{area.name}</h3>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-7 text-zinc-600 sm:text-base">{area.outcome}</p>
                <p className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm leading-7 text-zinc-700">
                  <span className="font-medium text-zinc-950">Why it matters:</span> {area.insight}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="cta" className="border-t border-zinc-200/80 bg-[#f7f7f5] px-6 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl rounded-[2.4rem] border border-zinc-200 bg-white p-6 shadow-[0_24px_80px_-42px_rgba(24,24,27,0.12)] sm:p-10">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-zinc-500">A different kind of personal tool</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-zinc-950 sm:text-5xl">
                One app to help run the parts of life
                <br />
                that should not require this much effort.
              </h2>
              <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-600 sm:text-lg">
                The goal is simple: fewer tabs, fewer forgotten details, fewer repeated decisions, and a much clearer sense of what to do next.
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

        <footer className="mx-auto mt-8 max-w-7xl px-1 text-sm text-zinc-500">
          <div className="flex flex-col gap-3 border-t border-zinc-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p>aucosto — one home for the small decisions behind a well-run life.</p>
            <div className="flex gap-4">
              <a href="#why-it-lands" className="hover:text-zinc-950">Why it lands</a>
              <a href="#tool-surfaces" className="hover:text-zinc-950">Tool surfaces</a>
              <Link href="/login" className="hover:text-zinc-950">Sign in</Link>
            </div>
          </div>
        </footer>
      </section>
    </main>
  );
}
