// Pure helpers for the "+" quick-capture sheet: which entries each viewer
// gets, which to suggest, plus the money keypad and category looks. No DB,
// importable from client code.

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

// ── Capture entries ──────────────────────────────────────────────────────
//
// Everything the "+" sheet can add, each tied to the tool (nav href) it
// belongs to. The sheet shows an entry only when that tool is in the
// viewer's menu (see nav-model's visibleTools), so a household partner,
// whose menu is Home + Money, can only ever get Home and Money entries.

export type CaptureMode =
  | "spend"
  | "list"
  | "chore-done"
  | "chore-new"
  | "task"
  | "event"
  | "timer"
  | "habit"
  | "reflect"
  | "person"
  | "work-note";

export type CaptureEntry = {
  mode: CaptureMode;
  label: string;
  emoji: string;
  /** The nav href of the tool this entry writes to. */
  tool: string;
};

export const CAPTURE_ENTRIES: CaptureEntry[] = [
  { mode: "spend", label: "Money", emoji: "💳", tool: "/app/finance" },
  { mode: "list", label: "Add to a list", emoji: "🛒", tool: "/app/home" },
  { mode: "chore-done", label: "Chore done", emoji: "✅", tool: "/app/home" },
  { mode: "chore-new", label: "New chore", emoji: "🧹", tool: "/app/home" },
  { mode: "task", label: "Task", emoji: "📝", tool: "/app/do" },
  { mode: "event", label: "Event", emoji: "📅", tool: "/app/calendar" },
  { mode: "timer", label: "Timer", emoji: "⏱️", tool: "/app/time" },
  { mode: "habit", label: "Habit done", emoji: "🔁", tool: "/app/habits" },
  { mode: "reflect", label: "How was today", emoji: "🌙", tool: "/app/reflect" },
  { mode: "person", label: "Note about someone", emoji: "👤", tool: "/app/rolodex" },
  { mode: "work-note", label: "Work note", emoji: "💼", tool: "/app/work" },
];

/** The entries a viewer can use: only those whose tool is in their menu. */
export function captureEntries(visibleToolHrefs: readonly string[]): CaptureEntry[] {
  const visible = new Set(visibleToolHrefs);
  return CAPTURE_ENTRIES.filter((entry) => visible.has(entry.tool));
}

/** Which entry each page puts first ("Add to a list" on Home, and so on). */
const PAGE_MODE: Array<[prefix: string, mode: CaptureMode]> = [
  ["/app/finance", "spend"],
  ["/app/home", "list"],
  ["/app/do", "task"],
  ["/app/time", "timer"],
  ["/app/calendar", "event"],
  ["/app/habits", "habit"],
  ["/app/reflect", "reflect"],
  ["/app/rolodex", "person"],
  ["/app/work", "work-note"],
];

/**
 * The entry that fits the hour: today's reflection in the evening (until it's
 * done), habits in the morning. Undefined the rest of the day.
 */
export function hourCaptureMode(hour: number, reflectedToday: boolean): CaptureMode | undefined {
  if (hour >= 18 && !reflectedToday) return "reflect";
  if (hour >= 5 && hour < 11) return "habit";
  return undefined;
}

/**
 * Up to three entries to put on top: the one that fits the current page,
 * then the one that fits the hour, then the ones used most in the recent
 * history (newest first), then the built-in order. Only entries in `available` are returned, without repeats.
 */
export function suggestCaptureModes(input: {
  available: readonly CaptureMode[];
  pathname: string;
  recent: readonly string[];
  /** From hourCaptureMode. */
  hourMode?: CaptureMode;
  limit?: number;
}): CaptureMode[] {
  const { available, pathname, recent, hourMode, limit = 3 } = input;
  const ok = new Set(available);
  const out: CaptureMode[] = [];
  const push = (mode: string | undefined) => {
    if (mode && ok.has(mode as CaptureMode) && !out.includes(mode as CaptureMode)) out.push(mode as CaptureMode);
  };
  push(PAGE_MODE.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1]);
  push(hourMode);
  const counts = new Map<string, number>();
  recent.forEach((mode) => counts.set(mode, (counts.get(mode) ?? 0) + 1));
  [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || recent.indexOf(a[0]) - recent.indexOf(b[0]))
    .forEach(([mode]) => push(mode));
  available.forEach(push);
  return out.slice(0, limit);
}

