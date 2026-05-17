import Link from "next/link";
import { Parallax } from "./landing-parallax";

const todayStats = [
  { label: "Filed today", value: "4h 30m", caption: "blocks of deep work" },
  { label: "Net at hand", value: "$6,214", caption: "across cash + savings" },
  { label: "Recovery", value: "82", caption: "out of 100, this morning" },
];

const briefs = [
  {
    eyebrow: "Hours",
    title: "Move the writing block to the morning.",
    note: "Three afternoon dispatches in the past week ran past their planned close.",
  },
  {
    eyebrow: "Money",
    title: "Reclassify the AT&T charge as utilities.",
    note: "It is currently filed under uncategorized — and pulling the spend pace upward.",
  },
  {
    eyebrow: "Body",
    title: "Protein is short for tonight's training.",
    note: "Add one fixture before 5 PM and the day balances out without thinking.",
  },
];

const sections = [
  {
    folio: "I.",
    title: "The Dispatch",
    role: "Hours of the day",
    body: "Open one column at a time. Close it when the work changes. The archive is set in print at the close of each session.",
  },
  {
    folio: "II.",
    title: "The Ledger",
    role: "Coin and accounts",
    body: "True spend, separated from transfers and payoffs. Cash on hand, the next due date, the bucket you are funding.",
  },
  {
    folio: "III.",
    title: "Marginalia",
    role: "Notes from the day",
    body: "Every meaningful action — opened, closed, imported, struck — recorded in the margin so the day's events compose themselves.",
  },
];

const futureSections = [
  {
    title: "Body & Plate",
    chips: ["calories", "protein", "weight", "water"],
    body: "Track the day's fuel against the day's intent — without a separate app and without guessing.",
  },
  {
    title: "Projects & Habits",
    chips: ["deep work", "tasks", "follow-ups", "rituals"],
    body: "Carry the open threads forward. A short list of what you said you'd do, on the page that already has the rest of you.",
  },
  {
    title: "Calendar & Travel",
    chips: ["agenda", "trips", "packing", "errands"],
    body: "What is on the day, where you must be, what you must bring, and the route that makes the errands one trip.",
  },
  {
    title: "Home & Life Ops",
    chips: ["wishlist", "subscriptions", "shopping", "house"],
    body: "The quiet machinery of running a life — kept in plain view so it doesn't quietly run you.",
  },
];

const tenets = [
  "One page, not twelve apps.",
  "Plain figures over clever ones.",
  "Composed, not crowded.",
  "Set in print, not pinged.",
];

