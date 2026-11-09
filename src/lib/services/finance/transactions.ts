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
import { checkRunningBalance, type RunningBalanceCheck } from "@/lib/finance-anchor";
import { ENTRY_CLEARED, ENTRY_PENDING, ENTRY_RECONCILED, readEntryMeta } from "@/lib/finance-entries";
import { currentActorUserId } from "@/lib/actor";
import { applyShopRule, findShopRule, ruleFromConfirmation } from "@/lib/finance-shop-rules";
import { listShopRules, saveShopRule } from "./rules";
import {
  planImportMatches,
  readImportConfirmation,
  withImportConfirmation,
  withoutImportConfirmation,
} from "@/lib/finance-import-match";

const DAY_MS = 24 * 60 * 60 * 1000;
/** How far either side of the file's dates a hand-logged entry can sit and still match. */
const MATCH_DAYS = 5;

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

export type ImportResult = {
  imported: number;
  deduped: number;
  /** Rows that confirmed an entry you'd already logged instead of adding a copy. */
  matched: number;
  /** Of those, how many had a different amount (a tip, a typo); the bank's amount won. */
  adjusted: number;
  flipped: boolean;
  /** Null when the file has no running balance or no account was picked. */
  balanceCheck: RunningBalanceCheck | null;
};

export async function importTransactions(
  userId: string,
  inputRows: ParsedRow[],
  options: ImportOptions = {},
): Promise<ImportResult> {
  requireCan(userId, "finance", "write");
  if (inputRows.length === 0) {
    return { imported: 0, deduped: 0, matched: 0, adjusted: 0, flipped: false, balanceCheck: null };
  }

  const account = options.financeAccountId
    ? await prisma.financeAccount.findFirst({
        where: { id: options.financeAccountId, userId },
        select: { id: true, name: true, kind: true, currentBalanceCents: true, balanceUpdatedAt: true },
      })
    : null;
  if (options.financeAccountId && !account) throw new Error("That account wasn't found.");
  const { rows, flipped } = prepareRowsForAccount(inputRows, account);
  // A file with a running balance (checking exports) is checked against the
  // balance you typed, walked back to the file's last day.
  const balanceCheck =
    account && rows.some((r) => r.runningBalanceCents != null)
      ? checkRunningBalance({
          rows,
          account,
          history: await prisma.financeTransaction.findMany({
            where: { userId, financeAccountId: account.id },
            select: { financeAccountId: true, amount: true, date: true, createdAt: true },
          }),
        })
      : null;

  const sortedDates = rows.map((row) => row.date.getTime()).sort((a, b) => a - b);
  const firstDay = new Date(sortedDates[0]! - (MATCH_DAYS + 2) * DAY_MS);
  const lastDay = new Date(sortedDates[sortedDates.length - 1]! + (MATCH_DAYS + 2) * DAY_MS);
  const existing = await prisma.financeTransaction.findMany({
    where: { userId, date: { gte: firstDay, lte: lastDay } },
  });

  const { rowsToImport: unseen, deduped: exactDupes } = dedupeParsedRows(rows, existing);
  // Rows already in (a shop rule may have renamed them, so the text check
  // above misses them) or used by an earlier import to confirm an entry.
  const confirmedExts = new Set(
    existing
      .flatMap((e) => [e.externalId, readImportConfirmation(e.raw)?.ext])
      .filter((x): x is string => Boolean(x)),
  );
  const rowsToImport = unseen.filter((r) => !confirmedExts.has(csvRowExternalId(r)));
  const deduped = exactDupes + (unseen.length - rowsToImport.length);
  if (rowsToImport.length === 0) {
    return { imported: 0, deduped, matched: 0, adjusted: 0, flipped, balanceCheck };
  }

  // Hand-logged entries still waiting for the bank, in this account (or with
  // no account yet). Each file row can confirm one of them.
  const pending = existing.filter(
    (e) =>
      e.postedStatus === ENTRY_PENDING &&
      (!account || e.financeAccountId === account.id || e.financeAccountId === null),
  );
  const plan = planImportMatches(rowsToImport, pending, { dayWindow: MATCH_DAYS });
  const pendingById = new Map(pending.map((e) => [e.id, e]));
  const importedAt = new Date();
  const actor = currentActorUserId();
  const rules = await listShopRules(userId);

  const imported = await prisma.$transaction(async (tx) => {
    for (const c of plan.confirms) {
      const row = rowsToImport[c.rowIndex]!;
      const entry = pendingById.get(c.entryId)!;
      await tx.financeTransaction.update({
        where: { id: entry.id },
        data: {
          amount: row.amount,
          postedStatus: ENTRY_CLEARED,
          financeAccountId: entry.financeAccountId ?? account?.id ?? null,
          account: entry.account ?? row.account,
          raw: withImportConfirmation(entry.raw, {
            at: importedAt.toISOString(),
            ext: csvRowExternalId(row),
            bank: row.description.slice(0, 200),
            was: {
              amount: entry.amount,
              postedStatus: entry.postedStatus,
              financeAccountId: entry.financeAccountId,
            },
          }),
        },
      });
    }
    if (plan.newRows.length === 0) return 0;
    // The DB has @@unique([userId, externalId]); assigning a deterministic
    // "csv:<hash>" id makes re-imports of the same CSV idempotent at the DB
    // layer even if the in-memory fingerprint pass misses a row (different
    // whitespace, race with a concurrent import, etc.). skipDuplicates makes
    // the constraint a no-op insert instead of an error. Every row of one
    // import shares createdAt, which is how "Past imports" groups them.
    const result = await tx.financeTransaction.createMany({
      data: plan.newRows.map((i) => {
        const r = rowsToImport[i]!;
        // A remembered shop gives the row your name and category; the
        // bank's text stays in raw.
        const named = applyShopRule(
          { description: r.description, category: inferCategory(r.description, r.amount) },
          r.amount < 0 ? findShopRule(rules, r.description, actor) : null,
          { rename: true },
        );
        return {
          userId,
          financeAccountId: account?.id ?? null,
          externalId: csvRowExternalId(r),
          syncSource: IMPORT_SYNC_SOURCE,
          date: r.date,
          amount: r.amount,
          description: named.description,
          account: r.account,
          category: named.category,
          raw: r.raw,
          createdAt: importedAt,
        };
      }),
      skipDuplicates: true,
    });
    return result.count;
  });

  // Each confirmed entry teaches its shop: the bank's text now maps to the
  // name and category you gave it, for whoever logged it.
  const learned = new Set<string>();
  for (const c of plan.confirms) {
    const entry = pendingById.get(c.entryId)!;
    if (entry.amount >= 0) continue;
    const rule = ruleFromConfirmation({
      bankDescription: rowsToImport[c.rowIndex]!.description,
      yourDescription: entry.description,
      category: entry.category,
    });
    const owner = readEntryMeta(entry.raw).by ?? actor ?? userId;
    if (!rule || learned.has(`${owner}|${rule.match}`)) continue;
    learned.add(`${owner}|${rule.match}`);
    await saveShopRule(userId, {
      description: rowsToImport[c.rowIndex]!.description,
      name: rule.name ?? undefined,
      category: rule.category ?? undefined,
      ownerUserId: owner,
    });
  }

  const matched = plan.confirms.length;
  const adjusted = plan.confirms.filter((c) => !c.exact).length;
  const totalDeduped = deduped + (plan.newRows.length - imported);

  if (imported > 0 || matched > 0) {
    await recordEvent({
      userId,
      tool: "finance",
      type: "finance.imported",
      meta: { count: imported, matched, deduped: totalDeduped, ...(flipped ? { flipped } : {}) },
    });
  }

  return { imported, deduped: totalDeduped, matched, adjusted, flipped, balanceCheck };
}

