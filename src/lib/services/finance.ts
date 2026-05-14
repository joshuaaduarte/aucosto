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
import type { FinanceTransaction } from "@/generated/prisma/client";
import type { ParsedRow } from "@/lib/csv";

export async function listTransactions(
  userId: string,
  options: { limit?: number } = {},
): Promise<FinanceTransaction[]> {
  requireCan(userId, "finance", "read");
  return prisma.financeTransaction.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: options.limit ?? 100,
  });
}

export async function countTransactions(userId: string): Promise<number> {
  requireCan(userId, "finance", "read");
  return prisma.financeTransaction.count({ where: { userId } });
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
): Promise<{ imported: number }> {
  requireCan(userId, "finance", "write");
  if (rows.length === 0) return { imported: 0 };
  await prisma.financeTransaction.createMany({
    data: rows.map((r) => ({
      userId,
      date: r.date,
      amount: r.amount,
      description: r.description,
      account: r.account,
      raw: r.raw,
    })),
  });
  await recordEvent({
    userId,
    tool: "finance",
    type: "finance.imported",
    meta: { count: rows.length },
  });
  return { imported: rows.length };
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
