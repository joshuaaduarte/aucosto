// Service layer for the finance tool.
//
// Server actions, server components, widgets, and (eventually) agent route
// handlers MUST go through this module; they should never touch
// prisma.financeTransaction.* directly. Money values throughout this module
// are integer minor units (cents for USD). Sign convention: negative = debit
// / outflow, positive = credit / inflow.

import "server-only";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { recordEvent } from "@/lib/services/events";
import { parseCurrencyToCents, type FinanceAccountKind } from "@/lib/finance-accounts";
import { inferCategory } from "@/lib/finance-categories";
import { dedupeParsedRows } from "@/lib/finance-import";
import { parseStatementPdf, type StatementImportPreview } from "@/lib/statement-import";
import type { FinanceAccount, FinanceGoal, FinanceTransaction } from "@/generated/prisma/client";
import type { FinanceGoalCategory, FinanceGoalOwner, FinanceGoalStatus } from "@/lib/finance-goals";
import type { ParsedRow } from "@/lib/csv";

export type SaveFinanceAccountInput = {
  id?: string;
  name: string;
  kind: FinanceAccountKind;
  currentBalance: string;
  balanceUpdatedAt: string;
  statementBalance?: string;
  dueDate?: string;
  creditLimit?: string;
};

export type SaveFinanceGoalInput = {
  id?: string;
  name: string;
  owner: FinanceGoalOwner;
  category: FinanceGoalCategory;
  targetAmount: string;
  currentAmount: string;
  targetDate?: string;
  monthlyContribution?: string;
  status: FinanceGoalStatus;
  notes?: string;
};

export type ImportStatementInput = {
  fileName: string;
  bytes: Uint8Array;
  mimeType?: string;
};

export async function listAccounts(userId: string): Promise<FinanceAccount[]> {
  requireCan(userId, "finance", "read");
  return prisma.financeAccount.findMany({
    where: { userId },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });
}

export async function listGoals(userId: string): Promise<FinanceGoal[]> {
  requireCan(userId, "finance", "read");
  return prisma.financeGoal.findMany({
    where: { userId },
    orderBy: [{ status: "asc" }, { targetDate: "asc" }, { name: "asc" }],
  });
}

export async function listTransactions(
  userId: string,
  options: { limit?: number; since?: Date } = {},
): Promise<FinanceTransaction[]> {
  requireCan(userId, "finance", "read");
  return prisma.financeTransaction.findMany({
    where: {
      userId,
      ...(options.since ? { date: { gte: options.since } } : {}),
    },
    orderBy: { date: "desc" },
    take: options.limit ?? 100,
  });
}

export async function countTransactions(userId: string): Promise<number> {
  requireCan(userId, "finance", "read");
  return prisma.financeTransaction.count({ where: { userId } });
}

export async function saveAccount(
  userId: string,
  input: SaveFinanceAccountInput,
): Promise<void> {
  requireCan(userId, "finance", "write");

  const name = input.name.trim();
  if (!name) throw new Error("Account name is required.");
  if (!input.balanceUpdatedAt) throw new Error("Balance date is required.");

  const currentBalanceCents = parseCurrencyToCents(input.currentBalance);
  const statementBalanceCents = input.statementBalance?.trim()
    ? parseCurrencyToCents(input.statementBalance)
    : null;
  const creditLimitCents = input.creditLimit?.trim()
    ? parseCurrencyToCents(input.creditLimit)
    : null;

  const data = {
    name,
    kind: input.kind,
    currentBalanceCents,
    balanceUpdatedAt: new Date(`${input.balanceUpdatedAt}T12:00:00.000Z`),
    statementBalanceCents,
    dueDate: input.dueDate?.trim()
      ? new Date(`${input.dueDate}T12:00:00.000Z`)
      : null,
    creditLimitCents,
  };

  if (input.id) {
    const updated = await prisma.financeAccount.updateMany({
      where: { id: input.id, userId },
      data,
    });
    if (updated.count > 0) {
      await recordEvent({
        userId,
        tool: "finance",
        type: "finance.account_updated",
        refId: input.id,
        meta: { name, kind: input.kind },
      });
    }
    return;
  }

  const created = await prisma.financeAccount.create({
    data: {
      userId,
      ...data,
    },
  });

  await recordEvent({
    userId,
    tool: "finance",
    type: "finance.account_created",
    refId: created.id,
    meta: { name, kind: input.kind },
  });
}

