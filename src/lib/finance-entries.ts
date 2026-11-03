// Pure helpers for hand-logged ("quick add") finance entries and their
// confirmation state. No DB; tested in tests/finance-entries.test.ts.
//
// Status lives in the existing FinanceTransaction.postedStatus column so this
// feature adds no columns to an existing table (prod schema changes go in by
// hand — see CLAUDE.md "Migration workflow"):
//   "pending"    — logged by hand, not yet seen on a statement
//   "cleared"    — seen on a statement (matched during a statement check)
//   "reconciled" — part of a finished statement check; locked from edits
//   null / other — imported rows (CSV/PDF/linked), treated as confirmed
//
// Who logged an entry rides in FinanceTransaction.raw as a small JSON object
// tagged with `"aucosto": 1`, so imported rows (whose raw is the source CSV
// line or provider JSON) are never misread as entry metadata.

import type { FinanceTransaction } from "@/generated/prisma/client";

export const ENTRY_PENDING = "pending";
export const ENTRY_CLEARED = "cleared";
export const ENTRY_RECONCILED = "reconciled";

export type EntryStatus = "pending" | "confirmed" | "locked";

export function entryStatus(tx: Pick<FinanceTransaction, "postedStatus">): EntryStatus {
  if (tx.postedStatus === ENTRY_PENDING) return "pending";
  if (tx.postedStatus === ENTRY_RECONCILED) return "locked";
  return "confirmed";
}

export function entryStatusLabel(status: EntryStatus): string {
  switch (status) {
    case "pending":
      return "Not on a statement yet";
    case "locked":
      return "Matches the bank";
    default:
      return "Confirmed";
  }
}

export type EntryVia = "quick_add" | "shortcut" | "statement" | "adjustment" | "move";

export type EntryMeta = {
  /** User id of the person who logged it. */
  by?: string;
  via?: EntryVia;
  /** Money moved between two accounts: both rows share a pair id. */
  pair?: string;
  side?: "out" | "in";
  /** Paid from a set-aside pot (FinanceGoal id): planned, so it stays out of the month's spending. */
  pot?: string;
};

export function encodeEntryMeta(meta: EntryMeta): string {
  return JSON.stringify({ aucosto: 1, ...meta });
}

export function readEntryMeta(raw: string | null | undefined): EntryMeta {
  if (!raw || raw[0] !== "{") return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed?.aucosto !== 1) return {};
    const meta: EntryMeta = {};
    if (typeof parsed.by === "string") meta.by = parsed.by;
    if (
      parsed.via === "quick_add" ||
      parsed.via === "shortcut" ||
      parsed.via === "statement" ||
      parsed.via === "adjustment" ||
      parsed.via === "move"
    ) {
      meta.via = parsed.via;
    }
    if (typeof parsed.pair === "string") meta.pair = parsed.pair;
    if (parsed.side === "out" || parsed.side === "in") meta.side = parsed.side;
    if (typeof parsed.pot === "string") meta.pot = parsed.pot;
    return meta;
  } catch {
    return {};
  }
}

/** "Josh Duarte" → "JD", "ana" → "A". */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0]![0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? "") : "";
  return (first + last).toUpperCase();
}

/**
 * Parse what someone typed into an amount box as positive cents.
 * Accepts "12", "12.5", "$12.50", "1,200". Returns null when it isn't a
 * positive amount.
 */
export function parseAmountInput(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!/^\d*\.?\d{0,2}$/.test(cleaned) || cleaned === "" || cleaned === ".") return null;
  const cents = Math.round(Number(cleaned) * 100);
  return Number.isFinite(cents) && cents > 0 ? cents : null;
}

function merchantKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export type MerchantSuggestion = {
  description: string;
  category: string | null;
  financeAccountId: string | null;
  /** Typical amount (most recent), positive cents. */
  amountCents: number;
};

type HistoryTx = Pick<
  FinanceTransaction,
  "description" | "category" | "financeAccountId" | "amount" | "date"
>;

/**
 * Merchants seen before, most recent first, for the quick-add autocomplete:
 * "Trader" → "Trader Joe's · Groceries". Only outflows; the latest entry for
 * a merchant decides its category and account.
 */
export function merchantSuggestions(history: HistoryTx[], limit = 60): MerchantSuggestion[] {
  const sorted = [...history].sort((a, b) => b.date.getTime() - a.date.getTime());
  const seen = new Map<string, MerchantSuggestion & { uses: number }>();
  for (const tx of sorted) {
    if (tx.amount >= 0) continue;
    const description = tx.description.trim();
    if (!description) continue;
    const key = merchantKey(description);
    const existing = seen.get(key);
    if (existing) {
      existing.uses += 1;
      continue;
    }
    seen.set(key, {
      description,
      category: tx.category,
      financeAccountId: tx.financeAccountId,
      amountCents: Math.abs(tx.amount),
      uses: 1,
    });
  }
  return [...seen.values()]
    .sort((a, b) => b.uses - a.uses)
    .slice(0, limit)
    .map(({ uses: _uses, ...rest }) => rest);
}

/** Suggestions whose name contains what was typed, best (prefix) first. */
export function filterMerchants(
  suggestions: MerchantSuggestion[],
  query: string,
  limit = 4,
): MerchantSuggestion[] {
  const q = merchantKey(query);
  if (!q) return [];
  const prefix: MerchantSuggestion[] = [];
  const contains: MerchantSuggestion[] = [];
  for (const s of suggestions) {
    const key = merchantKey(s.description);
    if (key === q) continue;
    if (key.startsWith(q)) prefix.push(s);
    else if (key.includes(q)) contains.push(s);
  }
  return [...prefix, ...contains].slice(0, limit);
}

/** The account this person logged their latest entry against. */
export function lastUsedAccountId(
  history: Array<Pick<FinanceTransaction, "financeAccountId" | "raw" | "date">>,
  userId: string,
): string | null {
  let best: { at: number; id: string } | null = null;
  for (const tx of history) {
    if (!tx.financeAccountId) continue;
    if (readEntryMeta(tx.raw).by !== userId) continue;
    const at = tx.date.getTime();
    if (!best || at > best.at) best = { at, id: tx.financeAccountId };
  }
  return best?.id ?? null;
}

// ── Evening "anything to log?" nudge ─────────────────────────────────────

const NUDGE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Nudge only people who actually log by hand (an entry in the last 30
 * days) and only on a day nothing was logged yet in their space.
 */
export function shouldNudgeToLog(input: { loggedLast30Days: number; loggedToday: number }): boolean {
  return input.loggedLast30Days > 0 && input.loggedToday === 0;
}

export const LOG_NUDGE = {
  title: "Anything to log today?",
  body: "Nothing's been logged in Finance today. It takes a few seconds.",
  line: "Anything to log in Finance today?",
  url: "/app/finance?add=1",
} as const;

export function thirtyDaysBefore(now: Date): Date {
  return new Date(now.getTime() - 30 * NUDGE_DAY_MS);
}
