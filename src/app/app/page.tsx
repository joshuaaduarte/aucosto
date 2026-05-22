import Link from "next/link";
import { auth } from "@/auth";
import { startOfMonth, startOfPreviousMonth } from "@/lib/money";
import { listAccounts, listTransactions } from "@/lib/services/finance";
import { getRunningEntry, listCompletedSince } from "@/lib/services/time";
import { startOfWeek } from "@/lib/time";
import { sumDurations } from "@/lib/time-summary";
import { getViewerContext } from "@/lib/viewer-context";
import { deriveHubPrompts } from "./_lib/hub-prompts";
import { CardMenu } from "./card-menu";

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
  const financeHasPin = false;
  const financeLocked = false;

  const [runningEntry, weekEntries, accounts, thisMonthTx, lastMonthTx] =
    userId
      ? await Promise.all([
          getRunningEntry(userId),
          listCompletedSince(userId, startOfWeek()),
          financeVisible && !financeLocked ? listAccounts(userId) : Promise.resolve([]),
          financeVisible && !financeLocked
            ? listTransactions(userId, { since: startOfMonth(), limit: 1000 })
            : Promise.resolve([]),
          financeVisible && !financeLocked
            ? listTransactions(userId, {
                since: startOfPreviousMonth(),
                limit: 1000,
              })
            : Promise.resolve([]),
        ])
      : [null, [], [], [], []];

  const monthStart = startOfMonth();
  const previousMonthStart = startOfPreviousMonth();
  const weekTotalMs = sumDurations(weekEntries);
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
    weekTotalMs,
    accounts: financeVisible && !financeLocked ? accounts : undefined,
    thisMonthSpentCents: financeVisible && !financeLocked ? thisMonthSpentCents : undefined,
    lastMonthSpentCents: financeVisible && !financeLocked ? lastMonthSpentCents : undefined,
  });

  const today = new Date().toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="space-y-10 max-w-2xl mx-auto">
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

      {/* ── Snapshot ──────────────────────────────────────────── */}
      <section className="fade-in-delay-1 grid grid-cols-2 gap-3">
        {/* Time card */}
        <div
          className="group relative rounded-xl"
          style={{ background: "var(--surface)", boxShadow: "var(--surface-shadow)" }}
        >
          <Link
            href="/app/time"
            className="block px-4 py-4 transition-opacity hover:opacity-80"
          >
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-ink-ghost">
              Time
            </p>
            {runningEntry ? (
              <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-ink">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ background: "var(--verdigris)" }}
                  aria-hidden
                />
                Running
              </p>
            ) : (
              <p className="mt-2 text-sm font-medium text-ink">
                {formatHoursMs(weekTotalMs)}
              </p>
            )}
            <p className="mt-0.5 font-mono text-[0.6875rem] text-ink-ghost">
              {runningEntry ? (runningEntry.label ?? "Untitled") : "this week"}
            </p>
          </Link>
        </div>

        {/* Finance card */}
        {financeVisible && (
          <div
            className="group relative rounded-xl"
            style={{ background: "var(--surface)", boxShadow: "var(--surface-shadow)" }}
          >
            <Link
              href="/app/finance"
              className="block px-4 py-4 transition-opacity hover:opacity-80"
            >
              <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-ink-ghost">
                Finance
              </p>
              {financeLocked ? (
                <>
                  <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-ink-ghost">
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
                      <rect x="2" y="5.5" width="8" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
                      <path d="M4 5.5V3.5a2 2 0 0 1 4 0v2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                    </svg>
                    Locked
                  </p>
                  <p className="mt-0.5 font-mono text-[0.6875rem] text-ink-ghost">
                    tap to unlock
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm font-medium text-ink">
                    {formatCents(thisMonthSpentCents)}
                  </p>
                  <p className="mt-0.5 font-mono text-[0.6875rem] text-ink-ghost">
                    spent this month
                    {lastMonthSpentCents > 0 && (
                      <span className="ml-1.5">
                        vs {formatCents(lastMonthSpentCents)} last
                      </span>
                    )}
                  </p>
                </>
              )}
            </Link>
            <CardMenu
              widgetId="finance"
              hasPin={financeHasPin}
              isLocked={financeLocked}
            />
          </div>
        )}
      </section>

      {/* ── Today's signals ───────────────────────────────────── */}
      {prompts.length > 0 && (
        <section className="fade-in-delay-2">
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
    </div>
  );
}

function sumSpend(transactions: { amount: number }[]): number {
  return transactions.reduce(
    (acc, t) => (t.amount < 0 ? acc + Math.abs(t.amount) : acc),
    0,
  );
}

function formatHoursMs(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
