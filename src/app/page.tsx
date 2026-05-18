import Link from "next/link";

const tools = [
  {
    index: "01",
    title: "Time",
    body: "Log sessions, not tasks. Open an entry when you start, close it when you switch. The archive builds itself.",
    status: "live" as const,
    href: "/app/time",
  },
  {
    index: "02",
    title: "Finance",
    body: "True spend separated from transfers and payoffs. Net worth, monthly pace, and the category pulling hardest.",
    status: "live" as const,
    href: "/app/finance",
  },
  {
    index: "03",
    title: "Calories",
    body: "Log meals, track macros, and see how your eating patterns shape your week — not just the day.",
    status: "soon" as const,
  },
  {
    index: "04",
    title: "Meal Planning",
    body: "Plan the week ahead. Grocery lists generated automatically. Nothing falls through the gap between intention and the fridge.",
    status: "soon" as const,
  },
  {
    index: "05",
    title: "Fitness",
    body: "Workouts, lifts, runs — logged once, visible across every tool that cares about your output and recovery.",
    status: "soon" as const,
  },
  {
    index: "06",
    title: "Projects",
    body: "Tasks and milestones linked to the hours you actually spend. No estimating theatre — just what the log says.",
    status: "soon" as const,
  },
  {
    index: "07",
    title: "IOT Hub",
    body: "Your devices, your sensors — sleep quality, temperature, activity — feeding into a single readable stream.",
    status: "soon" as const,
  },
  {
    index: "08",
    title: "And more",
    body: "Habits, notes, calendar sync, a personal CRM. The hub grows alongside what you actually need.",
    status: "soon" as const,
  },
];

const connections = [
  {
    a: "Time",
    b: "Projects",
    insight: "Honest velocity — hours logged against milestones, not estimates.",
  },
  {
    a: "Finance",
    b: "Meal Planning",
    insight: "Real cost of eating — what you planned, what you spent, what drifted.",
  },
  {
    a: "Fitness",
    b: "Time",
    insight: "Energy vs. output — see if hard training weeks cost you focus.",
  },
  {
    a: "IOT",
    b: "Calories",
    insight: "Sleep and intake together — the picture most apps refuse to show.",
  },
];

