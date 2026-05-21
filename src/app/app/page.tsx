import Link from "next/link";
import { auth } from "@/auth";
import { startOfMonth, startOfPreviousMonth } from "@/lib/money";
import { listAccounts, listTransactions } from "@/lib/services/finance";
import { getRunningEntry, listCompletedSince } from "@/lib/services/time";
import { CalendarWidget } from "@/lib/widgets/calendar";
import { startOfWeek } from "@/lib/time";
import { sumDurations } from "@/lib/time-summary";
import { getViewerContext } from "@/lib/viewer-context";
import { ActivityWidget } from "@/lib/widgets/activity";
import { FinanceWidget } from "@/lib/widgets/finance";
import { TimeTrackerWidget } from "@/lib/widgets/time-tracker";
import { deriveHubPrompts } from "./_lib/hub-prompts";
import { PrivacyPanel } from "./privacy-panel";

const toneColor: Record<string, string> = {
  amber:   "var(--aged-gold)",
  emerald: "var(--verdigris)",
  zinc:    "var(--ink-ghost)",
  red:     "var(--oxblood)",
};

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

  const today = new Date().toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const colCount = financeVisible ? "lg:grid-cols-4" : "lg:grid-cols-3";

  return (
    <div className="space-y-10">
      {/* ── Greeting ──────────────────────────────────────────── */}
      <section className="fade-in flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-[1.75rem] font-semibold tracking-[-0.02em] text-ink sm:text-[2rem]">
          {firstName ? (
            <>
              Good morning,{" "}
              <span style={{ color: "var(--verdigris)" }}>{firstName}</span>.
            </>
          ) : (
            "Good morning."
          )}
        </h1>
        <p className="font-mono text-sm text-ink-fade shrink-0">{today}</p>
      </section>

      {/* ── Today's signals ───────────────────────────────────── */}
      {prompts.length > 0 && (
        <section className="fade-in-delay-1">
          <p className="mb-3 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-ink-ghost">
            Today&apos;s signals
          </p>
          <ol className="space-y-2">
            {prompts.map((prompt, i) => (
              <li
                key={prompt.text}
                className="flex items-start gap-3 rounded-lg px-4 py-3"
                style={{
                  background: "var(--surface)",
                  boxShadow: "var(--surface-shadow)",
                }}
              >
                <span className="mt-0.5 font-mono text-[0.6875rem] tabular text-ink-ghost shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{
                    background:
                      toneColor[prompt.tone ?? "red"] ?? "var(--oxblood)",
                  }}
                  aria-hidden
                />
                <p className="text-sm leading-[1.6] text-ink-fade">
                  {prompt.text}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ── Widgets ───────────────────────────────────────────── */}
      <section className={`fade-in-delay-2 grid gap-4 ${colCount}`}>
        <CalendarWidget />
        <TimeTrackerWidget />
        {financeVisible ? <FinanceWidget /> : null}
        <ActivityWidget />
      </section>

      {/* ── Quick links ───────────────────────────────────────── */}
      <section className="fade-in-delay-3 flex flex-wrap gap-3">
        <Link
          href="/app/calendar"
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-ink-fade transition-colors hover:bg-paper-deep hover:text-ink"
          style={{ border: "1px solid var(--rule-soft)" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <rect x="2" y="2.5" width="10" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
            <path d="M4.5 1.75V4M9.5 1.75V4M2 5.25H12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          Open Calendar
        </Link>
        <Link
          href="/app/time"
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-ink-fade transition-colors hover:bg-paper-deep hover:text-ink"
          style={{ border: "1px solid var(--rule-soft)" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M7 4.5V7l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Open Time
        </Link>
        {financeVisible && (
          <Link
            href="/app/finance"
            className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-ink-fade transition-colors hover:bg-paper-deep hover:text-ink"
            style={{ border: "1px solid var(--rule-soft)" }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <rect x="1.5" y="3.5" width="11" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <path d="M1.5 6h11" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            Open Finance
          </Link>
        )}
      </section>

      {/* ── Settings ──────────────────────────────────────────── */}
      <section
        className="fade-in-delay-4 rounded-xl px-5 py-5 sm:px-6"
        style={{
          background: "var(--surface)",
          boxShadow: "var(--surface-shadow)",
        }}
      >
        <PrivacyPanel
          financeVisible={financeVisible}
          appLockEnabled={context?.appLockEnabled ?? false}
          isDemoMode={context?.isDemoMode ?? false}
        />
      </section>
    </div>
  );
}

function sumSpend(transactions: { amount: number }[]): number {
  return transactions.reduce(
    (acc, t) => (t.amount < 0 ? acc + Math.abs(t.amount) : acc),
    0,
  );
}
