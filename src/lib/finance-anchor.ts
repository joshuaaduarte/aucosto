// Balances you type in are the truth ("anchors"). Transactions on an
// account sit on one side of its anchor:
//   - before it: history. Already inside the typed balance, so they never
//     change it; walked backwards they rebuild past balances.
//   - after it: live. Added on top of the typed balance they give an
//     "about $X now" estimate until the next balance update or statement
//     check sets a new anchor.
// Pure; tested in tests/finance-anchor.test.ts.

import type { FinanceTransaction } from "@/generated/prisma/client";
import type { BalancePoint } from "@/lib/finance-networth";
import { isLiabilityKind } from "@/lib/finance-statement-match";

type AnchoredTx = Pick<FinanceTransaction, "financeAccountId" | "amount" | "date" | "createdAt">;

function dayNumber(d: Date): number {
  return d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();
}

/**
 * After the anchor: dated a later day, or the same day but entered after
 * the balance was typed (a purchase logged that evening).
 */
export function isAfterAnchor(tx: Pick<FinanceTransaction, "date" | "createdAt">, anchor: Date): boolean {
  const txDay = dayNumber(tx.date);
  const anchorDay = dayNumber(anchor);
  if (txDay !== anchorDay) return txDay > anchorDay;
  return tx.createdAt > anchor;
}

/**
 * How a transaction moves the balance in the account's own terms: what you
 * have, or what you owe on a card or loan (a $5 charge raises what's owed).
 */
export function balanceEffect(kind: string, amountCents: number): number {
  return isLiabilityKind(kind) ? -amountCents : amountCents;
}

export type BalanceEstimate = {
  /** Typed balance + everything logged on the account since. */
  estimateCents: number;
  changeCents: number;
  entriesSince: number;
};

export function estimateBalance(
  account: { id: string; kind: string; currentBalanceCents: number; balanceUpdatedAt: Date },
  history: AnchoredTx[],
): BalanceEstimate {
  let change = 0;
  let count = 0;
  for (const t of history) {
    if (t.financeAccountId !== account.id || !isAfterAnchor(t, account.balanceUpdatedAt)) continue;
    change += balanceEffect(account.kind, t.amount);
    count += 1;
  }
  return { estimateCents: account.currentBalanceCents + change, changeCents: change, entriesSince: count };
}

/**
 * Past balances rebuilt from history: walk back from the earliest balance
 * you typed for the account, undoing each transaction before it. One point
 * at each month-end before that, and one just before the first transaction
 * (the opening balance), so the net-worth line can start earlier.
 */
export function walkBackBalances(input: {
  account: { id: string; kind: string };
  /** The earliest known balance for this account. */
  anchor: { balanceCents: number; asOf: Date };
  history: AnchoredTx[];
}): BalancePoint[] {
  const before = input.history
    .filter((t) => t.financeAccountId === input.account.id && !isAfterAnchor(t, input.anchor.asOf))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  if (before.length === 0) return [];

  const out: BalancePoint[] = [];
  let balance = input.anchor.balanceCents;
  let i = 0;
  // Month-ends strictly before the anchor's month, newest first.
  let monthEnd = new Date(input.anchor.asOf.getFullYear(), input.anchor.asOf.getMonth(), 1);
  const earliest = before[before.length - 1]!.date;
  while (monthEnd > earliest) {
    // Undo everything dated on or after this month boundary.
    while (i < before.length && before[i]!.date >= monthEnd) {
      balance -= balanceEffect(input.account.kind, before[i]!.amount);
      i++;
    }
    out.push({ financeAccountId: input.account.id, balanceCents: balance, asOf: new Date(monthEnd.getTime() - 1) });
    monthEnd = new Date(monthEnd.getFullYear(), monthEnd.getMonth() - 1, 1);
  }
  while (i < before.length) {
    balance -= balanceEffect(input.account.kind, before[i]!.amount);
    i++;
  }
  const opening = new Date(earliest.getFullYear(), earliest.getMonth(), earliest.getDate());
  out.push({ financeAccountId: input.account.id, balanceCents: balance, asOf: new Date(opening.getTime() - 1) });
  return out.sort((a, b) => a.asOf.getTime() - b.asOf.getTime());
}