export default function LandingPage() {
  const liveCount = tools.filter((t) => t.status === "live").length;

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: "var(--paper)", color: "var(--ink)" }}>
      {/* Top bar */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6 sm:px-10 sm:py-8">
        <span
          className="text-[1.1rem] font-semibold tracking-[-0.04em]"
          style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}
        >
          aucosto
        </span>
        <Link
          href="/login"
          className="flex items-center gap-1.5 text-sm font-medium text-ink-fade transition-colors hover:text-ink"
        >
          Sign in
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M3 7h8M7.5 3.5 11 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </header>

      {/* Hero */}
      <main className="mx-auto flex w-full max-w-5xl flex-col px-6 pb-12 pt-10 sm:px-10 sm:pt-16 sm:pb-20">
        <div className="fade-in max-w-2xl">
          <p className="mb-5 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-ink-fade">
            Personal dashboard
          </p>
          <h1 className="text-[3rem] font-semibold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[4rem] lg:text-[5rem]">
            Every tool you need,
            <br />
            <span style={{ color: "var(--verdigris)" }}>talking to each other.</span>
          </h1>
          <p className="fade-in-delay-1 mt-6 max-w-lg text-[1.0625rem] leading-[1.7] text-ink-fade">
            Time, money, food, fitness, projects, devices — all in one place, all sharing context.
            The insight you want is usually hiding at the intersection of two tools. Aucosto puts them together.
          </p>
          <div className="fade-in-delay-2 mt-9 flex flex-wrap items-center gap-4">
            <Link href="/login" className="btn-ink">
              Open your dashboard
            </Link>
            <a
              href="#tools"
              className="text-sm font-medium text-ink-fade transition-colors hover:text-ink"
            >
              See the tools ↓
            </a>
          </div>
        </div>

        {/* Live count pill */}
        <div className="fade-in-delay-3 mt-16 flex items-center gap-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.6875rem] font-medium font-mono uppercase tracking-[0.1em]"
            style={{
              background: "var(--verdigris-soft)",
              color: "var(--verdigris)",
            }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--verdigris)" }}
            />
            {liveCount} live now
          </span>
          <span className="text-[0.8125rem] text-ink-ghost">
            {tools.length - liveCount} more in progress
          </span>
        </div>
      </main>

      {/* Tools grid */}
      <section
        id="tools"
        className="border-t"
        style={{ borderColor: "var(--rule-soft)" }}
      >
        <div className="mx-auto w-full max-w-5xl px-6 py-12 sm:px-10 sm:py-16">
          <div className="mb-10">
            <p className="eyebrow">The toolkit</p>
          </div>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {tools.map((tool) => (
              <div
                key={tool.index}
                className="group space-y-3"
                style={{ opacity: tool.status === "soon" ? 0.55 : 1 }}
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[0.6875rem] tracking-[0.12em] text-ink-ghost">
                    {tool.index}
                  </span>
                  <div className="h-px flex-1" style={{ background: "var(--rule-soft)" }} />
                  {tool.status === "live" ? (
                    <span
                      className="font-mono text-[0.6rem] uppercase tracking-[0.12em]"
                      style={{ color: "var(--verdigris)" }}
                    >
                      live
                    </span>
                  ) : (
                    <span
                      className="font-mono text-[0.6rem] uppercase tracking-[0.12em]"
                      style={{ color: "var(--ink-ghost)" }}
                    >
                      soon
                    </span>
                  )}
                </div>
                <h3 className="text-base font-semibold tracking-[-0.01em] text-ink">
                  {tool.title}
                </h3>
                <p className="text-sm leading-[1.65] text-ink-fade">{tool.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Connections section */}
      <section
        className="border-t"
        style={{ borderColor: "var(--rule-soft)" }}
      >
        <div className="mx-auto w-full max-w-5xl px-6 py-12 sm:px-10 sm:py-16">
          <div className="mb-10 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow mb-2">Connected intelligence</p>
              <h2 className="text-[1.5rem] font-semibold tracking-[-0.025em] text-ink sm:text-[1.875rem]">
                The insight lives at the intersection.
              </h2>
            </div>
            <p className="max-w-xs text-sm leading-[1.65] text-ink-fade">
              Tools share context automatically — no copy-paste, no spreadsheet bridges.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {connections.map((c) => (
              <div
                key={`${c.a}-${c.b}`}
                className="rounded-lg p-5"
                style={{
                  background: "var(--paper-deep)",
                  border: "1px solid var(--rule-soft)",
                }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className="rounded px-2 py-0.5 font-mono text-[0.6875rem] font-medium"
                    style={{ background: "var(--paper-well)", color: "var(--ink-soft)" }}
                  >
                    {c.a}
                  </span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden style={{ color: "var(--ink-ghost)" }}>
                    <path d="M2 6h8M6.5 2.5 10 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span
                    className="rounded px-2 py-0.5 font-mono text-[0.6875rem] font-medium"
                    style={{ background: "var(--paper-well)", color: "var(--ink-soft)" }}
                  >
                    {c.b}
                  </span>
                </div>
                <p className="text-sm leading-[1.6] text-ink-fade">{c.insight}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section
        className="border-t"
        style={{ borderColor: "var(--rule-soft)" }}
      >
        <div className="mx-auto flex w-full max-w-5xl flex-col items-start gap-5 px-6 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-10 sm:py-16">
          <div>
            <h2 className="text-[1.5rem] font-semibold tracking-[-0.025em] text-ink sm:text-[1.875rem]">
              Built for one person.
              <br />
              <span style={{ color: "var(--ink-fade)" }}>Designed to understand all of them.</span>
            </h2>
          </div>
          <Link href="/login" className="btn-ink shrink-0">
            Open your dashboard →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t" style={{ borderColor: "var(--rule-faint)" }}>
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5 sm:px-10">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ink-ghost">
            Aucosto · Built for one.
          </p>
          <Link
            href="/login"
            className="text-sm font-medium text-ink-fade transition-colors hover:text-ink"
          >
            Sign in →
          </Link>
        </div>
      </footer>
    </div>
  );
}
