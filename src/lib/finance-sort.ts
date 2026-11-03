// The "sort one at a time" queue: spending entries with no category, oldest
// first, each with a suggested category (what that shop had last time, or a
// guess from its name). Pure; tested in tests/finance-sort.test.ts.

import { inferCategory } from "./finance-categories";
import { readEntryMeta } from "./finance-entries";
import { isMoveEntry } from "./finance-moves";

export type SortTx = {
  id: string;
  date: Date;
  amount: number;
  description: string;
  category: string | null;
  financeAccountId: string | null;
  raw: string | null;
  externalId: string | null;
};

export type SortItem = {
  id: string;
  /** "YYYY-MM-DD" */
  day: string;
  amountCents: number;
  description: string;
  accountName: string | null;
  byName: string | null;
  suggestion: string | null;
  /** How many entries in the queue share this shop (this one included). */
  sameShop: number;
};

function shopKey(description: string): string {
  return description.trim().replace(/\s+/g, " ").toLowerCase();
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function needsSorting(tx: Pick<SortTx, "amount" | "category" | "raw" | "externalId">): boolean {
  return tx.amount < 0 && !tx.category?.trim() && !isMoveEntry(tx);
}

export function buildSortQueue(input: {
  history: SortTx[];
  accountNames: Record<string, string>;
  names: Record<string, string>;
}): SortItem[] {
  // Latest known category per shop, from entries that have one.
  const known = new Map<string, { at: number; category: string }>();
  for (const tx of input.history) {
    const category = tx.category?.trim();
    if (!category || tx.amount >= 0 || category === "Income") continue;
    const key = shopKey(tx.description);
    const prev = known.get(key);
    if (!prev || tx.date.getTime() > prev.at) known.set(key, { at: tx.date.getTime(), category });
  }

  const todo = input.history
    .filter(needsSorting)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const shopCounts = new Map<string, number>();
  for (const tx of todo) shopCounts.set(shopKey(tx.description), (shopCounts.get(shopKey(tx.description)) ?? 0) + 1);

  return todo.map((tx) => {
    const key = shopKey(tx.description);
    const guessed = inferCategory(tx.description, tx.amount);
    const by = readEntryMeta(tx.raw).by;
    return {
      id: tx.id,
      day: dayKey(tx.date),
      amountCents: Math.abs(tx.amount),
      description: tx.description.trim() || "Purchase",
      accountName: tx.financeAccountId ? (input.accountNames[tx.financeAccountId] ?? null) : null,
      byName: by ? (input.names[by]?.split(" ")[0] ?? null) : null,
      suggestion: known.get(key)?.category ?? (guessed === "Other" ? null : guessed),
      sameShop: shopCounts.get(key) ?? 1,
    };
  });
}

/** Ids of other queued entries from the same shop (for "always use this"). */
export function sameShopIds(queue: Array<Pick<SortItem, "id" | "description">>, item: Pick<SortItem, "id" | "description">): string[] {
  const key = shopKey(item.description);
  return queue.filter((q) => q.id !== item.id && shopKey(q.description) === key).map((q) => q.id);
}