export async function importStatement(
  userId: string,
  input: ImportStatementInput,
  options: ImportOptions = {},
): Promise<StatementImportPreview & ImportResult> {
  requireCan(userId, "finance", "write");

  const preview = parseStatementPdf(input);
  if (preview.rows.length === 0) {
    const warning = preview.warnings[0] ?? `No transactions found in ${preview.bankLabel} statement.`;
    throw new Error(warning);
  }

  const result = await importTransactions(userId, preview.rows, options);
  return { ...preview, ...result };
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
  const [rows, confirmed] = await Promise.all([
    prisma.financeTransaction.findMany({
      where: { userId, syncSource: IMPORT_SYNC_SOURCE },
      select: { createdAt: true, date: true, amount: true, account: true, description: true },
      orderBy: { createdAt: "asc" },
    }),
    listImportConfirmedEntries(userId),
  ]);
  return groupImportBatches([
    ...rows,
    ...confirmed.map((e) => ({
      createdAt: e.confirmation.at,
      date: e.date,
      amount: e.amount,
      account: e.account,
      description: e.description,
      confirmed: true,
    })),
  ]);
}

/** Hand-logged entries an import confirmed, with when and how. */
async function listImportConfirmedEntries(userId: string) {
  const rows = await prisma.financeTransaction.findMany({
    where: { userId, raw: { contains: '"imported":' } },
    select: { id: true, date: true, amount: true, account: true, description: true, raw: true, postedStatus: true },
  });
  return rows.flatMap((r) => {
    const c = readImportConfirmation(r.raw);
    return c ? [{ ...r, confirmation: { ...c, at: new Date(c.at) } }] : [];
  });
}

/**
 * Remove the rows one import added (imported rows created inside the
 * batch's createdAt window), and put back the hand-logged entries it
 * confirmed. Entries since locked by a statement check stay as they are.
 * Other hand-logged entries, moves, and linked-bank rows are never touched.
 */
export async function deleteImportBatch(
  userId: string,
  window: { from: Date; to: Date },
): Promise<number> {
  requireCan(userId, "finance", "write");
  const confirmed = (await listImportConfirmedEntries(userId)).filter(
    (e) =>
      e.postedStatus !== ENTRY_RECONCILED &&
      e.confirmation.at >= window.from &&
      e.confirmation.at <= window.to,
  );
  const count = await prisma.$transaction(async (tx) => {
    for (const e of confirmed) {
      await tx.financeTransaction.update({
        where: { id: e.id },
        data: {
          amount: e.confirmation.was.amount,
          postedStatus: e.confirmation.was.postedStatus,
          financeAccountId: e.confirmation.was.financeAccountId,
          raw: withoutImportConfirmation(e.raw),
        },
      });
    }
    const removed = await tx.financeTransaction.deleteMany({
      where: {
        userId,
        syncSource: IMPORT_SYNC_SOURCE,
        createdAt: { gte: window.from, lte: window.to },
      },
    });
    return removed.count + confirmed.length;
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
