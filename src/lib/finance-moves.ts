// Pure helpers for "moved money": a card payment, a deposit into Robinhood,
// a move to savings. A move is two FinanceTransaction rows sharing a pair id
// (one leaving an account, one arriving in another). Their descriptions
// start with "Transfer to" / "Transfer from" so the existing classifier
// (finance-types.ts) files them as transfers: never spending, never income.
// Tested in tests/finance-moves.test.ts.

import type { FinanceTransaction } from "@/generated/prisma/client";
import { readEntryMeta } from "@/lib/finance-entries";

export const MOVE_PREFIX = "move:";

const LIABILITY_KINDS = new Set(["credit_card", "loan"]);

export function isLiabilityAccountKind(kind: string): boolean {
  return LIABILITY_KINDS.has(kind);
}

/** Row descriptions for both sides of a move. */
export function moveDescriptions(
  from: { name: string },
  to: { name: string; kind: string },
): { out: string; in: string } {
  const suffix = isLiabilityAccountKind(to.kind) ? " (card payment)" : "";
  return {
    out: `Transfer to ${to.name}${suffix}`.slice(0, 120),
    in: `Transfer from ${from.name}${suffix}`.slice(0, 120),
  };
}

export function moveExternalId(pair: string, side: "out" | "in"): string {
  return `${MOVE_PREFIX}${pair}:${side}`;
}

/** The other row's external id, or null when this isn't a move row. */
export function pairedExternalId(externalId: string | null | undefined): string | null {
  if (!externalId?.startsWith(MOVE_PREFIX)) return null;
  if (externalId.endsWith(":out")) return `${externalId.slice(0, -4)}:in`;
  if (externalId.endsWith(":in")) return `${externalId.slice(0, -3)}:out`;
  return null;
}

type MoveLike = Pick<FinanceTransaction, "externalId" | "raw">;

export function isMoveEntry(tx: MoveLike): boolean {
  return Boolean(tx.externalId?.startsWith(MOVE_PREFIX)) || readEntryMeta(tx.raw).via === "move";
}

/**
 * Money that arrived in each account through moves on or after `since`
 * (positive cents). Used to split an investment's monthly change into
 * "you put in" and "the market did".
 */
export function movedInSince(
  history: Array<Pick<FinanceTransaction, "externalId" | "raw" | "amount" | "date" | "financeAccountId">>,
  accountId: string,
  since: Date,
): number {
  let total = 0;
  for (const tx of history) {
    if (tx.financeAccountId !== accountId || tx.amount <= 0 || tx.date < since) continue;
    if (isMoveEntry(tx)) total += tx.amount;
  }
  return total;
}
