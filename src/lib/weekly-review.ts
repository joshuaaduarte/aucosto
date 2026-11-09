// The weekly review: one screen, five minutes, usually on Sunday.
//
// Looks back over one Monday-to-Sunday week (time, habits, finished tasks,
// spending, days the app was used) and then asks for next week's three
// priorities. Everything here is pure; the page gathers rows through the
// services and hands them in. Tested in tests/weekly-review.test.ts.

import { resolveCategory } from "@/lib/finance-categories";
import { isTrueExpenseTransaction } from "@/lib/finance-types";
import { parseHabitDays } from "@/lib/habits";

const DAY_MS = 86_400_000;

export const PRIORITY_LIMIT = 3;

export type ReviewWeek = {
  /** Monday 00:00 local. */
  start: Date;
  /** The following Monday 00:00 local (exclusive). */
  end: Date;
  /** End of the part that has happened: `now` for the current week. */
  through: Date;
  /** The week still in progress (reviewed on a Saturday or Sunday). */
  isCurrent: boolean;
  /** "Nov 3 to Nov 9". */
  label: string;
};

function startOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function addDays(date: Date, days: number): Date {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function mondayOf(date: Date): Date {
  const value = startOfDay(date);
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
  return value;
}

function shortDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Which week to review. On Saturday and Sunday it is the week now ending;
 * Monday to Friday it is the week that just finished, so a review done late
 * still looks at a whole week.
 */
export function reviewWeekFor(now: Date): ReviewWeek {
  const weekday = now.getDay();
  const isCurrent = weekday === 6 || weekday === 0;
  const start = isCurrent ? mondayOf(now) : addDays(mondayOf(now), -7);
  const end = addDays(start, 7);
  return {
    start,
    end,
    through: isCurrent ? now : end,
    isCurrent,
    label: `${shortDate(start)} to ${shortDate(addDays(end, -1))}`,
  };
}

/** The week after the one reviewed: where the priorities land. */
export function nextWeekLabel(week: ReviewWeek): string {
  const start = week.end;
  return `${shortDate(start)} to ${shortDate(addDays(start, 6))}`;
}

// ── Time ───────────────────────────────────────────────────────────────────

export type ReviewTimeEntry = {
  label: string;
  category: string | null;
  startedAt: Date;
  endedAt: Date | null;
};

export type ReviewShare = { name: string; amount: number };

export type TimeReview = {
  totalMinutes: number;
  /** Largest first, at most four, the rest folded into "Other". */
  byCategory: ReviewShare[];
  /** Days with at least one tracked minute. */
  daysTracked: number;
};

/** Top-N shares with the rest folded into one "Other" row. */
export function topShares(totals: Map<string, number>, limit = 4): ReviewShare[] {
  const sorted = [...totals.entries()]
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = sorted.slice(0, limit).map(([name, amount]) => ({ name, amount }));
  const rest = sorted.slice(limit).reduce((sum, [, amount]) => sum + amount, 0);
  if (rest > 0) top.push({ name: "Other", amount: rest });
  return top;
}

export function reviewTime(entries: ReviewTimeEntry[], week: ReviewWeek): TimeReview {
  const byCategory = new Map<string, number>();
  const days = new Set<string>();
  let total = 0;
  for (const entry of entries) {
    if (!entry.endedAt) continue;
    // Clip to the week so a session across Sunday midnight counts once.
    const from = Math.max(entry.startedAt.getTime(), week.start.getTime());
    const to = Math.min(entry.endedAt.getTime(), week.through.getTime());
    const minutes = Math.round((to - from) / 60_000);
    if (minutes <= 0) continue;
    total += minutes;
    const name = entry.category?.trim() || "Uncategorized";
    byCategory.set(name, (byCategory.get(name) ?? 0) + minutes);
    days.add(new Date(from).toLocaleDateString("en-CA"));
  }
  return { totalMinutes: total, byCategory: topShares(byCategory), daysTracked: days.size };
}

// ── Habits ─────────────────────────────────────────────────────────────────

export type ReviewHabit = {
  id: string;
  title: string;
  cadence: string;
  daysOfWeek: string | null;
  focus: "focus" | "later" | null;
  /** Days before a habit existed are never counted as missed. */
  createdAt?: Date;
};

export type HabitReviewRow = {
  id: string;
  title: string;
  /** Days done (daily kinds), or 0/1 (weekly). */
  done: number;
  /** Days it was due so far (daily kinds), or 1 (weekly). */
  due: number;
};

export type HabitReview = {
  rows: HabitReviewRow[];
  done: number;
  due: number;
  /** True when the list is the owner's focus habits, not every habit. */
  focusOnly: boolean;
};

export function isHabitDueOn(habit: Pick<ReviewHabit, "cadence" | "daysOfWeek">, date: Date): boolean {
  switch (habit.cadence) {
    case "weekdays":
      return date.getDay() !== 0 && date.getDay() !== 6;
    case "custom":
      return parseHabitDays(habit.daysOfWeek).includes(date.getDay());
    default:
      return true;
  }
}

/**
 * Focus habits when any are marked (that is the point of marking them),
 * otherwise every habit not parked as "later". Best kept first.
 */
export function reviewHabits(
  habits: ReviewHabit[],
  entries: Array<{ habitId: string; loggedAt: Date }>,
  week: ReviewWeek,
): HabitReview {
  const focusOnly = habits.some((habit) => habit.focus === "focus");
  const chosen = habits.filter(
    (habit) =>
      (focusOnly ? habit.focus === "focus" : habit.focus !== "later") &&
      (!habit.createdAt || habit.createdAt < week.through),
  );

  const daysByHabit = new Map<string, Set<string>>();
  for (const entry of entries) {
    if (entry.loggedAt < week.start || entry.loggedAt >= week.through) continue;
    const set = daysByHabit.get(entry.habitId) ?? new Set<string>();
    set.add(entry.loggedAt.toLocaleDateString("en-CA"));
    daysByHabit.set(entry.habitId, set);
  }

  const elapsedDays: Date[] = [];
  for (let day = new Date(week.start); day < week.through; day = addDays(day, 1)) {
    elapsedDays.push(new Date(day));
  }

  const rows = chosen.map((habit): HabitReviewRow => {
    const doneDays = daysByHabit.get(habit.id) ?? new Set<string>();
    if (habit.cadence === "weekly") {
      return { id: habit.id, title: habit.title, done: doneDays.size > 0 ? 1 : 0, due: 1 };
    }
    const firstDay = habit.createdAt ? startOfDay(habit.createdAt) : week.start;
    const dueDays = elapsedDays.filter((day) => day >= firstDay && isHabitDueOn(habit, day));
    const done = dueDays.filter((day) => doneDays.has(day.toLocaleDateString("en-CA"))).length;
    return { id: habit.id, title: habit.title, done, due: dueDays.length };
  });

  rows.sort(
    (a, b) =>
      (b.due ? b.done / b.due : 0) - (a.due ? a.done / a.due : 0) || a.title.localeCompare(b.title),
  );
  return {
    rows,
    done: rows.reduce((sum, row) => sum + row.done, 0),
    due: rows.reduce((sum, row) => sum + row.due, 0),
    focusOnly,
  };
}

// ── Tasks ──────────────────────────────────────────────────────────────────

export type ReviewTask = { id: string; title: string; completedAt: Date | null };

export function reviewCompletedTasks(
  tasks: ReviewTask[],
  week: ReviewWeek,
  limit = 6,
): { count: number; titles: string[] } {
  const done = tasks
    .filter((task) => task.completedAt && task.completedAt >= week.start && task.completedAt < week.through)
    .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime());
  return { count: done.length, titles: done.slice(0, limit).map((task) => task.title) };
}

