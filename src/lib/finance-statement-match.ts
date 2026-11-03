// Pure statement-check logic: match a statement's lines to hand-logged
// entries, and check the statement's balances add up. No DB; tested in
// tests/finance-statement-match.test.ts.
//
// The idea comes from Actual Budget: an imported statement confirms the
// entries you already logged instead of duplicating them. Then, like YNAB,
// the statement's ending balance is compared with what the confirmed entries
// say it should be, and a finished check locks those entries.

const DAY_MS = 24 * 60 * 60 * 1000;

export type StatementLine = {
  key: string;
  date: Date;
  /** Cents, negative = money out. */
  amount: number;
  description: string;
};

export type LoggedEntry = {
  id: string;
  date: Date;
  amount: number;
  description: string;
};

export type StatementMatch = {
  /** Same amount, close date. */
  matched: Array<{ lineKey: string; entryId: string }>;
  /** Close date and similar name but a different amount (a tip, a typo). */
  nearMisses: Array<{ lineKey: string; entryId: string }>;
  /** On the statement, never logged. */
  statementOnly: string[];
  /** Logged, not on this statement (typo, wrong account, not posted yet). */
  entriesOnly: string[];
};

function words(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !/^\d+$/.test(w)),
  );
}

/** 0..1 share of the shorter name's words found in the other. */
export function nameSimilarity(a: string, b: string): number {
  const wa = words(a);
  const wb = words(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  let shared = 0;
  for (const w of wa) {
    if (wb.has(w)) {
      shared += 1;
      continue;
    }
    // "trader" vs "traderjoes": count prefix overlaps too.
    for (const other of wb) {
      if (other.startsWith(w) || w.startsWith(other)) {
        shared += 1;
        break;
      }
    }
  }
  return shared / Math.min(wa.size, wb.size);
}

function dayGap(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / DAY_MS;
}

export function matchStatement(
  lines: StatementLine[],
  entries: LoggedEntry[],
  options: { dayWindow?: number } = {},
): StatementMatch {
  const window = options.dayWindow ?? 5;
  const freeEntries = new Map(entries.map((e) => [e.id, e]));
  const matched: StatementMatch["matched"] = [];
  const nearMisses: StatementMatch["nearMisses"] = [];
  const unmatchedLines: StatementLine[] = [];

  // Pass 1: exact amount within the date window. Closest date wins, then the
  // more similar name, so two $5 coffees pair up with the right days.
  const byDate = [...lines].sort((a, b) => a.date.getTime() - b.date.getTime());
  for (const line of byDate) {
    let best: { entry: LoggedEntry; score: number } | null = null;
    for (const entry of freeEntries.values()) {
      if (entry.amount !== line.amount) continue;
      const gap = dayGap(entry.date, line.date);
      if (gap > window) continue;
      const score = gap - nameSimilarity(entry.description, line.description);
      if (!best || score < best.score) best = { entry, score };
    }
    if (best) {
      matched.push({ lineKey: line.key, entryId: best.entry.id });
      freeEntries.delete(best.entry.id);
    } else {
      unmatchedLines.push(line);
    }
  }

  // Pass 2: same direction, close date, similar name, amount within 30%.
  const statementOnly: string[] = [];
  for (const line of unmatchedLines) {
    let best: { entry: LoggedEntry; score: number } | null = null;
    for (const entry of freeEntries.values()) {
      if (Math.sign(entry.amount) !== Math.sign(line.amount)) continue;
      if (dayGap(entry.date, line.date) > window) continue;
      const similarity = nameSimilarity(entry.description, line.description);
      if (similarity < 0.5) continue;
      const larger = Math.max(Math.abs(entry.amount), Math.abs(line.amount));
      const diff = Math.abs(entry.amount - line.amount);
      if (diff > larger * 0.3) continue;
      const score = diff - similarity;
      if (!best || score < best.score) best = { entry, score };
    }
    if (best) {
      nearMisses.push({ lineKey: line.key, entryId: best.entry.id });
      freeEntries.delete(best.entry.id);
    } else {
      statementOnly.push(line.key);
    }
  }

  return { matched, nearMisses, statementOnly, entriesOnly: [...freeEntries.keys()] };
}

export function isLiabilityKind(kind: string): boolean {
  return kind === "credit_card" || kind === "loan";
}

/**
 * Does the statement add up? Balances are in the account's own terms: what
 * you have for cash/investments, what you owe for cards and loans. Entry
 * amounts are always negative = money out, so on a card a purchase raises
 * what you owe.
 */
export function checkStatementBalance(input: {
  kind: string;
  openingCents: number;
  closingCents: number;
  entryAmounts: number[];
}): { expectedClosingCents: number; differenceCents: number; adjustmentAmountCents: number } {
  const sum = input.entryAmounts.reduce((acc, a) => acc + a, 0);
  const liability = isLiabilityKind(input.kind);
  const expectedClosingCents = liability ? input.openingCents - sum : input.openingCents + sum;
  const differenceCents = input.closingCents - expectedClosingCents;
  return {
    expectedClosingCents,
    differenceCents,
    // The entry that closes the gap, in entry terms (negative = money out).
    adjustmentAmountCents: liability ? -differenceCents : differenceCents,
  };
}