/** Add a used mode to the front of the recent history (kept to 12). */
export function rememberCaptureMode(recent: readonly string[], mode: CaptureMode): string[] {
  return [mode, ...recent].slice(0, 12);
}

/** Chores worth offering under "Chore done": due soonest first, at most six. */
export function choresToOffer<T extends { daysUntil: number; title: string }>(tasks: readonly T[], limit = 6): T[] {
  return [...tasks].sort((a, b) => a.daysUntil - b.daysUntil || a.title.localeCompare(b.title)).slice(0, limit);
}

/** Habits worth offering under "Habit done": due today and not yet done, morning ones first in the morning. */
export function habitsToOffer<T extends { dueToday: boolean; completedToday: boolean; dayPart: string }>(
  habits: readonly T[],
  hour: number,
  limit = 8,
): T[] {
  const part = hour < 11 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const rank = (habit: T) => (habit.dayPart === part ? 0 : habit.dayPart === "anytime" ? 1 : 2);
  return habits
    .filter((habit) => habit.dueToday && !habit.completedToday)
    .map((habit, index) => ({ habit, index }))
    .sort((a, b) => rank(a.habit) - rank(b.habit) || a.index - b.index)
    .map(({ habit }) => habit)
    .slice(0, limit);
}

/**
 * People to offer under "Note about someone": with no search, the ones you
 * were last in touch with; with a search, name matches (starts-with first).
 */
export function peopleToOffer<T extends { name: string; lastAt: string | null }>(
  people: readonly T[],
  query: string,
  limit = 6,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [...people]
      .sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? "") || a.name.localeCompare(b.name))
      .slice(0, limit);
  }
  return people
    .filter((person) => person.name.toLowerCase().includes(q))
    .sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      return aStarts - bStarts || a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

/** "HH:mm" for the next half hour after `now` (14:10 → 14:30, 14:40 → 15:00). */
export function nextHalfHour(now: Date): string {
  const d = new Date(now);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "HH:mm" plus `minutes`, wrapping past midnight (for an event's end field). */
export function addMinutesToClock(clock: string, minutes: number): string {
  const [h, m] = clock.split(":").map(Number);
  const total = (((h ?? 0) * 60 + (m ?? 0) + minutes) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** What the chooser's "type anything" box thinks you meant; the matching form opens prefilled, nothing saves until you confirm. */
export type CaptureGuess = { mode: CaptureMode; text: string; amount?: string };

const AMOUNT = String.raw`\$\s*(\d+(?:\.\d{1,2})?)|(\d+\.\d{2})`;
const MONEY_FIRST = new RegExp(String.raw`^(?:${AMOUNT})\s*(?:(?:at|on|for)\s+)?(.*)$`, "i");
const MONEY_LAST = new RegExp(String.raw`^(.+?)\s+(?:(?:for|was)\s+)?(?:${AMOUNT})$`, "i");

/**
 * "$12 coffee" / "coffee $12" / "lunch 8.50" → money; "milk, eggs" or
 * "buy milk" → a list; anything else → a task. A dollar sign or cents is
 * needed for money, so "2 hours of reading" stays a task. Falls back through
 * task → list when the guess isn't available to this viewer.
 */
export function guessCapture(raw: string, available: readonly CaptureMode[]): CaptureGuess | null {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return null;
  const can = (mode: CaptureMode) => available.includes(mode);
  const first = text.match(MONEY_FIRST);
  const last = first ? null : text.match(MONEY_LAST);
  if (can("spend") && (first || last)) {
    const amount = first ? (first[1] ?? first[2])! : (last![2] ?? last![3])!;
    const rest = first ? first[3]!.trim() : last![1]!.trim();
    return { mode: "spend", amount, text: rest };
  }
  const buy = text.match(/^(?:buy|get|pick up)\s+(.+)$/i);
  if (can("list") && (text.includes(",") || buy)) {
    return { mode: "list", text: buy ? buy[1]! : text };
  }
  if (can("task")) return { mode: "task", text };
  if (can("list")) return { mode: "list", text: buy ? buy[1]! : text };
  return null;
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
