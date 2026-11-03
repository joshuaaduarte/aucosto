// Paychecks and the budget that builds itself on one salary. Pure; tested in
// tests/finance-paychecks.test.ts.
//
// The household lives on the "live" paychecks (Josh's) and sends the
// "invest" ones (Ana's) to saving and investing. Paychecks are stored as
// FinanceBudget rows under a reserved key (no schema change):
//   category = "__pay__:<live|invest>:<name>", monthlyLimitCents = take-home per check.
// Paychecks are recognized in the history by amount.

import type { FinanceTransaction } from "@/generated/prisma/client";
import { isMoveEntry } from "@/lib/finance-moves";
import type { NextMonthForecast } from "@/lib/finance-trends";

export const PAY_KEY_PREFIX = "__pay__:";
/** Keys under this prefix are settings, not category budgets. */
export const RESERVED_BUDGET_PREFIX = "__";

export type PayRole = "live" | "invest";

export type Paycheck = {
  name: string;
  role: PayRole;
  /** Take-home per check. */
  perCheckCents: number;
  /** Every other week: 26 checks a year. */
  monthlyCents: number;
};

export const CHECKS_PER_YEAR = 26;

export function payKey(role: PayRole, name: string): string {
  return `${PAY_KEY_PREFIX}${role}:${name.trim().slice(0, 40)}`;
}

export function paychecksFromBudgets(rows: Array<{ category: string; monthlyLimitCents: number }>): Paycheck[] {
  const out: Paycheck[] = [];
  for (const r of rows) {
    if (!r.category.startsWith(PAY_KEY_PREFIX)) continue;
    const rest = r.category.slice(PAY_KEY_PREFIX.length);
    const sep = rest.indexOf(":");
    const role = rest.slice(0, sep);
    const name = rest.slice(sep + 1);
    if ((role !== "live" && role !== "invest") || !name) continue;
    out.push({
      name,
      role,
      perCheckCents: r.monthlyLimitCents,
      monthlyCents: Math.round((r.monthlyLimitCents * CHECKS_PER_YEAR) / 12),
    });
  }
  return out.sort((a, b) => (a.role === b.role ? b.perCheckCents - a.perCheckCents : a.role === "live" ? -1 : 1));
}

type IncomeTx = Pick<FinanceTransaction, "amount" | "date" | "description" | "externalId" | "raw">;

/** A deposit within 3% of the paycheck amount. */
export function isPaycheck(tx: IncomeTx, perCheckCents: number): boolean {
  if (tx.amount <= 0 || isMoveEntry(tx)) return false;
  return Math.abs(tx.amount - perCheckCents) <= perCheckCents * 0.03;
}

export function paychecksBetween(history: IncomeTx[], perCheckCents: number, from: Date, to: Date) {
  let count = 0;
  let cents = 0;
  for (const t of history) {
    if (t.date < from || t.date >= to || !isPaycheck(t, perCheckCents)) continue;
    count += 1;
    cents += t.amount;
  }
  return { count, cents };
}

/**
 * Deposits that repeat about every two weeks at nearly the same amount:
 * likely paychecks, offered when setting them up.
 */
export function detectPaychecks(history: IncomeTx[]): Array<{ perCheckCents: number; count: number; description: string }> {
  const deposits = history
    .filter((t) => t.amount > 0 && !isMoveEntry(t))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const groups: Array<{ amounts: number[]; dates: Date[]; description: string }> = [];
  for (const t of deposits) {
    const g = groups.find((x) => Math.abs(x.amounts[0]! - t.amount) <= x.amounts[0]! * 0.03);
    if (g) {
      g.amounts.push(t.amount);
      g.dates.push(t.date);
    } else groups.push({ amounts: [t.amount], dates: [t.date], description: t.description });
  }
  return groups
    .filter((g) => {
      if (g.dates.length < 2) return false;
      const gaps = g.dates.slice(1).map((d, i) => (d.getTime() - g.dates[i]!.getTime()) / 86_400_000);
      return gaps.every((gap) => gap >= 10 && gap <= 18);
    })
    .map((g) => ({
      perCheckCents: Math.round(g.amounts.reduce((a, b) => a + b, 0) / g.amounts.length),
      count: g.amounts.length,
      description: g.description,
    }))
    .sort((a, b) => b.perCheckCents - a.perCheckCents);
}

// ── The budget on one salary ─────────────────────────────────────────────

/** Needs in the 50/30/20 sense; everything else you spend on is a want. */
export const NEEDS_CATEGORIES = new Set([
  "Housing",
  "Groceries",
  "Bills & Utilities",
  "Insurance",
  "Transport",
  "Health",
  "Pets",
]);

