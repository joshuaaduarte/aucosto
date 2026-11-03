// Spending pace: "are we on track this week / this month?". No DB; tested in
// tests/finance-pacing.test.ts.
//
// Spending is split three ways (the Monarch "flex budgeting" idea):
//   fixed      — bills that land every month (rent, insurance, phone). Shown
//                as paid/upcoming, never as overspending.
//   occasional — yearly or quarterly bills, set aside per month.
//   flexible   — everything else (groceries, eating out, shopping). One
//                monthly number with a pace line (the Copilot idea) and a
//                weekly allowance.
// The flexible limit is stored as a FinanceBudget row whose category is
// FLEXIBLE_BUDGET_KEY, next to the optional per-category limits.

import type { FinanceTransaction } from "@/generated/prisma/client";
import { resolveCategory } from "@/lib/finance-categories";
import { isTrueExpenseTransaction } from "@/lib/finance-types";

const DAY_MS = 24 * 60 * 60 * 1000;

export const FLEXIBLE_BUDGET_KEY = "Flexible";

/** Categories that are fixed costs by nature, whether or not a bill exists. */
export const FIXED_CATEGORIES = ["Housing", "Bills & Utilities", "Insurance", "Subscriptions"] as const;

type SpendTx = Pick<FinanceTransaction, "amount" | "description" | "category" | "date">;

export type PacingBill = {
  name: string;
  amountCents: number | null;
  cadence: string;
  category?: string | null;
};

export function monthlyEquivalentCents(bill: Pick<PacingBill, "amountCents" | "cadence">): number {
  const amount = bill.amountCents ?? 0;
  switch (bill.cadence) {
    case "weekly":
      return Math.round((amount * 52) / 12);
    case "quarterly":
      return Math.round(amount / 3);
    case "yearly":
      return Math.round(amount / 12);
    case "once":
      return 0;
    default:
      return amount;
  }
}

export function splitBills(bills: PacingBill[]): {
  fixedMonthlyCents: number;
  occasionalMonthlyCents: number;
} {
  let fixedMonthlyCents = 0;
  let occasionalMonthlyCents = 0;
  for (const bill of bills) {
    const monthly = monthlyEquivalentCents(bill);
    if (bill.cadence === "quarterly" || bill.cadence === "yearly") occasionalMonthlyCents += monthly;
    else fixedMonthlyCents += monthly;
  }
  return { fixedMonthlyCents, occasionalMonthlyCents };
}

/** Categories that count as fixed: the built-in ones plus any a bill uses. */
export function fixedCategorySet(bills: PacingBill[]): Set<string> {
  const set = new Set<string>(FIXED_CATEGORIES);
  for (const bill of bills) if (bill.category) set.add(bill.category);
  return set;
}

export function isFlexibleSpend(tx: SpendTx, fixed: Set<string>): boolean {
  if (!isTrueExpenseTransaction(tx)) return false;
  const category = resolveCategory(tx.category, tx.description, tx.amount);
  return category !== "Income" && !fixed.has(category);
}

