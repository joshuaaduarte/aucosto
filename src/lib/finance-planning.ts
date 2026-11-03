// Pure helpers for monthly budgets, bills/renewals and the weekly money date.
// No DB; tested in tests/finance-planning.test.ts.

import type { FinanceTransaction } from "@/generated/prisma/client";
import { resolveCategory } from "@/lib/finance-categories";
import { isTrueExpenseTransaction } from "@/lib/finance-types";
import type { RecurringCandidate } from "@/lib/finance-summary";

const DAY_MS = 24 * 60 * 60 * 1000;

// ── Budgets ──────────────────────────────────────────────────────────────

export type BudgetStatus = "on_track" | "at_risk" | "over";

export type BudgetProgress = {
  category: string;
  limitCents: number;
  spentCents: number;
  projectedCents: number;
  remainingCents: number;
  percentUsed: number;
  status: BudgetStatus;
};

type SpendTx = Pick<FinanceTransaction, "amount" | "description" | "category" | "date">;

/** Spend per resolved category for transactions in [from, to). */
export function spendByCategory(
  transactions: SpendTx[],
  from: Date,
  to: Date,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.date < from || tx.date >= to) continue;
    if (!isTrueExpenseTransaction(tx)) continue;
    const category = resolveCategory(tx.category, tx.description, tx.amount);
    totals.set(category, (totals.get(category) ?? 0) + Math.abs(tx.amount));
  }
  return totals;
}

export function monthBounds(now: Date): { start: Date; end: Date; daysElapsed: number; daysInMonth: number } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return { start, end, daysElapsed: Math.max(1, now.getDate()), daysInMonth };
}

export function budgetProgress(
  budgets: Array<{ category: string; monthlyLimitCents: number }>,
  transactions: SpendTx[],
  now: Date,
): BudgetProgress[] {
  const { start, end, daysElapsed, daysInMonth } = monthBounds(now);
  const spent = spendByCategory(transactions, start, end);
  return budgets
    .map((budget) => {
      const spentCents = spent.get(budget.category) ?? 0;
      const projectedCents = Math.round((spentCents / daysElapsed) * daysInMonth);
      const limitCents = Math.max(0, budget.monthlyLimitCents);
      // A straight-line projection in the first week mostly measures when
      // the big shop happened, so only warn on pace from day 7.
      const status: BudgetStatus =
        spentCents > limitCents
          ? "over"
          : daysElapsed >= 7 && projectedCents > limitCents
            ? "at_risk"
            : "on_track";
      return {
        category: budget.category,
        limitCents,
        spentCents,
        projectedCents,
        remainingCents: limitCents - spentCents,
        percentUsed: limitCents > 0 ? Math.round((spentCents / limitCents) * 100) : 0,
        status,
      };
    })
    .sort((a, b) => statusRank(a.status) - statusRank(b.status) || b.percentUsed - a.percentUsed);
}

function statusRank(status: BudgetStatus): number {
  return status === "over" ? 0 : status === "at_risk" ? 1 : 2;
}

// ── Bills ────────────────────────────────────────────────────────────────

export const BILL_CADENCES = ["weekly", "monthly", "quarterly", "yearly", "once"] as const;
export type BillCadence = (typeof BILL_CADENCES)[number];

export function isBillCadence(value: string): value is BillCadence {
  return (BILL_CADENCES as readonly string[]).includes(value);
}

export function formatCadence(cadence: string): string {
  switch (cadence) {
    case "weekly":
      return "Weekly";
    case "quarterly":
      return "Every 3 months";
    case "yearly":
      return "Yearly";
    case "once":
      return "One time";
    default:
      return "Monthly";
  }
}

/** Next due date after a payment. Month math clamps to the last day (Jan 31 → Feb 28). */
export function advanceDueDate(due: Date, cadence: string): Date | null {
  if (cadence === "once") return null;
  if (cadence === "weekly") return new Date(due.getTime() + 7 * DAY_MS);
  const months = cadence === "quarterly" ? 3 : cadence === "yearly" ? 12 : 1;
  const day = due.getDate();
  const target = new Date(due.getFullYear(), due.getMonth() + months, 1, due.getHours(), due.getMinutes());
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return target;
}

