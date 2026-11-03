import "server-only";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { recordEvent } from "@/lib/services/events";
import { inferCategory } from "@/lib/finance-categories";
import { csvRowExternalId, dedupeParsedRows } from "@/lib/finance-import";
import {
  groupImportBatches,
  IMPORT_SYNC_SOURCE,
  prepareRowsForAccount,
  type ImportBatch,
} from "@/lib/finance-import-batches";
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

export type ImportOptions = {
  /** The account the file came from: links rows to it and fixes card signs. */
  financeAccountId?: string | null;
};

export async function importTransactions(
  userId: string,
  inputRows: ParsedRow[],
  options: ImportOptions = {},
): Promise<{ imported: number; deduped: number; flipped: boolean }> {
  requireCan(userId, "finance", "write");
  if (inputRows.length === 0) return { imported: 0, deduped: 0, flipped: false };

  const account = options.financeAccountId
    ? await prisma.financeAccount.findFirst({
        where: { id: options.financeAccountId, userId },
        select: { id: true, name: true, kind: true },
      })
    : null;
  if (options.financeAccountId && !account) throw new Error("That account wasn't found.");
  const { rows, flipped } = prepareRowsForAccount(inputRows, account);

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
    return { imported: 0, deduped, flipped };
  }

  // The DB has @@unique([userId, externalId]); assigning a deterministic
  // "csv:<hash>" id makes re-imports of the same CSV idempotent at the DB
  // layer even if the in-memory fingerprint pass misses a row (different
  // whitespace, race with a concurrent import, etc.). skipDuplicates makes
  // the constraint a no-op insert instead of an error.
  const result = await prisma.financeTransaction.createMany({
    data: rowsToImport.map((r) => ({
      userId,
      financeAccountId: account?.id ?? null,
      externalId: csvRowExternalId(r),
      syncSource: IMPORT_SYNC_SOURCE,
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
      meta: { count: imported, deduped: totalDeduped, ...(flipped ? { flipped } : {}) },
    });
  }

  return { imported, deduped: totalDeduped, flipped };
}

export async function importStatement(
  userId: string,
  input: ImportStatementInput,
  options: ImportOptions = {},
): Promise<StatementImportPreview & { imported: number; deduped: number; flipped: boolean }> {
  requireCan(userId, "finance", "write");

  const preview = parseStatementPdf(input);
  if (preview.rows.length === 0) {
    const warning = preview.warnings[0] ?? `No transactions found in ${preview.bankLabel} statement.`;
    throw new Error(warning);
  }

  const { imported, deduped, flipped } = await importTransactions(userId, preview.rows, options);
  return {
    ...preview,
    imported,
    deduped,
    flipped,
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

// ── Imports (CSV / PDF statements) ─────────────────────────────────────

/** Past imports, newest first, each with what it added. */
export async function listImportBatches(userId: string): Promise<ImportBatch[]> {
  requireCan(userId, "finance", "read");
  const rows = await prisma.financeTransaction.findMany({
    where: { userId, syncSource: IMPORT_SYNC_SOURCE },
    select: { createdAt: true, date: true, amount: true, account: true, description: true },
    orderBy: { createdAt: "asc" },
  });
  return groupImportBatches(rows);
}

/**
 * Remove the rows one import added (imported rows created inside the
 * batch's createdAt window). Hand-logged entries, moves, and linked-bank
 * rows are never touched.
 */
export async function deleteImportBatch(
  userId: string,
  window: { from: Date; to: Date },
): Promise<number> {
  requireCan(userId, "finance", "write");
  const { count } = await prisma.financeTransaction.deleteMany({
    where: {
      userId,
      syncSource: IMPORT_SYNC_SOURCE,
      createdAt: { gte: window.from, lte: window.to },
    },
  });
  if (count > 0) {
    await recordEvent({
      userId,
      tool: "finance",
      type: "finance.import_undone",
      meta: { count },
    });
  }
  return count;
}