export function flexibleSpendCents(txs: SpendTx[], from: Date, to: Date, fixed: Set<string>): number {
  let total = 0;
  for (const tx of txs) {
    if (tx.date < from || tx.date >= to) continue;
    if (isFlexibleSpend(tx, fixed)) total += Math.abs(tx.amount);
  }
  return total;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Monday-start week containing `now`, as [start, end). */
export function weekBounds(now: Date): { start: Date; end: Date } {
  const start = startOfDay(now);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

export type PaceStatus = "good" | "watch" | "over" | "unset";

export type Pacing = {
  limitCents: number | null;
  status: PaceStatus;
  month: {
    start: Date;
    daysInMonth: number;
    dayOfMonth: number;
    spentCents: number;
    expectedByTodayCents: number;
    /** Positive = spent less than the pace line. */
    aheadCents: number;
    remainingCents: number;
    projectedCents: number;
  };
  week: {
    start: Date;
    /** Last day of the week inside this month, inclusive. */
    lastDay: Date;
    allowanceCents: number;
    spentCents: number;
    leftCents: number;
    daysLeft: number;
  };
  /** Flexible spend so far by day of month (index 0 = the 1st), cumulative. */
  cumulativeByDay: number[];
  fixedMonthlyCents: number;
  occasionalMonthlyCents: number;
};

export function buildPacing(input: {
  flexibleLimitCents: number | null;
  transactions: SpendTx[];
  bills: PacingBill[];
  now: Date;
}): Pacing {
  const { now } = input;
  const fixed = fixedCategorySet(input.bills);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), dayOfMonth + 1);

  const daily = new Array<number>(dayOfMonth).fill(0);
  for (const tx of input.transactions) {
    if (tx.date < monthStart || tx.date >= tomorrow) continue;
    if (!isFlexibleSpend(tx, fixed)) continue;
    const day = tx.date.getDate() - 1;
    if (day >= 0 && day < daily.length) daily[day]! += Math.abs(tx.amount);
  }
  const cumulativeByDay: number[] = [];
  let running = 0;
  for (const value of daily) {
    running += value;
    cumulativeByDay.push(running);
  }
  const spentCents = flexibleSpendCents(input.transactions, monthStart, monthEnd, fixed);

  const limit = input.flexibleLimitCents && input.flexibleLimitCents > 0 ? input.flexibleLimitCents : null;
  const expectedByTodayCents = limit ? Math.round((limit * dayOfMonth) / daysInMonth) : 0;
  const projectedCents = Math.round((spentCents / Math.max(1, dayOfMonth)) * daysInMonth);

  // Weekly allowance: what was left of the month when this week began,
  // spread over the days left from then, times this week's days in the month.
  const week = weekBounds(now);
  const weekStart = week.start < monthStart ? monthStart : week.start;
  const weekEndInMonth = week.end > monthEnd ? monthEnd : week.end;
  const spentBeforeWeek = flexibleSpendCents(input.transactions, monthStart, weekStart, fixed);
  const daysFromWeekStart = Math.round((monthEnd.getTime() - weekStart.getTime()) / DAY_MS);
  const weekDaysInMonth = Math.round((weekEndInMonth.getTime() - weekStart.getTime()) / DAY_MS);
  const allowanceCents = limit
    ? Math.round((Math.max(0, limit - spentBeforeWeek) * weekDaysInMonth) / Math.max(1, daysFromWeekStart))
    : 0;
  const weekSpent = flexibleSpendCents(input.transactions, weekStart, weekEndInMonth, fixed);
  const lastDay = new Date(weekEndInMonth.getTime() - DAY_MS);
  const daysLeft = Math.max(
    1,
    Math.round((weekEndInMonth.getTime() - startOfDay(now).getTime()) / DAY_MS),
  );

  let status: PaceStatus = "unset";
  if (limit) {
    if (spentCents > limit) status = "over";
    else if (allowanceCents - weekSpent < 0 || spentCents > expectedByTodayCents * 1.05) status = "watch";
    else status = "good";
  }

  const bills = splitBills(input.bills);
  return {
    limitCents: limit,
    status,
    month: {
      start: monthStart,
      daysInMonth,
      dayOfMonth,
      spentCents,
      expectedByTodayCents,
      aheadCents: expectedByTodayCents - spentCents,
      remainingCents: limit ? limit - spentCents : 0,
      projectedCents,
    },
    week: {
      start: weekStart,
      lastDay,
      allowanceCents,
      spentCents: weekSpent,
      leftCents: allowanceCents - weekSpent,
      daysLeft,
    },
    cumulativeByDay,
    fixedMonthlyCents: bills.fixedMonthlyCents,
    occasionalMonthlyCents: bills.occasionalMonthlyCents,
  };
}

/**
 * A starting monthly number for flexible spending: the average of the last
 * three full months that had any, rounded up to $50. Null without history.
 */
export function suggestFlexibleLimitCents(
  transactions: SpendTx[],
  bills: PacingBill[],
  now: Date,
): number | null {
  const fixed = fixedCategorySet(bills);
  const totals: number[] = [];
  for (let back = 1; back <= 3; back++) {
    const from = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const to = new Date(now.getFullYear(), now.getMonth() - back + 1, 1);
    const total = flexibleSpendCents(transactions, from, to, fixed);
    if (total > 0) totals.push(total);
  }
  if (totals.length === 0) return null;
  const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
  return Math.ceil(avg / 5000) * 5000;
}

/** Category limits with a pace mark: where spending "should" be by today. */
export function categoryPace(
  limitCents: number,
  spentCents: number,
  now: Date,
): { expectedByTodayCents: number; aheadCents: number } {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const expectedByTodayCents = Math.round((limitCents * now.getDate()) / daysInMonth);
  return { expectedByTodayCents, aheadCents: expectedByTodayCents - spentCents };
}
