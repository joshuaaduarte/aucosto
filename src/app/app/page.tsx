import Link from "next/link";
import { auth } from "@/auth";
import { startOfMonth, startOfPreviousMonth } from "@/lib/money";
import { listAccounts, listTransactions } from "@/lib/services/finance";
import { getRunningEntry, listCompletedSince } from "@/lib/services/time";
import { startOfWeek } from "@/lib/time";
import { sumDurations } from "@/lib/time-summary";
import { getViewerContext } from "@/lib/viewer-context";
import { ActivityWidget } from "@/lib/widgets/activity";
import { FinanceWidget } from "@/lib/widgets/finance";
import { TimeTrackerWidget } from "@/lib/widgets/time-tracker";
import { deriveHubPrompts } from "./_lib/hub-prompts";
import { PrivacyPanel } from "./privacy-panel";

export default async function HubPage() {
  const session = await auth();
  const context = await getViewerContext();
  const firstName = session?.user?.name?.split(" ")[0];

  const userId = context?.effectiveUserId;
  const financeVisible = context?.financeVisible ?? false;

  const [runningEntry, weekEntries, accounts, thisMonthTx, lastMonthTx] =
    userId
      ? await Promise.all([
          getRunningEntry(userId),
          listCompletedSince(userId, startOfWeek()),
          financeVisible ? listAccounts(userId) : Promise.resolve([]),
          financeVisible
            ? listTransactions(userId, { since: startOfMonth(), limit: 1000 })
            : Promise.resolve([]),
          financeVisible
            ? listTransactions(userId, {
                since: startOfPreviousMonth(),
                limit: 1000,
              })
            : Promise.resolve([]),
        ])
      : [null, [], [], [], []];

  const monthStart = startOfMonth();
  const previousMonthStart = startOfPreviousMonth();
  const thisMonthSpentCents = sumSpend(
    thisMonthTx.filter((t) => t.date >= monthStart),
  );
  const lastMonthSpentCents = sumSpend(
    lastMonthTx.filter(
      (t) => t.date >= previousMonthStart && t.date < monthStart,
    ),
  );

  const prompts = deriveHubPrompts({
    runningEntry,
    weekTotalMs: sumDurations(weekEntries),
    accounts: financeVisible ? accounts : undefined,
    thisMonthSpentCents: financeVisible ? thisMonthSpentCents : undefined,
    lastMonthSpentCents: financeVisible ? lastMonthSpentCents : undefined,
  });

  return (
    <div className="space-y-12 lg:space-y-16">
      {/* Lead article */}
      <section className="fade-in grid gap-10 lg:grid-cols-[1.55fr_1fr] lg:gap-14">
        <article className="lg:rule-r lg:border-rule lg:pr-14">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.28em] text-ink-fade">
            From the editor’s desk
          </p>
          <h1 className="mt-5 font-display font-medium leading-[0.92] tracking-[-0.045em] text-ink text-[2.6rem] sm:text-[3.6rem] lg:text-[4.5rem]">
            {firstName ? (
              <>
                Good morning,{" "}
                <span className="italic text-oxblood">{firstName}</span>.
              </>
            ) : (
              <>Welcome back, dear reader.</>
            )}
          </h1>

          <div className="mt-8 max-w-2xl lg:columns-2 lg:gap-10">
            <p className="drop-cap font-serif text-[1.05rem] leading-[1.75] text-ink-soft first-letter:text-oxblood">
              The day arrives, as it always does, with more to consider than to
              answer. This edition gathers the figures that matter — the hours
              spent in earnest, the coin coming and going, the small notes from
              yesterday — and sets them in one quiet page so the morning can
              begin with clarity rather than search.
            </p>
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-3">
            <Link
              href="/app/time"
              className="group inline-flex items-baseline gap-2 font-display text-lg italic text-ink transition-colors hover:text-oxblood"
            >
              <span aria-hidden className="font-mono text-xs not-italic tracking-[0.22em] uppercase text-ink-fade group-hover:text-oxblood">
                §
              </span>
              Open the Dispatch
              <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
            {financeVisible ? (
              <Link
                href="/app/finance#transactions"
                className="group inline-flex items-baseline gap-2 font-display text-lg italic text-ink transition-colors hover:text-oxblood"
              >
                <span aria-hidden className="font-mono text-xs not-italic tracking-[0.22em] uppercase text-ink-fade group-hover:text-oxblood">
                  §
                </span>
                Review the Ledger
                <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
              </Link>
            ) : null}
          </div>
        </article>

        <aside className="fade-in-delay-1">
          <header className="rule-b border-ink pb-3">
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.28em] text-oxblood">
              ❦ Day Briefing ❦
            </p>
            <h2 className="mt-2 font-display text-2xl font-medium tracking-[-0.02em] text-ink italic">
              What the figures say.
            </h2>
          </header>
          <ol className="divide-y divide-rule-soft">
            {prompts.map((prompt, i) => (
              <li
                key={prompt.text}
                className="grid grid-cols-[auto_1fr] items-baseline gap-4 py-4"
              >
                <span className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-ink-ghost tabular">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="font-serif text-[0.95rem] leading-[1.55] text-ink-soft">
                  <span
                    aria-hidden
                    className={`mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle ${
                      prompt.tone === "amber"
                        ? "bg-aged-gold"
                        : prompt.tone === "emerald"
                          ? "bg-verdigris"
                          : prompt.tone === "zinc"
                            ? "bg-ink-ghost"
                            : "bg-oxblood"
                    }`}
                  />
                  {prompt.text}
                </p>
              </li>
            ))}
          </ol>
        </aside>
      </section>

      <div className="fleuron text-ink-fade">
        <span aria-hidden>❦ ❧ ❦</span>
      </div>

      {/* The sections — three columns of widget panels */}
      <section
        className={`fade-in-delay-2 grid gap-8 ${financeVisible ? "lg:grid-cols-3" : "lg:grid-cols-2"} lg:gap-10`}
      >
        <TimeTrackerWidget />
        {financeVisible ? <FinanceWidget /> : null}
        <ActivityWidget />
      </section>

      <div className="fleuron text-ink-fade">
        <span aria-hidden>✣</span>
      </div>

      {/* Privacy / colophon section */}
      <PrivacyPanel
        financeVisible={financeVisible}
        appLockEnabled={context?.appLockEnabled ?? false}
        isDemoMode={context?.isDemoMode ?? false}
      />
    </div>
  );
}

function sumSpend(transactions: { amount: number }[]): number {
  return transactions.reduce(
    (acc, t) => (t.amount < 0 ? acc + Math.abs(t.amount) : acc),
    0,
  );
}