export default function LandingPage() {
  return (
    <main className="overflow-hidden text-ink">
      {/* The masthead and lead article */}
      <section className="relative">
        <Parallax
          speed={0.04}
          className="pointer-events-none absolute -right-32 top-32 hidden h-72 w-72 rounded-full bg-oxblood/8 blur-3xl lg:block"
        />
        <Parallax
          speed={0.06}
          className="pointer-events-none absolute -left-24 top-64 hidden h-80 w-80 rounded-full bg-aged-gold/8 blur-3xl lg:block"
        />

        <div className="mx-auto w-full max-w-[1280px] px-5 pt-6 sm:px-10 sm:pt-10">
          {/* Top strip with subscriber metadata, like a real newspaper */}
          <div className="flex items-center justify-between gap-4 pb-4 font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-ink-fade">
            <span>Vol.&nbsp;I · No.&nbsp;I</span>
            <span className="hidden sm:inline text-ink">A daily edition for one</span>
            <Link
              href="/login"
              className="group inline-flex items-baseline gap-1.5 font-serif text-sm italic text-ink hover:text-oxblood"
            >
              <span aria-hidden className="font-mono text-[0.625rem] not-italic uppercase tracking-[0.22em] text-ink-fade group-hover:text-oxblood">
                ✎
              </span>
              sign in
            </Link>
          </div>

          {/* Masthead */}
          <div className="double-rule-t double-rule-b border-ink py-6 sm:py-10">
            <div className="flex flex-col items-center text-center">
              <h1
                className="font-display font-medium italic leading-[0.82] tracking-[-0.055em] text-ink text-[4.5rem] sm:text-[8rem] lg:text-[12rem]"
                style={{ fontVariationSettings: '"SOFT" 100, "WONK" 1, "opsz" 144' }}
              >
                aucosto
              </h1>
              <p className="mt-3 font-serif text-base italic text-ink-fade sm:text-lg">
                A daily edition, set in print for a single reader.
              </p>
            </div>
          </div>

          {/* Lead article: two columns — a hero column and a "today's briefing" column */}
          <div className="grid gap-12 py-12 lg:grid-cols-[1.55fr_1fr] lg:gap-16 lg:py-16">
            <article className="lg:rule-r lg:border-rule lg:pr-16">
              <p className="font-mono text-[0.6875rem] uppercase tracking-[0.28em] text-ink-fade">
                The opening notice
              </p>
              <h2 className="mt-5 font-display font-medium leading-[0.92] tracking-[-0.045em] text-ink text-[2.6rem] sm:text-[3.8rem] lg:text-[4.8rem]">
                The day,{" "}
                <span className="italic text-oxblood">composed</span>{" "}
                rather than scattered.
              </h2>

              <div className="mt-9 max-w-2xl lg:columns-2 lg:gap-10 lg:[&>p]:break-inside-avoid">
                <p className="drop-cap font-serif text-[1.05rem] leading-[1.75] text-ink-soft first-letter:text-oxblood">
                  The morning arrives, as it always does, with more to consider
                  than to answer. Hours to spend in earnest. Coin coming and
                  going. Small notes left from yesterday, asking to be read.
                </p>
                <p className="mt-5 font-serif text-[1.05rem] leading-[1.75] text-ink-soft">
                  Aucosto gathers those figures and sets them on a single page
                  — typeset, dated, and quiet. A daily edition produced for
                  exactly one reader, with the work of attention done already.
                </p>
              </div>

              <div className="mt-10 flex flex-wrap items-baseline gap-x-8 gap-y-3">
                <Link href="/login" className="btn-ink">
                  Begin today’s edition
                </Link>
                <a
                  href="#sections"
                  className="group inline-flex items-baseline gap-2 font-display text-lg italic text-ink-fade transition-colors hover:text-ink"
                >
                  <span aria-hidden className="font-mono text-xs not-italic tracking-[0.22em] uppercase">§</span>
                  Read the sections
                  <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
                </a>
              </div>

              <ul className="mt-12 flex flex-wrap items-baseline gap-x-7 gap-y-2 font-serif text-sm italic text-ink-fade">
                {tenets.map((tenet) => (
                  <li key={tenet} className="flex items-baseline gap-2">
                    <span aria-hidden className="font-mono text-xs not-italic uppercase tracking-[0.22em] text-oxblood">
                      ❦
                    </span>
                    {tenet}
                  </li>
                ))}
              </ul>
            </article>

            <Parallax speed={-0.03} minWidth={1024}>
              <aside>
                <header className="rule-b border-ink pb-3">
                  <p className="font-mono text-[0.6875rem] uppercase tracking-[0.28em] text-oxblood">
                    ❦ Today’s Briefing ❦
                  </p>
                  <h3 className="mt-2 font-display text-2xl font-medium italic tracking-[-0.02em] text-ink">
                    From the editor’s desk.
                  </h3>
                </header>

                <dl className="mb-6 mt-6 grid grid-cols-3 gap-x-4">
                  {todayStats.map((stat) => (
                    <div key={stat.label} className="rule-t border-ink/40 pt-3">
                      <dt className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-ink-fade">
                        {stat.label}
                      </dt>
                      <dd className="mt-1.5 font-display text-lg font-medium tracking-[-0.02em] tabular text-ink">
                        {stat.value}
                      </dd>
                      <dd className="mt-0.5 font-serif text-[0.7rem] italic text-ink-fade leading-snug">
                        {stat.caption}
                      </dd>
                    </div>
                  ))}
                </dl>

                <ol className="divide-y divide-rule-soft">
                  {briefs.map((brief, i) => (
                    <li key={brief.title} className="grid grid-cols-[auto_1fr] items-baseline gap-4 py-4">
                      <span className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] tabular text-ink-ghost">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <p className="font-mono text-[0.625rem] uppercase tracking-[0.22em] text-oxblood">
                          {brief.eyebrow}
                        </p>
                        <p className="mt-1 font-display text-base leading-snug text-ink">
                          {brief.title}
                        </p>
                        <p className="mt-1 font-serif text-sm italic leading-relaxed text-ink-fade">
                          {brief.note}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </aside>
            </Parallax>
          </div>
        </div>
      </section>

      {/* Sections of the paper */}
      <section id="sections" className="rule-t border-ink">
        <div className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-10 sm:py-24">
          <header className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-14">
            <div className="lg:rule-r lg:border-rule lg:pr-14">
              <p className="font-mono text-[0.6875rem] uppercase tracking-[0.28em] text-ink-fade">
                Volume I · The Standing Sections
              </p>
              <h2 className="mt-5 font-display font-medium leading-[0.92] tracking-[-0.045em] text-ink text-[2.4rem] sm:text-[3.4rem]">
                Three sections,{" "}
                <span className="italic text-oxblood">printed each day</span>.
              </h2>
            </div>
            <p className="font-serif text-[1.05rem] leading-[1.75] italic text-ink-soft">
              Aucosto begins with what already runs the day — the hours, the
              coin, the trail of small actions. The remainder of the paper will
              be added one section at a time, in the order each becomes useful.
            </p>
          </header>

          <ol className="mt-14 grid gap-12 md:grid-cols-3 md:gap-10">
            {sections.map((section, i) => (
              <Parallax key={section.title} speed={(i - 1) * 0.02} minWidth={1024}>
                <li className="rule-t border-ink pt-5">
                  <p className="font-mono text-[0.6875rem] uppercase tracking-[0.28em] text-oxblood">
                    Section {section.folio}
                  </p>
                  <h3 className="mt-3 font-display text-3xl font-medium italic tracking-[-0.03em] text-ink">
                    {section.title}
                  </h3>
                  <p className="mt-1 font-serif text-sm italic text-ink-fade">
                    — {section.role}
                  </p>
                  <p className="mt-5 font-serif text-[1rem] leading-[1.75] text-ink-soft">
                    {section.body}
                  </p>
                </li>
              </Parallax>
            ))}
          </ol>
        </div>
      </section>

      {/* Sections to come */}
      <section className="rule-t border-ink bg-paper-deep/45">
        <div className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-10 sm:py-24">
          <header className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-14">
            <div className="lg:rule-r lg:border-rule lg:pr-14">
              <p className="font-mono text-[0.6875rem] uppercase tracking-[0.28em] text-ink-fade">
                Forthcoming
              </p>
              <h2 className="mt-5 font-display font-medium leading-[0.92] tracking-[-0.045em] text-ink text-[2.4rem] sm:text-[3.4rem]">
                Coming into{" "}
                <span className="italic text-oxblood">the type-case</span>,
                <br />
                one chapter at a time.
              </h2>
            </div>
            <p className="font-serif text-[1.05rem] leading-[1.75] italic text-ink-soft">
              Each addition arrives only when it has a real job to do. The aim
              is one quiet page for the whole of daily life — not twelve apps
              and a search bar.
            </p>
          </header>

          <div className="mt-14 grid gap-x-12 gap-y-12 md:grid-cols-2">
            {futureSections.map((section) => (
              <article key={section.title} className="rule-t border-ink/60 pt-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-2xl font-medium italic tracking-[-0.02em] text-ink">
                    {section.title}
                  </h3>
                  <span className="font-mono text-[0.625rem] uppercase tracking-[0.22em] text-ink-fade">
                    in the press
                  </span>
                </div>
                <p className="mt-3 font-serif text-[1rem] leading-[1.75] text-ink-soft">
                  {section.body}
                </p>
                <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 font-serif text-sm italic text-ink-fade">
                  {section.chips.map((chip, i) => (
                    <li key={chip} className="flex items-baseline gap-2">
                      {i > 0 && (
                        <span aria-hidden className="text-ink-ghost not-italic">·</span>
                      )}
                      {chip}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Closing colophon / call to subscribe */}
      <section className="rule-t border-ink">
        <div className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-10 sm:py-24">
          <div className="grid gap-12 lg:grid-cols-[1.6fr_1fr] lg:items-end lg:gap-14">
            <div>
              <p className="font-mono text-[0.6875rem] uppercase tracking-[0.28em] text-ink-fade">
                ❦ The Colophon ❦
              </p>
              <h2 className="mt-5 font-display font-medium leading-[0.9] tracking-[-0.045em] text-ink text-[2.6rem] sm:text-[4rem] lg:text-[5rem]">
                One page for the things
                <br />
                that{" "}
                <span className="italic text-oxblood">keep a life running</span>.
              </h2>
              <p className="mt-7 max-w-2xl font-serif text-[1.05rem] leading-[1.75] italic text-ink-soft">
                Less scattered tracking. Less repeated thinking. More clarity
                about what to do next. Invite-only, so the figures stay private
                and the paper stays quiet.
              </p>
            </div>
            <div className="space-y-4 lg:text-right">
              <Link href="/login" className="btn-ink w-full lg:w-auto">
                Begin today’s edition  →
              </Link>
              <p className="font-serif text-sm italic text-ink-fade">
                Set in Fraunces and Newsreader. Printed at home, one copy.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="rule-t border-ink">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col items-center gap-3 px-5 py-8 text-center sm:flex-row sm:justify-between sm:px-10">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-ink-fade">
            Aucosto · A Daily Edition · Vol.&nbsp;I
          </p>
          <p className="font-serif text-sm italic text-ink-fade">
            Printed for{" "}
            <span className="not-italic font-mono text-[0.7rem] uppercase tracking-[0.2em] text-ink">
              one
            </span>{" "}
            reader at a time.
          </p>
        </div>
      </footer>
    </main>
  );
}
