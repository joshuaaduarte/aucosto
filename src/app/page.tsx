import Link from "next/link";

const signals = [
  {
    label: "TIME",
    value: "4.5h focused",
    note: "enough to make real progress, but only if the afternoon stays protected",
  },
  {
    label: "MONEY",
    value: "$6,240 cash",
    note: "rent and cards are covered, but two transactions still need a second look",
  },
  {
    label: "RECOVERY",
    value: "82%",
    note: "sleep is improving, which makes the whole week feel less brittle",
  },
];

const dayNotes = [
  "Costco payment is inflating spend again. Fix the category before you trust the monthly total.",
  "You keep avoiding one important block of work. Put it on the calendar before lunch disappears.",
  "Weekend energy looks thinner than usual. Plan something lighter instead of pretending you'll rally.",
];

const principles = [
  {
    title: "It reads like a personal tool, not a product demo.",
    body: "Aucosto is meant to feel like something you return to for an honest check-in, not something trying to impress you with polish.",
  },
  {
    title: "The categories are allowed to collide.",
    body: "Time, money, and recovery affect each other constantly. Keeping them apart makes the story harder to read.",
  },
  {
    title: "It is built for ordinary decisions.",
    body: "Not annual planning. Not optimizing your whole existence. Just noticing what is off, what matters today, and what can wait.",
  },
];

const notForEveryone = [
  "If you want a team dashboard, this is the wrong shape.",
  "If you enjoy maintaining complicated systems for their own sake, this will probably feel too plain.",
  "If you want one quiet place to understand the state of your day, this might be your thing.",
];

export default function LandingPage() {
  return (
    <main className="relative overflow-hidden bg-[#f5f1e8] text-zinc-950 dark:bg-[#0f1115] dark:text-zinc-50">
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(rgba(24,24,27,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(24,24,27,0.035)_1px,transparent_1px)] bg-[size:24px_24px] dark:bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)]" />
      <div className="absolute inset-x-0 top-0 -z-10 h-56 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_45%)] dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_40%)]" />

      <section className="px-6 pb-12 pt-12 sm:px-8 sm:pb-16 sm:pt-16">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-900/10 pb-5 dark:border-white/10">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs uppercase tracking-[0.32em] text-zinc-500">aucosto</span>
              <span className="inline-flex rounded-full border border-zinc-900/10 bg-white/70 px-3 py-1 text-[11px] font-medium text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                private beta
              </span>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">A personal operating panel for one real life.</p>
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_360px] lg:items-start">
            <div className="space-y-8">
              <div className="max-w-4xl space-y-5">
                <p className="font-mono text-xs uppercase tracking-[0.26em] text-zinc-500">field notes</p>
                <h1 className="max-w-4xl text-5xl font-semibold leading-[0.96] tracking-[-0.05em] sm:text-6xl lg:text-[5.4rem] dark:text-white">
                  Not a dashboard.
                  <br />
                  A daily read on
                  <br />
                  how your life is actually going.
                </h1>
                <p className="max-w-2xl text-base leading-8 text-zinc-700 sm:text-lg dark:text-zinc-300">
                  Aucosto puts time, spending, and recovery in the same place so you can stop mentally stitching together half a dozen systems just to answer a basic question: what needs attention today?
                </p>
              </div>

              <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-950 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  Sign in
                </Link>
                <Link
                  href="#principles"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-900/15 bg-white/80 px-6 text-sm font-medium text-zinc-800 transition-colors hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
                >
                  See the idea
                </Link>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">Private, quiet, still early.</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {signals.map((signal) => (
                  <article
                    key={signal.label}
                    className="rounded-[1.75rem] border border-zinc-900/10 bg-white/80 p-4 shadow-[0_14px_40px_-28px_rgba(24,24,27,0.35)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none"
                  >
                    <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-zinc-500">{signal.label}</p>
                    <p className="mt-3 text-2xl font-semibold tracking-tight dark:text-zinc-50">{signal.value}</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{signal.note}</p>
                  </article>
                ))}
              </div>
            </div>

            <aside className="relative lg:pt-6">
              <div className="rotate-[-1.4deg] rounded-[1.8rem] border border-zinc-900/10 bg-[#fffdf8] p-5 shadow-[0_28px_80px_-40px_rgba(24,24,27,0.45)] dark:border-white/10 dark:bg-[#171a20] dark:shadow-[0_24px_80px_-45px_rgba(0,0,0,0.75)]">
                <div className="rotate-[1.1deg] rounded-[1.35rem] border border-dashed border-zinc-900/15 bg-white/70 p-5 dark:border-white/10 dark:bg-black/20">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">today’s read</p>
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">The part that matters is the note, not the chart.</p>
                    </div>
                    <span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      live
                    </span>
                  </div>

                  <div className="mt-5 rounded-2xl bg-zinc-950 p-4 text-zinc-50 dark:bg-black">
                    <p className="text-sm font-medium">What the day seems to be saying</p>
                    <ul className="mt-3 space-y-3 text-sm leading-6 text-zinc-300">
                      {dayNotes.map((note) => (
                        <li key={note} className="flex gap-2">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-sky-400" />
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                    <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">Focus</span>
                    <span>Strong start, but only if the afternoon stays protected.</span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">Spend</span>
                    <span>Mostly fine. One or two misleading transactions need cleanup.</span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">Energy</span>
                    <span>Better than last week. Don’t waste it on low-value noise.</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="px-6 pb-6 sm:px-8 sm:pb-8">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-[2rem] border border-zinc-900/10 bg-white/75 p-6 dark:border-white/10 dark:bg-white/[0.04]">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-zinc-500">why it exists</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl dark:text-zinc-50">
              Because most personal systems get fragmented fast.
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-300">
              You end up with notes in one place, budgets in another, sleep data somewhere else, and a vague sense that all of it is connected. Aucosto is an attempt to stop losing that connection.
            </p>
          </div>

          <div className="grid gap-3">
            {notForEveryone.map((item, index) => (
              <div
                key={item}
                className={`rounded-[1.6rem] border p-4 text-sm leading-6 ${
                  index === 2
                    ? "border-sky-200 bg-sky-50/85 text-sky-950 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-100"
                    : "border-zinc-900/10 bg-white/75 text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300"
                }`}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="principles" className="px-6 pb-20 sm:px-8 sm:pb-24">
        <div className="mx-auto max-w-6xl rounded-[2.2rem] border border-zinc-900/10 bg-white/72 p-6 dark:border-white/10 dark:bg-white/[0.04] sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-zinc-500">principles</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl dark:text-zinc-50">
                It should feel more like a notebook with signal than a polished performance machine.
              </h2>
              <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-300">
                The best version of this page does not sound like a startup trying to dominate a category. It sounds like a useful tool that knows exactly what it is for.
              </p>
            </div>

            <div className="space-y-4">
              {principles.map((principle, index) => (
                <article
                  key={principle.title}
                  className="grid gap-3 rounded-[1.6rem] border border-zinc-900/10 bg-[#fffdf8] p-5 dark:border-white/10 dark:bg-black/20 sm:grid-cols-[auto_1fr]"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-900/10 font-mono text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                    0{index + 1}
                  </div>
                  <div>
                    <p className="text-lg font-medium text-zinc-950 dark:text-zinc-50">{principle.title}</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{principle.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