export type BillLike = {
  id: string;
  name: string;
  amountCents: number | null;
  nextDueAt: Date;
  autopay: boolean;
};

export type BillDue<T extends BillLike = BillLike> = T & {
  daysUntil: number;
  overdue: boolean;
};

/** Whole calendar days from today to the due date (negative = overdue). */
export function daysUntil(due: Date, now: Date): number {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const b = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  return Math.round((b - a) / DAY_MS);
}

export function billsDueWithin<T extends BillLike>(bills: T[], now: Date, days: number): BillDue<T>[] {
  return bills
    .map((bill) => {
      const d = daysUntil(bill.nextDueAt, now);
      return { ...bill, daysUntil: d, overdue: d < 0 };
    })
    .filter((bill) => bill.daysUntil <= days)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

export function dueLabel(daysUntilDue: number): string {
  if (daysUntilDue < -1) return `${Math.abs(daysUntilDue)} days overdue`;
  if (daysUntilDue === -1) return "1 day overdue";
  if (daysUntilDue === 0) return "Due today";
  if (daysUntilDue === 1) return "Due tomorrow";
  return `Due in ${daysUntilDue} days`;
}

/**
 * Recurring charges that aren't tracked as bills yet, as bill suggestions:
 * next due = last charge + ~1 month.
 */
export function suggestBillsFromRecurring(
  recurring: RecurringCandidate[],
  existingBillNames: string[],
): Array<{ name: string; amountCents: number; nextDueAt: Date }> {
  const known = new Set(existingBillNames.map((n) => n.trim().toLowerCase()));
  return recurring
    .filter((item) => !known.has(item.merchant.trim().toLowerCase()))
    .map((item) => ({
      name: item.merchant,
      amountCents: item.amountCents,
      nextDueAt: advanceDueDate(item.lastDate, "monthly")!,
    }));
}

// ── Weekly money date ────────────────────────────────────────────────────

/** Monday-start ISO-ish week key, "YYYY-MM-DD" of that Monday (local time). */
export function moneyDateWeekKey(now: Date): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export type MoneyDateSummary = {
  weekKey: string;
  lastSevenDaysSpentCents: number;
  previousSevenDaysSpentCents: number;
  topCategories: Array<{ category: string; spentCents: number }>;
  budgetsNeedingAttention: BudgetProgress[];
  billsComingUp: number;
  uncategorizedCount: number;
};

export function buildMoneyDateSummary(input: {
  transactions: SpendTx[];
  budgets: BudgetProgress[];
  billsDueSoon: number;
  now: Date;
}): MoneyDateSummary {
  const { now } = input;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const weekAgo = new Date(today.getTime() - 7 * DAY_MS);
  const twoWeeksAgo = new Date(today.getTime() - 14 * DAY_MS);
  const last = spendByCategory(input.transactions, weekAgo, today);
  const prev = spendByCategory(input.transactions, twoWeeksAgo, weekAgo);
  const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
  const uncategorizedCount = input.transactions.filter(
    (tx) => tx.date >= weekAgo && tx.date < today && !tx.category && isTrueExpenseTransaction(tx),
  ).length;
  return {
    weekKey: moneyDateWeekKey(now),
    lastSevenDaysSpentCents: sum(last),
    previousSevenDaysSpentCents: sum(prev),
    topCategories: [...last.entries()]
      .map(([category, spentCents]) => ({ category, spentCents }))
      .sort((a, b) => b.spentCents - a.spentCents)
      .slice(0, 3),
    budgetsNeedingAttention: input.budgets.filter((b) => b.status !== "on_track"),
    billsComingUp: input.billsDueSoon,
    uncategorizedCount,
  };
}