// ── Money ──────────────────────────────────────────────────────────────────

export type ReviewTransaction = {
  amount: number;
  description: string;
  category: string | null;
  date: Date;
};

export type MoneyReview = {
  /** Positive cents of real spending (no card payments or moves). */
  spentCents: number;
  entryCount: number;
  byCategory: ReviewShare[];
};

export function reviewMoney(transactions: ReviewTransaction[], week: ReviewWeek): MoneyReview {
  const byCategory = new Map<string, number>();
  let spent = 0;
  let count = 0;
  for (const tx of transactions) {
    if (tx.date < week.start || tx.date >= week.end) continue;
    if (!isTrueExpenseTransaction(tx)) continue;
    const cents = Math.abs(tx.amount);
    spent += cents;
    count += 1;
    const category = resolveCategory(tx.category, tx.description, tx.amount);
    byCategory.set(category, (byCategory.get(category) ?? 0) + cents);
  }
  return { spentCents: spent, entryCount: count, byCategory: topShares(byCategory, 3) };
}

// ── Summary ────────────────────────────────────────────────────────────────

/** Days of the reviewed week that have happened, today included. */
export function elapsedDayCount(week: ReviewWeek): number {
  if (!week.isCurrent) return 7;
  return Math.round((startOfDay(week.through).getTime() - week.start.getTime()) / DAY_MS) + 1;
}

