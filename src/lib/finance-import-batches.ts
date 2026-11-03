// Groups imported (CSV / PDF statement) rows into the import they came from,
// so one bad import can be undone without clearing everything. Each import
// writes all its rows in one insert, so they share a createdAt; rows more
// than `gapMs` apart belong to different imports. Pure; tested in
// tests/finance-import-batches.test.ts.

import type { FinanceTransaction } from "@/generated/prisma/client";
import { classifyTransaction, isTrueExpenseType } from "@/lib/finance-types";

export const IMPORT_SYNC_SOURCE = "csv";

type ImportedRow = Pick<
  FinanceTransaction,
  "createdAt" | "date" | "amount" | "account" | "description"
>;

export type ImportBatch = {
  /** First and last createdAt in the batch: the window an undo deletes. */
  from: Date;
  to: Date;
  count: number;
  firstDate: Date;
  lastDate: Date;
  /** Account names as they appeared in the file. */
  accounts: string[];
  /** Counted as spending / income (transfers excluded), positive cents. */
  spentCents: number;
  incomeCents: number;
};

export function groupImportBatches(rows: ImportedRow[], gapMs = 60_000): ImportBatch[] {
  const sorted = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  type Building = ImportBatch & { accountSet: Set<string> };
  const batches: Building[] = [];
  let current: Building | null = null;
  for (const row of sorted) {
    if (!current || row.createdAt.getTime() - current.to.getTime() > gapMs) {
      current = {
        from: row.createdAt,
        to: row.createdAt,
        count: 0,
        firstDate: row.date,
        lastDate: row.date,
        accounts: [],
        accountSet: new Set(),
        spentCents: 0,
        incomeCents: 0,
      };
      batches.push(current);
    }
    current.to = row.createdAt;
    current.count += 1;
    if (row.date < current.firstDate) current.firstDate = row.date;
    if (row.date > current.lastDate) current.lastDate = row.date;
    const name = row.account?.trim();
    if (name) current.accountSet.add(name);
    const kind = classifyTransaction(row);
    if (row.amount < 0 && isTrueExpenseType(kind)) current.spentCents += Math.abs(row.amount);
    else if (kind === "income") current.incomeCents += row.amount;
  }
  return batches
    .map(({ accountSet, ...b }) => ({ ...b, accounts: [...accountSet].sort() }))
    .reverse();
}

// ── Fixing rows on the way in ────────────────────────────────────────────

/**
 * Some card exports (Amex, for one) list purchases as positive amounts and
 * payments as negative. Purchases far outnumber payments on any card, so a
 * card file that's mostly positive is flipped.
 */
export function cardRowsLookFlipped(rows: Array<{ amount: number }>): boolean {
  const nonZero = rows.filter((r) => r.amount !== 0);
  if (nonZero.length < 3) return false;
  const positive = nonZero.filter((r) => r.amount > 0).length;
  return positive / nonZero.length > 0.6;
}

/**
 * Tie imported rows to the account they came from: the account's name
 * replaces a missing account column, and card files with flipped signs are
 * turned around so purchases count as spending.
 */
export function prepareRowsForAccount<T extends { amount: number; account: string | null }>(
  rows: T[],
  account: { name: string; kind: string } | null,
): { rows: T[]; flipped: boolean } {
  if (!account) return { rows, flipped: false };
  const flipped = account.kind === "credit_card" && cardRowsLookFlipped(rows);
  return {
    flipped,
    rows: rows.map((r) => ({
      ...r,
      amount: flipped ? -r.amount : r.amount,
      account: r.account?.trim() ? r.account : account.name,
    })),
  };
}
