// Imports confirm what you already logged instead of adding a second copy.
// Pure; tested in tests/finance-import-match.test.ts.
//
// When a bank file comes in, each row is matched against hand-logged entries
// that are still waiting for the bank ("pending"): same amount within a few
// days first, then a similar shop name with a slightly different amount (a
// tip, a typo). A matched entry keeps the name, date and category you gave it,
// takes the bank's amount, and is marked confirmed. What it looked like
// before rides in its raw metadata so undoing the import puts it back.

import { matchStatement } from "./finance-statement-match";

export type ImportRowLike = { date: Date; amount: number; description: string };

export type PendingEntry = {
  id: string;
  date: Date;
  amount: number;
  description: string;
};

export type ImportMatchPlan = {
  /** Rows that confirm an existing entry. `exact` = same amount. */
  confirms: Array<{ rowIndex: number; entryId: string; exact: boolean }>;
  /** Rows nothing matched: added as new entries. */
  newRows: number[];
};

export function planImportMatches(
  rows: ImportRowLike[],
  entries: PendingEntry[],
  options: { dayWindow?: number } = {},
): ImportMatchPlan {
  const lines = rows.map((r, i) => ({ key: String(i), date: r.date, amount: r.amount, description: r.description }));
  const match = matchStatement(lines, entries, options);
  const confirms = [
    ...match.matched.map((m) => ({ rowIndex: Number(m.lineKey), entryId: m.entryId, exact: true })),
    ...match.nearMisses.map((m) => ({ rowIndex: Number(m.lineKey), entryId: m.entryId, exact: false })),
  ].sort((a, b) => a.rowIndex - b.rowIndex);
  const taken = new Set(confirms.map((c) => c.rowIndex));
  const newRows = rows.map((_, i) => i).filter((i) => !taken.has(i));
  return { confirms, newRows };
}

/** What an entry looked like before an import confirmed it. */
export type ImportConfirmation = {
  /** When the import ran (ISO); groups it with that import for undo. */
  at: string;
  /** The row's import id ("csv:<hash>"), so re-importing the file skips it. */
  ext: string;
  /** The bank's description for the row. */
  bank: string;
  was: { amount: number; postedStatus: string | null; financeAccountId: string | null };
};

function parseRawObject(raw: string | null | undefined): Record<string, unknown> {
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && (parsed as Record<string, unknown>).aucosto === 1) {
        return { ...(parsed as Record<string, unknown>) };
      }
      return { aucosto: 1, original: raw };
    } catch {
      return { aucosto: 1, original: raw };
    }
  }
  return { aucosto: 1 };
}

/** The entry's raw with the confirmation added; other metadata is kept. */
export function withImportConfirmation(raw: string | null | undefined, c: ImportConfirmation): string {
  return JSON.stringify({ ...parseRawObject(raw), imported: c });
}

/** The entry's raw with the confirmation taken off (undoing the import). */
export function withoutImportConfirmation(raw: string | null | undefined): string {
  const obj = parseRawObject(raw);
  delete obj.imported;
  return JSON.stringify(obj);
}

export function readImportConfirmation(raw: string | null | undefined): ImportConfirmation | null {
  if (!raw || raw[0] !== "{") return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed?.aucosto !== 1) return null;
    const c = parsed.imported as Record<string, unknown> | undefined;
    if (!c || typeof c !== "object") return null;
    const was = c.was as Record<string, unknown> | undefined;
    if (typeof c.at !== "string" || typeof c.ext !== "string" || !was || typeof was.amount !== "number") return null;
    return {
      at: c.at,
      ext: c.ext,
      bank: typeof c.bank === "string" ? c.bank : "",
      was: {
        amount: was.amount,
        postedStatus: typeof was.postedStatus === "string" ? was.postedStatus : null,
        financeAccountId: typeof was.financeAccountId === "string" ? was.financeAccountId : null,
      },
    };
  } catch {
    return null;
  }
}
