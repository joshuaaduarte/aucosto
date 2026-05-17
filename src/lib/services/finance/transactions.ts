import "server-only";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { recordEvent } from "@/lib/services/events";
import { inferCategory } from "@/lib/finance-categories";
import { csvRowExternalId, dedupeParsedRows } from "@/lib/finance-import";
import {
  parseStatementPdf,
  type StatementImportPreview,
} from "@/lib/statement-import";
import type { FinanceTransaction } from "@/generated/prisma/client";
import type { ParsedRow } from "@/lib/csv";

export type ImportStatementInput = {
  fileName: string;
  bytes: Uint8Array;
  mimeType?: string;
};

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
        gte: new Date(sortedDates[0]!),
        lte: new Date(sortedDates[sortedDates.length - 1]!),
      },
    },
  });

  const { rowsToImport, deduped } = dedupeParsedRows(rows, existing);
  if (rowsToImport.length === 0) {
    return { imported: 0, deduped };
  }

  // The DB has @@unique([userId, externalId]); assigning a deterministic
  // "csv:<hash>" id makes re-imports of the same CSV idempotent at the DB
  // layer even if the in-memory fingerprint pass misses a row (different
  // whitespace, race with a concurrent import, etc.). skipDuplicates makes
  // the constraint a no-op insert instead of an error.
  const result = await prisma.financeTransaction.createMany({
    data: rowsToImport.map((r) => ({
      userId,
      externalId: csvRowExternalId(r),
      syncSource: "csv",
      date: r.date,
      amount: r.amount,
      description: r.description,
      account: r.account,
      category: inferCategory(r.description, r.amount),
      raw: r.raw,
    })),
    skipDuplicates: true,
  });

  const imported = result.count;
  const totalDeduped = deduped + (rowsToImport.length - imported);

  if (imported > 0) {
    await recordEvent({
      userId,
      tool: "finance",
      type: "finance.imported",
      meta: { count: imported, deduped: totalDeduped },
    });
  }

  return { imported, deduped: totalDeduped };
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
