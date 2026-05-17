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
    <div className="space-y-6 lg:space-y-8">
      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[2.1rem] border border-zinc-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(250,250,248,0.96)),radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_30%)] p-5 shadow-[0_28px_90px_-52px_rgba(24,24,27,0.22)] sm:p-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-zinc-500">
            Daily overview
          </p>
          <h1 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
            {firstName ? `Hey, ${firstName}.` : "Welcome back."} Steer the day from one calm place.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600 sm:text-base">
            Start with the highest-signal view, then drop into time or finance only when the numbers tell you to.
          </p>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
            <Link
              href="/app/time"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-zinc-950 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 sm:w-auto"
            >
              Open time tracker
            </Link>
            {financeVisible ? (
              <Link
                href="/app/finance#transactions"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-zinc-200 bg-white/88 px-5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:text-zinc-900 sm:w-auto"
              >
                Review money flow
              </Link>
            ) : null}
          </div>
        </div>

        <aside className="rounded-[2rem] border border-zinc-200/80 bg-white/92 p-5 shadow-[0_24px_80px_-50px_rgba(24,24,27,0.18)] sm:p-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            Right now
          </p>
          <ul className="mt-4 space-y-3">
            {prompts.map((prompt) => (
              <li
                key={prompt.text}
                className="flex gap-3 rounded-2xl border border-zinc-200/80 bg-zinc-50/90 px-4 py-3 text-sm text-zinc-600"
              >
                <span
                  className={`mt-1 h-2 w-2 rounded-full ${
                    prompt.tone === "amber"
                      ? "bg-amber-500"
                      : prompt.tone === "emerald"
                        ? "bg-emerald-500"
                        : prompt.tone === "zinc"
                          ? "bg-zinc-400"
                          : "bg-sky-500"
                  }`}
                />
                <span>{prompt.text}</span>
              </li>
            ))}
          </ul>
        </aside>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className={`grid gap-4 ${financeVisible ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
          <TimeTrackerWidget />
          {financeVisible ? <FinanceWidget /> : null}
        </div>
        <div>
          <ActivityWidget />
        </div>
      </section>

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
