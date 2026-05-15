import type { FinanceTransaction } from "@/generated/prisma/client";
import { resolveCategory } from "@/lib/finance-categories";
import { isTrueExpenseTransaction } from "@/lib/finance-types";

export type SpendProjection = {
  spentCents: number;
  projectedCents: number;
  daysElapsed: number;
  daysInMonth: number;
  burnRateCentsPerDay: number;
};

export type CategoryProjection = {
  category: string;
  spentCents: number;
  projectedCents: number;
};

function monthInfo(now = new Date()): { daysElapsed: number; daysInMonth: number } {
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return {
    daysElapsed: Math.max(1, now.getDate()),
    daysInMonth,
  };
}

export function calculateSpendProjection(
  transactions: Pick<FinanceTransaction, "amount" | "description">[],
  now = new Date(),
): SpendProjection {
  const spentCents = transactions.reduce(
    (sum, tx) => sum + (isTrueExpenseTransaction(tx) ? Math.abs(tx.amount) : 0),
    0,
  );
  const { daysElapsed, daysInMonth } = monthInfo(now);
  const burnRateCentsPerDay = spentCents / daysElapsed;
  return {
    spentCents,
    projectedCents: Math.round(burnRateCentsPerDay * daysInMonth),
    daysElapsed,
    daysInMonth,
    burnRateCentsPerDay,
  };
}

export function projectCategories(
  transactions: Pick<FinanceTransaction, "amount" | "description" | "category">[],
  options: { limit?: number; now?: Date } = {},
): CategoryProjection[] {
  const { daysElapsed, daysInMonth } = monthInfo(options.now ?? new Date());
  const byCategory = new Map<string, number>();

  for (const tx of transactions) {
    if (!isTrueExpenseTransaction(tx)) continue;
    const category = resolveCategory(tx.category, tx.description, tx.amount);
    byCategory.set(category, (byCategory.get(category) ?? 0) + Math.abs(tx.amount));
  }

  return Array.from(byCategory.entries())
    .map(([category, spentCents]) => ({
      category,
      spentCents,
      projectedCents: Math.round((spentCents / daysElapsed) * daysInMonth),
    }))
    .sort((a, b) => b.projectedCents - a.projectedCents || b.spentCents - a.spentCents)
    .slice(0, options.limit ?? 5);
}