export async function saveGoal(
  userId: string,
  input: SaveFinanceGoalInput,
): Promise<void> {
  requireCan(userId, "finance", "write");

  const name = input.name.trim();
  if (!name) throw new Error("Goal name is required.");

  const targetAmountCents = parseCurrencyToCents(input.targetAmount);
  if (targetAmountCents <= 0) throw new Error("Goal target must be above zero.");

  const currentAmountCents = parseCurrencyToCents(input.currentAmount || "0");
  const monthlyContributionCents = input.monthlyContribution?.trim()
    ? parseCurrencyToCents(input.monthlyContribution)
    : null;

  const data = {
    name,
    owner: input.owner,
    category: input.category,
    targetAmountCents,
    currentAmountCents,
    targetDate: input.targetDate?.trim()
      ? new Date(`${input.targetDate}T12:00:00.000Z`)
      : null,
    monthlyContributionCents,
    status: input.status,
    notes: input.notes?.trim() || null,
  };

  if (input.id) {
    const updated = await prisma.financeGoal.updateMany({
      where: { id: input.id, userId },
      data,
    });
    if (updated.count > 0) {
      await recordEvent({
        userId,
        tool: "finance",
        type: "finance.goal_updated",
        refId: input.id,
        meta: { name, category: input.category, status: input.status },
      });
    }
    return;
  }

  const created = await prisma.financeGoal.create({
    data: {
      userId,
      ...data,
    },
  });

  await recordEvent({
    userId,
    tool: "finance",
    type: "finance.goal_created",
    refId: created.id,
    meta: { name, category: input.category, status: input.status },
  });
}

// Sum of debits (amount < 0) since the given instant, as a positive cents
// value. Used by the hub widget for "spent this month".
export async function getSpendCentsSince(
  userId: string,
  since: Date,
): Promise<number> {
  requireCan(userId, "finance", "read");
  const agg = await prisma.financeTransaction.aggregate({
    where: { userId, date: { gte: since }, amount: { lt: 0 } },
    _sum: { amount: true },
  });
  return Math.abs(agg._sum.amount ?? 0);
}

export async function importTransactions(
  userId: string,
  rows: ParsedRow[],
): Promise<{ imported: number; deduped: number }> {
  requireCan(userId, "finance", "write");
  if (rows.length === 0) return { imported: 0, deduped: 0 };

  const sortedDates = rows.map((row) => row.date.getTime()).sort((a, b) => a - b);
  const existing = await prisma.financeTransaction.findMany({
    where: {
      userId,
      date: {
        gte: new Date(sortedDates[0]),
        lte: new Date(sortedDates[sortedDates.length - 1]),
      },
    },
  });

  const { rowsToImport, deduped } = dedupeParsedRows(rows, existing);

  if (rowsToImport.length > 0) {
    await prisma.financeTransaction.createMany({
      data: rowsToImport.map((r) => ({
        userId,
        date: r.date,
        amount: r.amount,
        description: r.description,
        account: r.account,
        category: inferCategory(r.description, r.amount),
        raw: r.raw,
      })),
    });
    await recordEvent({
      userId,
      tool: "finance",
      type: "finance.imported",
      meta: { count: rowsToImport.length, deduped },
    });
  }

  return { imported: rowsToImport.length, deduped };
}

export async function importStatement(
  userId: string,
  input: ImportStatementInput,
): Promise<StatementImportPreview & { imported: number; deduped: number }> {
  requireCan(userId, "finance", "write");

  const preview = parseStatementPdf(input);
  if (preview.rows.length === 0) {
    const warning = preview.warnings[0] ?? `No transactions found in ${preview.bankLabel} statement.`;
    throw new Error(warning);
  }

  const { imported, deduped } = await importTransactions(userId, preview.rows);
  return {
    ...preview,
    imported,
    deduped,
  };
}

export async function updateTransactionCategory(
  userId: string,
  id: string,
  category: string,
): Promise<void> {
  requireCan(userId, "finance", "write");
  const updated = await prisma.financeTransaction.updateMany({
    where: { id, userId },
    data: { category },
  });
  if (updated.count > 0) {
    await recordEvent({
      userId,
      tool: "finance",
      type: "finance.category_updated",
      refId: id,
      meta: { category },
    });
  }
}

export async function updateMatchingTransactionCategories(
  userId: string,
  input: { description: string; account?: string | null; category: string },
): Promise<number> {
  requireCan(userId, "finance", "write");

  const description = input.description.trim();
  if (!description) return 0;

  const updated = await prisma.financeTransaction.updateMany({
    where: {
      userId,
      description,
      ...(input.account != null ? { account: input.account } : { account: null }),
    },
    data: { category: input.category },
  });

  if (updated.count > 0) {
    await recordEvent({
      userId,
      tool: "finance",
      type: "finance.category_bulk_updated",
      meta: {
        category: input.category,
        description,
        account: input.account ?? null,
        count: updated.count,
      },
    });
  }

  return updated.count;
}

export async function deleteAllTransactions(userId: string): Promise<void> {
  requireCan(userId, "finance", "write");
  const { count } = await prisma.financeTransaction.deleteMany({
    where: { userId },
  });
  if (count > 0) {
    await recordEvent({
      userId,
      tool: "finance",
      type: "finance.cleared",
      meta: { count },
    });
  }
}
