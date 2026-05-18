import Link from "next/link";

const features = [
  {
    index: "01",
    title: "Time",
    body: "Log sessions, not tasks. Open an entry when you start, close it when you switch. The archive builds itself.",
  },
  {
    index: "02",
    title: "Finance",
    body: "True spend separated from transfers and payoffs. Net worth, monthly pace, and the category pulling hardest.",
  },
  {
    index: "03",
    title: "Activity",
    body: "Every meaningful action recorded automatically — started, stopped, imported, cleared — composing a log of the day.",
  },
];

export default function LandingPage() {
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
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 pb-12 pt-10 sm:px-10 sm:pt-16 sm:pb-20">
        <div className="fade-in max-w-2xl">
          <p
            className="mb-5 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-ink-fade"
          >
            Personal dashboard
          </p>
          <h1
            className="text-[3rem] font-semibold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[4rem] lg:text-[5rem]"
          >
            Your time and money,
            <br />
            <span style={{ color: "var(--verdigris)" }}>in one place.</span>
          </h1>
          <p className="fade-in-delay-1 mt-6 max-w-lg text-[1.0625rem] leading-[1.7] text-ink-fade">
            Track hours, understand finances, and know where your day actually went — without switching between tools.
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
      </main>

      {/* Feature strip */}
      <section
        id="tools"
        className="border-t"
        style={{ borderColor: "var(--rule-soft)" }}
      >
        <div className="mx-auto w-full max-w-5xl px-6 py-12 sm:px-10 sm:py-16">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-6 lg:gap-10">
            {features.map((f) => (
              <div key={f.index} className="space-y-3">
                <div className="flex items-center gap-3">
                  <span
                    className="font-mono text-[0.6875rem] tracking-[0.12em] text-ink-ghost"
                  >
                    {f.index}
                  </span>
                  <div
                    className="h-px flex-1"
                    style={{ background: "var(--rule-soft)" }}
                  />
                </div>
                <h3 className="text-base font-semibold tracking-[-0.01em] text-ink">
                  {f.title}
                </h3>
                <p className="text-sm leading-[1.65] text-ink-fade">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="border-t"
        style={{ borderColor: "var(--rule-faint)" }}
      >
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
