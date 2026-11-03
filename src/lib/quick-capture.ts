// Pure helpers for the "+" quick-capture sheet (log a purchase, add to a
// list, add a task, start a timer). No DB, importable from client code.

import { categoryColor } from "./time-categories";

// ── Amount keypad ────────────────────────────────────────────────────────

export type KeypadKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "." | "back";

const MAX_WHOLE_DIGITS = 7;

/**
 * Apply one keypad press to the amount typed so far ("12.5" + "0" → "12.50").
 * Keeps at most two decimals and seven whole digits, never a leading zero
 * before another digit ("0" + "5" → "5"), and "." on empty becomes "0.".
 */
export function applyKeypadKey(current: string, key: KeypadKey): string {
  if (key === "back") return current.slice(0, -1);
  if (key === ".") {
    if (current.includes(".")) return current;
    return current === "" ? "0." : `${current}.`;
  }
  const [whole, decimals] = current.split(".");
  if (decimals !== undefined) {
    if (decimals.length >= 2) return current;
    return `${current}${key}`;
  }
  if (whole === "0") return key;
  if ((whole ?? "").length >= MAX_WHOLE_DIGITS) return current;
  return `${current}${key}`;
}

/** "1234.5" → "1,234.5" for the big amount display (keeps what was typed). */
export function formatTypedAmount(value: string): string {
  if (!value) return "0";
  const [whole, decimals] = value.split(".");
  const grouped = (whole || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimals === undefined ? grouped : `${grouped}.${decimals}`;
}

// ── Category look ────────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  groceries: "🛒",
  "food & drink": "🍽️",
  subscriptions: "🔁",
  transport: "🚗",
  shopping: "🛍️",
  "bills & utilities": "💡",
  health: "🩺",
  entertainment: "🎟️",
  pets: "🐾",
  housing: "🏠",
  insurance: "🛡️",
  income: "💵",
  other: "📦",
};

const LEADING_EMOJI = /^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)\s*/u;

/**
 * Icon and color for a finance category. Built-in categories have a fixed
 * emoji; your own can carry one at the start of the name ("🎁 Gifts", the
 * same convention habits use). Colors come from the shared palette.
 */
export function financeCategoryLook(category: string | null | undefined): {
  emoji: string | null;
  label: string;
  color: string;
} {
  const name = (category ?? "").trim();
  if (!name) return { emoji: null, label: "No category", color: categoryColor(null) };
  const match = name.match(LEADING_EMOJI);
  if (match) {
    const label = name.slice(match[0].length).trim() || name;
    return { emoji: match[1]!, label, color: categoryColor(label) };
  }
  return { emoji: CATEGORY_EMOJI[name.toLowerCase()] ?? null, label: name, color: categoryColor(name) };
}

// ── Capture modes ────────────────────────────────────────────────────────

export type CaptureMode = "spend" | "list" | "task" | "timer";

/** Which tabs the sheet offers: partners only get money and lists. */
export function captureModes(input: {
  financeVisible: boolean;
  isPartner: boolean;
}): CaptureMode[] {
  const modes: CaptureMode[] = [];
  if (input.financeVisible) modes.push("spend");
  modes.push("list");
  if (!input.isPartner) modes.push("task", "timer");
  return modes;
}

/** The remembered mode if it's still offered, else the first one. */
export function initialCaptureMode(modes: CaptureMode[], remembered: string | null): CaptureMode {
  const found = modes.find((m) => m === remembered);
  return found ?? modes[0] ?? "list";
}

/** Recent timer labels, newest first, without repeats (case-insensitive). */
export function recentTimerLabels(
  entries: Array<{ label: string; category: string | null }>,
  limit = 5,
): Array<{ label: string; category: string | null }> {
  const seen = new Set<string>();
  const out: Array<{ label: string; category: string | null }> = [];
  for (const entry of entries) {
    const label = entry.label.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, category: entry.category });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Category choices with the ones you use most first (ties keep the given
 * order), so the two rows that fit on a phone hold the likely picks.
 */
export function rankCategories(choices: string[], history: Array<{ category: string | null; amount: number }>): string[] {
  const counts = new Map<string, number>();
  for (const tx of history) {
    if (tx.amount >= 0 || !tx.category) continue;
    const key = tx.category.trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return choices
    .map((c, index) => ({ c, index, n: counts.get(c.toLowerCase()) ?? 0 }))
    .sort((a, b) => b.n - a.n || a.index - b.index)
    .map((x) => x.c);
}
