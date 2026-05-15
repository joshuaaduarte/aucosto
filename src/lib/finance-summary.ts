import type { FinanceTransaction } from "@/generated/prisma/client";
import { resolveCategory } from "@/lib/finance-categories";
import { classifyTransaction, isTrueExpenseTransaction, type FinanceTransactionType } from "@/lib/finance-types";

export type MerchantSummary = {
  merchant: string;
  spendCents: number;
  count: number;
};

export type CategorySummary = {
  category: string;
  spendCents: number;
  count: number;
};

export type RecurringCandidate = {
  merchant: string;
  amountCents: number;
  count: number;
  account: string | null;
  lastDate: Date;
};

export type TransactionTypeSummary = {
  type: FinanceTransactionType;
  amountCents: number;
  count: number;
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function merchantKey(value: string): string {
  return normalizeText(value).toLowerCase();
}


export function summarizeCashflow(
  transactions: Pick<FinanceTransaction, "amount" | "description">[],
): { spentCents: number; incomeCents: number; netCents: number } {
  let spentCents = 0;
  let incomeCents = 0;

  for (const tx of transactions) {
    const type = classifyTransaction(tx);
    if (isTrueExpenseTransaction(tx)) spentCents += Math.abs(tx.amount);
    else if (type === "income" || type === "reimbursement") incomeCents += tx.amount;
  }

  return {
    spentCents,
    incomeCents,
    netCents: incomeCents - spentCents,
  };
}

export function topMerchantsBySpend(
  transactions: Pick<FinanceTransaction, "amount" | "description">[],
  options: { limit?: number } = {},
): MerchantSummary[] {
  const byMerchant = new Map<string, MerchantSummary>();

  for (const tx of transactions) {
    if (!isTrueExpenseTransaction(tx)) continue;
    const merchant = normalizeText(tx.description) || "Unknown";
    const key = merchantKey(merchant);
    const current = byMerchant.get(key) ?? {
      merchant,
      spendCents: 0,
      count: 0,
    };
    current.spendCents += Math.abs(tx.amount);
    current.count += 1;
    byMerchant.set(key, current);
  }

  return Array.from(byMerchant.values())
    .sort((a, b) => b.spendCents - a.spendCents || b.count - a.count)
    .slice(0, options.limit ?? 5);
}

export function topCategoriesBySpend(
  transactions: Pick<FinanceTransaction, "amount" | "description" | "category">[],
  options: { limit?: number } = {},
): CategorySummary[] {
  const byCategory = new Map<string, CategorySummary>();

  for (const tx of transactions) {
    if (!isTrueExpenseTransaction(tx)) continue;
    const category = resolveCategory(tx.category, tx.description, tx.amount);
    const current = byCategory.get(category) ?? {
      category,
      spendCents: 0,
      count: 0,
    };
    current.spendCents += Math.abs(tx.amount);
    current.count += 1;
    byCategory.set(category, current);
  }

  return Array.from(byCategory.values())
    .sort((a, b) => b.spendCents - a.spendCents || b.count - a.count)
    .slice(0, options.limit ?? 5);
}

export function findRecurringCandidates(
  transactions: Pick<FinanceTransaction, "amount" | "description" | "account" | "date">[],
  options: { limit?: number } = {},
): RecurringCandidate[] {
  const grouped = new Map<string, RecurringCandidate & { firstDate: Date }>();

  for (const tx of transactions) {
    if (!isTrueExpenseTransaction(tx)) continue;
    const merchant = normalizeText(tx.description) || "Unknown";
    const account = normalizeText(tx.account) || null;
    const key = [merchantKey(merchant), Math.abs(tx.amount), account?.toLowerCase() ?? ""].join("|");
    const current = grouped.get(key) ?? {
      merchant,
      amountCents: Math.abs(tx.amount),
      count: 0,
      account,
      firstDate: tx.date,
      lastDate: tx.date,
    };
    current.count += 1;
    if (tx.date < current.firstDate) current.firstDate = tx.date;
    if (tx.date > current.lastDate) current.lastDate = tx.date;
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .filter((item) => {
      if (item.count < 2) return false;
      const spreadDays =
        (item.lastDate.getTime() - item.firstDate.getTime()) / (24 * 60 * 60 * 1000);
      return spreadDays >= 25;
    })
    .sort((a, b) => b.amountCents - a.amountCents || b.count - a.count)
    .slice(0, options.limit ?? 5)
    .map(({ firstDate: _firstDate, ...rest }) => rest);
}

export function summarizeTransactionTypes(
  transactions: Pick<FinanceTransaction, "amount" | "description">[],
): TransactionTypeSummary[] {
  const grouped = new Map<FinanceTransactionType, TransactionTypeSummary>();

  for (const tx of transactions) {
    const type = classifyTransaction(tx);
    const current = grouped.get(type) ?? { type, amountCents: 0, count: 0 };
    current.amountCents += Math.abs(tx.amount);
    current.count += 1;
    grouped.set(type, current);
  }

  return Array.from(grouped.values()).sort(
    (a, b) => b.amountCents - a.amountCents || b.count - a.count,
  );
}