export function reviewHeadline(input: {
  week: ReviewWeek;
  daysUsed: number;
  time: TimeReview;
  habits: HabitReview;
  tasks: { count: number };
}): string {
  const { daysUsed, time, habits, tasks } = input;
  const days = elapsedDayCount(input.week);
  if (daysUsed === 0 && time.totalMinutes === 0 && tasks.count === 0 && habits.done === 0) {
    return "A quiet week in the app. Nothing to judge, just pick three things for next week.";
  }
  const parts: string[] = [`You used Aucosto on ${daysUsed} of ${days} days`];
  if (tasks.count > 0) parts.push(`finished ${tasks.count} ${tasks.count === 1 ? "task" : "tasks"}`);
  if (habits.due > 0) parts.push(`kept ${habits.done} of ${habits.due} habit check-ins`);
  if (parts.length === 1) return `${parts[0]}.`;
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}.`;
}

/** Habit that this review ticks off when saved ("Weekly review", "🗺️ Weekly review"). */
export function findWeeklyReviewHabit<T extends { title: string; archivedAt?: Date | null }>(
  habits: T[],
): T | null {
  return habits.find((habit) => !habit.archivedAt && /weekly\s+review/i.test(habit.title)) ?? null;
}

// ── Saved reviews ──────────────────────────────────────────────────────────
//
// A saved review is one "review.saved" event. Its meta carries the week it
// looked back on, the week the priorities are for, and the picks themselves,
// so there is no table: the event log is the record.

export const REVIEW_NOTE_LIMIT = 500;

export type SavedReview = {
  at: Date;
  /** Monday "YYYY-MM-DD" of the week looked back on. */
  reviewedWeek: string;
  /** Monday "YYYY-MM-DD" of the week the priorities are for. */
  forWeek: string;
  priorities: Array<{ id: string; title: string }>;
  note: string | null;
};

export function weekKey(date: Date): string {
  return mondayOf(date).toLocaleDateString("en-CA");
}

const WEEK_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Read a "review.saved" event's meta back; null when it is not one we wrote. */
export function parseSavedReview(meta: unknown, at: Date): SavedReview | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const record = meta as Record<string, unknown>;
  const { reviewedWeek, forWeek } = record;
  if (typeof reviewedWeek !== "string" || !WEEK_KEY.test(reviewedWeek)) return null;
  if (typeof forWeek !== "string" || !WEEK_KEY.test(forWeek)) return null;
  const priorities = Array.isArray(record.priorities)
    ? record.priorities.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const { id, title } = item as Record<string, unknown>;
        return typeof id === "string" && typeof title === "string" ? [{ id, title }] : [];
      })
    : [];
  const note = typeof record.note === "string" && record.note.trim() ? record.note : null;
  return { at, reviewedWeek, forWeek, priorities: priorities.slice(0, PRIORITY_LIMIT), note };
}

/** The newest saved review for one week (saving again replaces the last one). */
export function latestReviewFor(
  reviews: SavedReview[],
  field: "reviewedWeek" | "forWeek",
  key: string,
): SavedReview | null {
  let latest: SavedReview | null = null;
  for (const review of reviews) {
    if (review[field] !== key) continue;
    if (!latest || review.at > latest.at) latest = review;
  }
  return latest;
}

export type PriorityOutcome = { id: string; title: string; done: boolean; missing: boolean };

/** How last week's picks went, against the current state of those tasks. */
export function priorityOutcomes(
  review: SavedReview,
  tasks: Array<{ id: string; title: string; status: string }>,
): PriorityOutcome[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  return review.priorities.map((pick) => {
    const task = byId.get(pick.id);
    return {
      id: pick.id,
      title: task?.title ?? pick.title,
      done: task?.status === "done",
      missing: !task,
    };
  });
}

export type HubReviewState =
  | { kind: "nudge"; label: string }
  | { kind: "priorities"; heading: string; review: SavedReview };

/**
 * What the hub shows: the picks from the review of the week in view (for this
 * week when saved Monday to Friday, for the coming one when saved on the
 * weekend), else a nudge on Saturday to Monday while that week is unreviewed,
 * else nothing. A review always plans the week after the one it looked back
 * on, so the weekend nudge replaces this week's picks until it is done.
 */
export function hubReviewState(now: Date, reviews: SavedReview[]): HubReviewState | null {
  const week = reviewWeekFor(now);
  const thisMonday = weekKey(now);
  const reviewed = latestReviewFor(reviews, "reviewedWeek", weekKey(week.start));
  if (reviewed && reviewed.priorities.length > 0) {
    const forThisWeek = reviewed.forWeek === thisMonday;
    return {
      kind: "priorities",
      heading: forThisWeek ? "This week's three" : "Next week's three",
      review: reviewed,
    };
  }
  const weekday = now.getDay();
  if (!reviewed && (weekday === 6 || weekday === 0 || weekday === 1)) {
    return { kind: "nudge", label: week.label };
  }
  return null;
}

/** Valid priority picks: unique, open-task ids only, at most three. */
export function cleanPriorityIds(ids: string[], openIds: Set<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!openIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length === PRIORITY_LIMIT) break;
  }
  return out;
}