export type SalaryBudget = {
  /** Monthly take-home you live on. */
  ceilingCents: number;
  needsCents: number;
  wantsCents: number;
  /** Monthly amounts going into set-aside pots. */
  potsCents: number;
  /** What's left of the live-on pay after needs, wants and pots. */
  leftoverCents: number;
  /** Shares of the ceiling, 0–1 (the 50/30/20 check). */
  needsShare: number;
  wantsShare: number;
  saveShare: number;
  thisMonth: {
    spentCents: number;
    /** Heading for: the larger of spent so far and a typical month. */
    expectedCents: number;
    /** How far the month is heading past the live-on pay (0 = fine). */
    dipCents: number;
    live: { count: number; cents: number };
    invest: { count: number; cents: number };
    /** A month with a third live-on paycheck: the extra is a bonus to save. */
    bonusCents: number;
  };
  /** Category limits that fit inside the ceiling (wants trimmed first). */
  suggestedLimits: Array<{ category: string; cents: number; trimmed: boolean }>;
};

export function salaryBudget(input: {
  paychecks: Paycheck[];
  forecast: NextMonthForecast;
  potsMonthlyCents: number;
  /** This month's real spending so far (pot-funded purchases excluded). */
  spentThisMonthCents: number;
  history: IncomeTx[];
  now: Date;
}): SalaryBudget | null {
  const live = input.paychecks.filter((p) => p.role === "live");
  if (live.length === 0) return null;
  const ceiling = live.reduce((a, p) => a + p.monthlyCents, 0);

  const f = input.forecast;
  const needLines = f.categories.filter((c) => NEEDS_CATEGORIES.has(c.name));
  const wantLines = f.categories.filter((c) => !NEEDS_CATEGORIES.has(c.name));
  const sum = (xs: Array<{ cents: number }>) => xs.reduce((a, x) => a + x.cents, 0);
  const needs = sum(f.bills) + sum(needLines);
  const wants = sum(f.subscriptions) + sum(wantLines);
  const leftover = ceiling - needs - wants - input.potsMonthlyCents;

  // Trim wants proportionally when the plan runs past the pay.
  const room = ceiling - needs - sum(f.subscriptions) - input.potsMonthlyCents;
  const wantTotal = sum(wantLines);
  const scale = wantTotal > 0 && room < wantTotal ? Math.max(0, room) / wantTotal : 1;
  const roundUp = (c: number) => Math.ceil(c / 500) * 500; // to the next $5
  const roundDown = (c: number) => Math.floor(c / 500) * 500;
  const suggestedLimits = [
    ...needLines.map((c) => ({ category: c.name, cents: roundUp(c.cents), trimmed: false })),
    ...wantLines.map((c) =>
      scale < 1
        ? { category: c.name, cents: roundDown(c.cents * scale), trimmed: true }
        : { category: c.name, cents: roundUp(c.cents), trimmed: false },
    ),
  ];

  const monthStart = new Date(input.now.getFullYear(), input.now.getMonth(), 1);
  const monthEnd = new Date(input.now.getFullYear(), input.now.getMonth() + 1, 1);
  const got = (role: PayRole) =>
    input.paychecks
      .filter((p) => p.role === role)
      .reduce(
        (acc, p) => {
          const r = paychecksBetween(input.history, p.perCheckCents, monthStart, monthEnd);
          return { count: acc.count + r.count, cents: acc.cents + r.cents };
        },
        { count: 0, cents: 0 },
      );
  const liveGot = got("live");
  const bonus = live.reduce((a, p) => {
    const r = paychecksBetween(input.history, p.perCheckCents, monthStart, monthEnd);
    return a + Math.max(0, r.count - 2) * p.perCheckCents;
  }, 0);
  const expected = Math.max(input.spentThisMonthCents, f.totalCents) + input.potsMonthlyCents;

  return {
    ceilingCents: ceiling,
    needsCents: needs,
    wantsCents: wants,
    potsCents: input.potsMonthlyCents,
    leftoverCents: leftover,
    needsShare: ceiling ? needs / ceiling : 0,
    wantsShare: ceiling ? wants / ceiling : 0,
    saveShare: ceiling ? Math.max(0, leftover + input.potsMonthlyCents) / ceiling : 0,
    thisMonth: {
      spentCents: input.spentThisMonthCents,
      expectedCents: expected,
      dipCents: Math.max(0, expected - ceiling),
      live: liveGot,
      invest: got("invest"),
      bonusCents: bonus,
    },
    suggestedLimits,
  };
}
