export const HABIT_CADENCES = ["daily", "weekdays", "weekly", "custom"] as const;
export const HABIT_GOAL_UNITS = ["check", "count", "minutes"] as const;
export const HABIT_DAY_PARTS = ["morning", "day", "evening", "anytime"] as const;
export const HABIT_WEEKDAY_OPTIONS = [
  { value: 0, short: "Sun", label: "Sunday" },
  { value: 1, short: "Mon", label: "Monday" },
  { value: 2, short: "Tue", label: "Tuesday" },
  { value: 3, short: "Wed", label: "Wednesday" },
  { value: 4, short: "Thu", label: "Thursday" },
  { value: 5, short: "Fri", label: "Friday" },
  { value: 6, short: "Sat", label: "Saturday" },
] as const;

export type HabitCadence = (typeof HABIT_CADENCES)[number];
export type HabitGoalUnit = (typeof HABIT_GOAL_UNITS)[number];
export type HabitDayPart = (typeof HABIT_DAY_PARTS)[number];

export const HABIT_CADENCE_LABELS: Record<HabitCadence, string> = {
  daily: "Daily",
  weekdays: "Weekdays",
  weekly: "Weekly",
  custom: "Custom days",
};

export const HABIT_GOAL_UNIT_LABELS: Record<HabitGoalUnit, string> = {
  check: "Check",
  count: "Count",
  minutes: "Minutes",
};

export const HABIT_DAY_PART_LABELS: Record<HabitDayPart, string> = {
  morning: "Morning",
  day: "Throughout day",
  evening: "Evening",
  anytime: "Anytime",
};

export function formatHabitQuantity(value: number, unit: HabitGoalUnit) {
  if (unit === "minutes") {
    if (value >= 60 && value % 60 === 0) return `${value / 60}h`;
    if (value >= 60) {
      const hours = Math.floor(value / 60);
      const minutes = value % 60;
      return `${hours}h ${minutes}m`;
    }
    return `${value}m`;
  }
  if (unit === "count") {
    return `${value}x`;
  }
  return value === 1 ? "Done" : `${value} checks`;
}

export function parseHabitDays(input: string | null | undefined): number[] {
  if (!input) return [];
  return input
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
    .sort((a, b) => a - b);
}

export function serializeHabitDays(days: number[]) {
  return [...new Set(days)].sort((a, b) => a - b).join(",");
}

export function describeHabitCadence(cadence: HabitCadence, daysOfWeek: string | null | undefined) {
  if (cadence === "custom") {
    const labels = parseHabitDays(daysOfWeek)
      .map((value) => HABIT_WEEKDAY_OPTIONS.find((option) => option.value === value)?.short)
      .filter(Boolean);
    return labels.length > 0 ? labels.join(" · ") : "Custom";
  }
  if (cadence === "weekdays") return "Mon-Fri";
  return HABIT_CADENCE_LABELS[cadence];
}

export function weekdayName(value: number) {
  return HABIT_WEEKDAY_OPTIONS.find((option) => option.value === value)?.label ?? String(value);
}

/** Format minutes-since-local-midnight as a short 12-hour clock, e.g. "7:12am". */
export function formatClockMinutes(minutes: number): string {
  const normalized = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hours24 = Math.floor(normalized / 60);
  const mins = normalized % 60;
  const period = hours24 < 12 ? "am" : "pm";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(mins).padStart(2, "0")}${period}`;
}

/**
 * Last-7-days consistency for one habit, as the assistant snapshot reports
 * it. A weekly habit is due once per week, not on every day of it, so it
 * counts as one scheduled slot that's done when the week's progress reaches
 * the target. Other cadences count each due day.
 */
export function habitWeekConsistency(
  habit: { cadence: string; targetCount: number },
  last7: Array<{ due: boolean; completed: boolean; progress: number }>,
): { doneCount: number; scheduledCount: number; pct: number } {
  if (habit.cadence === "weekly") {
    const progress = last7.reduce((sum, day) => sum + day.progress, 0);
    const done = progress >= Math.max(1, habit.targetCount) ? 1 : 0;
    return { doneCount: done, scheduledCount: 1, pct: done * 100 };
  }
  const scheduledCount = last7.filter((day) => day.due).length;
  const doneCount = last7.filter((day) => day.due && day.completed).length;
  return {
    doneCount,
    scheduledCount,
    pct: scheduledCount > 0 ? Math.round((doneCount / scheduledCount) * 100) : 0,
  };
}

/**
 * Habit strength, 0–100 (Loop Habit Tracker's idea): an exponentially
 * smoothed score over scheduled slots, so one missed day dents it instead of
 * zeroing a streak. Each slot's value is 0–1 — partial progress counts
 * fractionally, a fallback/recovery ("kept alive") counts half.
 *
 * `slotsPerWeek` sets how fast it moves: a daily habit (7) reaches ~80%
 * after a month of perfect days; a weekly habit (1) moves more per slot.
 */
export function habitStrength(slots: number[], slotsPerWeek: number): number {
  const perDay = Math.max(1, slotsPerWeek) / 7;
  // Loop: multiplier = 0.5^(sqrt(frequency) / 13) per day, expressed per slot.
  const multiplier = Math.pow(0.5, Math.sqrt(1 / perDay) / 13);
  let score = 0;
  for (const raw of slots) {
    const value = Math.min(1, Math.max(0, raw));
    score = score * multiplier + value * (1 - multiplier);
  }
  return Math.round(score * 100);
}

/** Plain-language strength label for the card. */
export function habitStrengthLabel(strength: number): string {
  if (strength >= 80) return "Solid";
  if (strength >= 50) return "Building";
  if (strength >= 20) return "Starting";
  return "New";
}

/** Keywords for habits that tend to stick and are easy to measure. */
const FOCUS_KEYWORDS = /\b(steps?|walk|run|read|weigh|gym|workout|lift|exercise|sleep)/i;

/**
 * Pick up to `limit` habits to focus on when someone has more than they can
 * keep up with (Tiny Habits / Atomic Habits: a few at a time). Habits already
 * gaining strength win, then easily measured ones; ties go to the oldest.
 */
export function suggestFocusHabits<
  T extends { id: string; title: string; strength: number; createdAt: Date },
>(habits: T[], limit = 4): string[] {
  return habits
    .map((habit) => ({
      habit,
      score: habit.strength * 2 + (FOCUS_KEYWORDS.test(habit.title) ? 30 : 0),
    }))
    .sort(
      (a, b) =>
        b.score - a.score || a.habit.createdAt.getTime() - b.habit.createdAt.getTime(),
    )
    .slice(0, limit)
    .map(({ habit }) => habit.id);
}

/** Fresh-start moments (Monday, the 1st) — a good time to re-commit. */
export function freshStartLabel(now: Date): string | null {
  if (now.getDate() === 1) {
    return `New month. ${now.toLocaleDateString("en-US", { month: "long" })} starts clean.`;
  }
  if (now.getDay() === 1) return "New week. Last week doesn't count against this one.";
  return null;
}