/** Rebuilt points for every account, each from its earliest known balance. */
export function rebuiltBalancePoints(input: {
  accounts: Array<{ id: string; kind: string; currentBalanceCents: number; balanceUpdatedAt: Date }>;
  snapshots: BalancePoint[];
  history: AnchoredTx[];
}): BalancePoint[] {
  const out: BalancePoint[] = [];
  for (const a of input.accounts) {
    let anchor = { balanceCents: a.currentBalanceCents, asOf: a.balanceUpdatedAt };
    for (const s of input.snapshots) {
      if (s.financeAccountId === a.id && s.asOf < anchor.asOf) anchor = { balanceCents: s.balanceCents, asOf: s.asOf };
    }
    out.push(...walkBackBalances({ account: a, anchor, history: input.history }));
  }
  return out;
}

export type CardMonth = { chargedCents: number; paidCents: number };

/** A card's charges and payments in one calendar month. */
export function cardMonth(
  history: Array<Pick<FinanceTransaction, "financeAccountId" | "amount" | "date">>,
  cardId: string,
  monthStart: Date,
): CardMonth {
  const end = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
  let charged = 0;
  let paid = 0;
  for (const t of history) {
    if (t.financeAccountId !== cardId || t.date < monthStart || t.date >= end) continue;
    if (t.amount < 0) charged += -t.amount;
    else paid += t.amount;
  }
  return { chargedCents: charged, paidCents: paid };
}

// ── Does an imported file add up? ────────────────────────────────────────

export type RunningBalanceCheck = {
  /** The file's own running balance after its last row. */
  fileBalanceCents: number;
  /** What the typed balance says it should have been then. */
  expectedCents: number;
  diffCents: number;
  asOf: Date;
};

/**
 * Compare a file's running balance (checking exports have one) with the
 * typed balance walked back to the file's last day. Null when the file has
 * no balance column or runs past the anchor.
 */
export function checkRunningBalance(input: {
  rows: Array<{ date: Date; amount: number; runningBalanceCents?: number | null }>;
  account: { id: string; kind: string; currentBalanceCents: number; balanceUpdatedAt: Date };
  /** Transactions already on the account (not the ones being imported). */
  history: AnchoredTx[];
}): RunningBalanceCheck | null {
  const withBalance = input.rows.filter((r) => r.runningBalanceCents != null);
  if (withBalance.length === 0) return null;
  // Newest row: files list newest-first or oldest-first; among rows on the
  // newest day, the running balance after the day is the first row in a
  // newest-first file and the last in an oldest-first one.
  const newestFirst = withBalance[0]!.date >= withBalance[withBalance.length - 1]!.date;
  const lastDay = Math.max(...withBalance.map((r) => r.date.getTime()));
  const sameDay = withBalance.filter((r) => r.date.getTime() === lastDay);
  const last = newestFirst ? sameDay[0]! : sameDay[sameDay.length - 1]!;
  const anchor = input.account.balanceUpdatedAt;
  if (dayNumber(last.date) > dayNumber(anchor)) return null;
  let expected = input.account.currentBalanceCents;
  for (const t of input.history) {
    if (t.financeAccountId !== input.account.id) continue;
    if (dayNumber(t.date) > dayNumber(last.date) && !isAfterAnchor(t, anchor)) {
      expected -= balanceEffect(input.account.kind, t.amount);
    }
  }
  const fileBalance = last.runningBalanceCents!;
  return { fileBalanceCents: fileBalance, expectedCents: expected, diffCents: fileBalance - expected, asOf: last.date };
}
