// Spending over time and next month's estimate. Pure; tested in
// tests/finance-trends.test.ts.
//
//   categoryTrends  — spending per category, month by month (the view Ana
//                     uses to see where money goes).
//   forecastNextMonth — fixed bills + repeating charges (subscriptions) +
//                     the typical month for everything else, per category.

import type { FinanceTransaction } from "@/generated/prisma/client";
import { resolveCategory } from "@/lib/finance-categories";
import { isMoveEntry } from "@/lib/finance-moves";
import { fixedCategorySet, monthlyEquivalentCents, type PacingBill } from "@/lib/finance-pacing";
import { findRecurringCandidates } from "@/lib/finance-summary";
import { isTrueExpenseTransaction } from "@/lib/finance-types";

type Tx = Pick<FinanceTransaction, "amount" | "description" | "category" | "date" | "account" | "externalId" | "raw">;

const DAY_MS = 24 * 60 * 60 * 1000;

function monthStart(d: Date, back = 0): Date {
  return new Date(d.getFullYear(), d.getMonth() - back, 1);
}

function isSpend(tx: Tx): boolean {
  return !isMoveEntry(tx) && isTrueExpenseTransaction(tx);
}

function categoryOf(tx: Tx): string {
  return resolveCategory(tx.category, tx.description, tx.amount);
}

/** Months with any logged or imported activity, so empty months before you started don't drag averages down. */
function activeMonthKeys(history: Tx[]): Set<number> {
  const keys = new Set<number>();
  for (const t of history) keys.add(t.date.getFullYear() * 12 + t.date.getMonth());
  return keys;
}

function monthKey(d: Date): number {
  return d.getFullYear() * 12 + d.getMonth();
}

// ── Category trends ──────────────────────────────────────────────────────

export type CategoryTrendRow = {
  category: string;
  /** One value per month in `months`, oldest first; the last is this month so far. */
  cents: number[];
  /** Average of the full months that had activity. */
  averageCents: number;
  /** Last full month against the average of the ones before it: +0.25 = 25% more. Null without enough months. */
  change: number | null;
};

export type CategoryTrends = {
  months: Date[];
  rows: CategoryTrendRow[];
  totals: number[];
};

export function categoryTrends(input: { history: Tx[]; now: Date; fullMonths?: number }): CategoryTrends {
  const full = input.fullMonths ?? 6;
  const active = activeMonthKeys(input.history);
  // Oldest full month first, then this month. Leading months with no
  // activity at all are dropped.
  let months: Date[] = [];
  for (let back = full; back >= 0; back--) months.push(monthStart(input.now, back));
  const firstActive = months.findIndex((m) => active.has(monthKey(m)));
  months = firstActive === -1 ? [months[months.length - 1]!] : months.slice(firstActive);
  const index = new Map(months.map((m, i) => [monthKey(m), i]));

  const byCategory = new Map<string, number[]>();
  const totals = months.map(() => 0);
  for (const t of input.history) {
    if (!isSpend(t)) continue;
    const i = index.get(monthKey(t.date));
    if (i === undefined || t.date > input.now) continue;
    const category = categoryOf(t);
    const row = byCategory.get(category) ?? months.map(() => 0);
    row[i]! += Math.abs(t.amount);
    totals[i]! += Math.abs(t.amount);
    byCategory.set(category, row);
  }

  const fullCount = months.length - 1; // the last column is this month so far
  const rows = [...byCategory.entries()].map(([category, cents]) => {
    const fullValues = cents.slice(0, fullCount);
    const averageCents = fullValues.length ? Math.round(fullValues.reduce((a, b) => a + b, 0) / fullValues.length) : 0;
    let change: number | null = null;
    if (fullValues.length >= 3) {
      const last = fullValues[fullValues.length - 1]!;
      const before = fullValues.slice(0, -1);
      const prior = before.reduce((a, b) => a + b, 0) / before.length;
      if (prior > 0) change = last / prior - 1;
    }
    return { category, cents, averageCents, change };
  });
  rows.sort((a, b) => b.averageCents - a.averageCents || b.cents.at(-1)! - a.cents.at(-1)!);
  return { months, rows, totals };
}

// ── Next month ───────────────────────────────────────────────────────────

export type ForecastLine = { name: string; cents: number };

export type NextMonthForecast = {
  month: Date;
  /** Bills you set up (rent, insurance), monthly equivalent. */
  bills: ForecastLine[];
  /** Charges that repeat every month at the same amount and aren't a bill yet. */
  subscriptions: ForecastLine[];
  /** Typical month for everything else, per category. */
  categories: ForecastLine[];
  totalCents: number;
  /** How many full months the typical amounts are based on (0–3). */
  basedOnMonths: number;
};

function norm(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

export function forecastNextMonth(input: {
  history: Tx[];
  bills: Array<PacingBill & { archivedAt?: Date | null }>;
  now: Date;
}): NextMonthForecast {
  const bills = input.bills.filter((b) => !b.archivedAt && b.cadence !== "once");
  const billLines = bills
    .map((b) => ({ name: b.name, cents: monthlyEquivalentCents(b) }))
    .filter((l) => l.cents > 0)
    .sort((a, b) => b.cents - a.cents);
  const billNames = bills.map((b) => norm(b.name)).filter(Boolean);
  const coversBill = (merchant: string) => {
    const m = norm(merchant);
    return billNames.some((n) => m.includes(n) || n.includes(m));
  };

  // Repeating charges still active (seen in the last ~45 days).
  const spend = input.history.filter(isSpend);
  const recurring = findRecurringCandidates(spend, { limit: 50 }).filter(
    (r) => input.now.getTime() - r.lastDate.getTime() <= 45 * DAY_MS,
  );
  const recurringKeys = new Set(recurring.map((r) => `${norm(r.merchant)}|${r.amountCents}`));
  const subscriptions = recurring
    .filter((r) => !coversBill(r.merchant))
    .map((r) => ({ name: r.merchant, cents: r.amountCents }))
    .sort((a, b) => b.cents - a.cents);

  // Typical month per category over the last three full months that had
  // activity, leaving out what bills and repeating charges already cover.
  const active = activeMonthKeys(input.history);
  const window = [1, 2, 3].map((back) => monthStart(input.now, back)).filter((m) => active.has(monthKey(m)));
  const windowKeys = new Set(window.map(monthKey));
  const billCategories = new Set(bills.map((b) => b.category).filter((c): c is string => !!c));
  const fixed = fixedCategorySet(bills);
  const sums = new Map<string, number>();
  for (const t of spend) {
    if (!windowKeys.has(monthKey(t.date))) continue;
    if (recurringKeys.has(`${norm(t.description)}|${Math.abs(t.amount)}`)) continue;
    const category = categoryOf(t);
    // A bill already stands for this category (rent → Housing).
    if (billCategories.has(category)) continue;
    if (fixed.has(category) && coversBill(t.description)) continue;
    sums.set(category, (sums.get(category) ?? 0) + Math.abs(t.amount));
  }
  const categories = window.length
    ? [...sums.entries()]
        .map(([name, total]) => ({ name, cents: Math.round(total / window.length) }))
        .filter((l) => l.cents > 0)
        .sort((a, b) => b.cents - a.cents)
    : [];

  const sum = (lines: ForecastLine[]) => lines.reduce((a, l) => a + l.cents, 0);
  return {
    month: monthStart(input.now, -1),
    bills: billLines,
    subscriptions,
    categories,
    totalCents: sum(billLines) + sum(subscriptions) + sum(categories),
    basedOnMonths: window.length,
  };
}
