// "Today in review" digest for the hub. Pure derive: the page fetches data
// (and resolves "now" on the data path, keeping components time-pure) and this
// module turns it into a small set of display lines. No DB access here.

import type { FinanceTransaction, TimeEntry } from "@/generated/prisma/client";
import { calculateSpendProjection } from "@/lib/finance-pace";
import type { HabitSummary } from "@/lib/services/habits";
import { sumDurations } from "@/lib/time-summary";

export type DigestTimeEntry = Pick<TimeEntry, "startedAt" | "endedAt">;
export type DigestHabit = Pick<HabitSummary, "dueToday" | "completedToday">;
export type DigestTransaction = Pick<FinanceTransaction, "amount" | "description">;

export type DailyDigestInput = {
  /** Resolved by the caller on the data path (never inside a component). */
  now: Date;
  /** Completed time entries that started today. */
  completedTodayEntries: DigestTimeEntry[];
  /** The currently running entry, if any. */
  runningEntry: { startedAt: Date } | null;
  /** Habit summaries with today's progress (all active habits). */
  habits: DigestHabit[];
  /**
   * Current-month transactions for spend pace. Pass `null`/omit when finance
   * is hidden or locked — the finance line is then omitted entirely.
   */
  finance?: { monthTransactions: DigestTransaction[] } | null;
};

export type DailyDigestLine = {
  key: "time" | "habits" | "finance";
  label: string;
  value: string;
  detail: string;
  href: string;
};

export type DailyDigest = {
  lines: DailyDigestLine[];
};

export function deriveDailyDigest(input: DailyDigestInput): DailyDigest {
  const lines: DailyDigestLine[] = [];

  const completedMs = sumDurations(input.completedTodayEntries);
  const runningMs = input.runningEntry
    ? Math.max(0, input.now.getTime() - input.runningEntry.startedAt.getTime())
    : 0;
  const trackedMs = completedMs + runningMs;
  lines.push({
    key: "time",
    label: "Time",
    value: formatHoursMs(trackedMs),
    detail: input.runningEntry
      ? "tracked today, timer still live"
      : trackedMs > 0
        ? "tracked today"
        : "nothing tracked yet today",
    href: "/app/time",
  });

  const dueHabits = input.habits.filter((habit) => habit.dueToday);
  const hitHabits = dueHabits.filter((habit) => habit.completedToday);
  lines.push({
    key: "habits",
    label: "Habits",
    value:
      dueHabits.length > 0
        ? `${hitHabits.length} of ${dueHabits.length}`
        : "All clear",
    detail:
      dueHabits.length > 0
        ? hitHabits.length === dueHabits.length
          ? "due habits handled"
          : "due habits handled so far"
        : "no habits due today",
    href: "/app/habits",
  });

  if (input.finance) {
    const projection = calculateSpendProjection(
      input.finance.monthTransactions,
      input.now,
    );
    lines.push({
      key: "finance",
      label: "Spend",
      value: formatCents(projection.spentCents),
      detail:
        projection.spentCents > 0
          ? `on pace for ${formatCents(projection.projectedCents)} this month`
          : "no spending recorded this month",
      href: "/app/finance",
    });
  }

  return { lines };
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
