// Summary derivation: day/week windows, progress, streaks, display ordering,
// and the HabitSummary shape. Pure math over already-fetched rows — no DB.

import "server-only";

import type { DoLane } from "@/lib/do";
import {
  type HabitDayPart,
  type HabitGoalUnit,
  HABIT_DAY_PART_LABELS,
  formatHabitQuantity,
  parseHabitDays,
} from "@/lib/habits";
import type { Habit, HabitEntry, TimeEntry } from "@/generated/prisma/client";
import type { HabitEntryMode, HabitWithRelations } from "./shared";

export type HabitSummary = Habit & {
  entriesToday: number;
  trackedMinutesToday: number;
  progressToday: number;
  completedToday: boolean;
  progressThisWeek: number;
  completedThisWeek: boolean;
  dueToday: boolean;
  currentStreak: number;
  keptAliveStreak: number;
  longestStreak: number;
  completionRate30d: number;
  keptAliveRate30d: number;
  fallbackLoggedToday: boolean;
  recoveryLoggedToday: boolean;
  keptAliveToday: boolean;
  needsSaveToday: boolean;
  salvageLabel: string | null;
  recentDays: Array<{
    dateKey: string;
    label: string;
    completed: boolean;
    due: boolean;
    keptAlive: boolean;
    mode: HabitEntryMode | null;
    progress: number;
  }>;
  cadenceLabel: string;
  targetLabel: string;
  dayPartLabel: string;
};

export type HabitTaskSummary = HabitSummary & {
  taskLane: DoLane;
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = startOfDay(date);
  next.setDate(next.getDate() + 1);
  return next;
}

function startOfWeek(date: Date) {
  const next = startOfDay(date);
  const day = next.getDay();
  const diff = (day + 6) % 7;
  next.setDate(next.getDate() - diff);
  return next;
}

function endOfWeek(date: Date) {
  const next = startOfWeek(date);
  next.setDate(next.getDate() + 7);
  return next;
}

function parseReminderMinutes(reminderTime: string | null | undefined) {
  if (!reminderTime) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(reminderTime.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function minutesSinceMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function normalizeDayPart(value: string | null | undefined): HabitDayPart {
  if (value === "morning" || value === "day" || value === "evening") return value;
  return "anytime";
}

function currentDayPart(now: Date): HabitDayPart {
  const hour = now.getHours();
  if (hour >= 4 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "day";
  if (hour >= 17 && hour < 24) return "evening";
  return "anytime";
}

function dayPartPriority(dayPart: HabitDayPart, now: Date) {
  const current = currentDayPart(now);
  const priorities: Record<HabitDayPart, HabitDayPart[]> = {
    morning: ["morning", "day", "anytime", "evening"],
    day: ["day", "anytime", "evening", "morning"],
    evening: ["evening", "anytime", "day", "morning"],
    anytime: ["anytime", "morning", "day", "evening"],
  };
  return priorities[current].indexOf(dayPart);
}

function compareReminderUrgency(a: HabitSummary, b: HabitSummary, now: Date) {
  const nowMinutes = minutesSinceMidnight(now);
  const aReminder = parseReminderMinutes(a.reminderTime);
  const bReminder = parseReminderMinutes(b.reminderTime);

  if (aReminder !== null && bReminder !== null) {
    const aDistance = Math.abs(aReminder - nowMinutes);
    const bDistance = Math.abs(bReminder - nowMinutes);
    if (aDistance !== bDistance) return aDistance - bDistance;
    if (aReminder !== bReminder) return aReminder - bReminder;
    return 0;
  }

  if (aReminder !== null) return -1;
  if (bReminder !== null) return 1;
  return 0;
}

export function compareHabitDisplayOrder(a: HabitSummary, b: HabitSummary, now: Date) {
  if (a.archivedAt && !b.archivedAt) return 1;
  if (!a.archivedAt && b.archivedAt) return -1;
  if (a.needsSaveToday !== b.needsSaveToday) return a.needsSaveToday ? -1 : 1;
  if (a.completedToday !== b.completedToday) return a.completedToday ? 1 : -1;
  if (a.dueToday !== b.dueToday) return a.dueToday ? -1 : 1;

  const aDayPart = normalizeDayPart(a.dayPart);
  const bDayPart = normalizeDayPart(b.dayPart);
  const aDayPartPriority = dayPartPriority(aDayPart, now);
  const bDayPartPriority = dayPartPriority(bDayPart, now);
  if (aDayPartPriority !== bDayPartPriority) return aDayPartPriority - bDayPartPriority;

  const reminderUrgency = compareReminderUrgency(a, b, now);
  if (reminderUrgency !== 0) return reminderUrgency;

  if (a.keptAliveToday !== b.keptAliveToday) return a.keptAliveToday ? 1 : -1;
  return b.updatedAt.getTime() - a.updatedAt.getTime();
}

function minutesFromEntries(entries: TimeEntry[]) {
  return entries.reduce((total, entry) => {
    if (!entry.endedAt) return total;
    return total + Math.max(0, Math.round((entry.endedAt.getTime() - entry.startedAt.getTime()) / 60000));
  }, 0);
}

function isDueOnDate(habit: Pick<Habit, "cadence" | "daysOfWeek">, date: Date) {
  switch (habit.cadence) {
    case "daily":
      return true;
    case "weekdays":
      return ![0, 6].includes(date.getDay());
    case "weekly":
      return true;
    case "custom":
      return parseHabitDays(habit.daysOfWeek).includes(date.getDay());
    default:
      return true;
  }
}

function fullEntries(entries: HabitEntry[]) {
  return entries.filter((entry) => entry.mode !== "fallback" && entry.mode !== "recovery");
}

function progressForWindow(
  habit: Pick<Habit, "goalUnit">,
  entries: HabitEntry[],
  timeEntries: TimeEntry[],
) {
  const manual = fullEntries(entries).reduce((sum, entry) => sum + entry.quantity, 0);
  if (habit.goalUnit === "minutes") {
    return Math.max(manual, minutesFromEntries(timeEntries));
  }
  return manual;
}

function progressForRange(
  habit: Pick<Habit, "goalUnit">,
  entries: HabitEntry[],
  timeEntries: TimeEntry[],
  start: Date,
  end: Date,
) {
  return progressForWindow(
    habit,
    entries.filter((entry) => entry.loggedAt >= start && entry.loggedAt < end),
    timeEntries.filter((entry) => entry.startedAt >= start && entry.startedAt < end),
  );
}

function buildDailyWindows(now: Date, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const day = startOfDay(now);
    day.setDate(day.getDate() - (count - 1 - index));
    return day;
  });
}

function modeForWindow(entries: HabitEntry[], completed: boolean): HabitEntryMode | null {
  if (completed) return "full";
  if (entries.some((entry) => entry.mode === "recovery")) return "recovery";
  if (entries.some((entry) => entry.mode === "fallback")) return "fallback";
  return null;
}

function keptAliveForWindow(habit: HabitWithRelations, start: Date, end: Date) {
  const entries = habit.entries.filter((entry) => entry.loggedAt >= start && entry.loggedAt < end);
  const timeEntries = habit.timeEntries.filter((entry) => entry.startedAt >= start && entry.startedAt < end);
  const progress = progressForWindow(habit, entries, timeEntries);
  const completed = progress >= habit.targetCount;
  const keptAlive = completed || entries.some((entry) => entry.mode === "fallback" || entry.mode === "recovery");
  return { completed, keptAlive, mode: modeForWindow(entries, completed) };
}

function streakForHabit(habit: HabitWithRelations, now: Date) {
  if (habit.cadence === "weekly") {
    let streak = 0;
    const cursor = startOfWeek(now);
    while (streak < 104) {
      const weekEnd = endOfWeek(cursor);
      const entries = habit.entries.filter((entry) => entry.loggedAt >= cursor && entry.loggedAt < weekEnd);
      const timeEntries = habit.timeEntries.filter((entry) => entry.startedAt >= cursor && entry.startedAt < weekEnd);
      const progress = progressForWindow(habit, entries, timeEntries);
      if (progress < habit.targetCount) break;
      streak += 1;
      cursor.setDate(cursor.getDate() - 7);
    }

    let longest = 0;
    let run = 0;
    for (let i = 52; i >= 0; i -= 1) {
      const weekStart = startOfWeek(now);
      weekStart.setDate(weekStart.getDate() - i * 7);
      const weekEnd = endOfWeek(weekStart);
      const entries = habit.entries.filter((entry) => entry.loggedAt >= weekStart && entry.loggedAt < weekEnd);
      const timeEntries = habit.timeEntries.filter((entry) => entry.startedAt >= weekStart && entry.startedAt < weekEnd);
      const progress = progressForWindow(habit, entries, timeEntries);
      if (progress >= habit.targetCount) {
        run += 1;
        longest = Math.max(longest, run);
      } else {
        run = 0;
      }
    }
    return { currentStreak: streak, longestStreak: longest };
  }

  const windows = buildDailyWindows(now, 60).filter((date) => isDueOnDate(habit, date));
  let current = 0;
  for (let i = windows.length - 1; i >= 0; i -= 1) {
    const day = windows[i]!;
    const nextDay = endOfDay(day);
    const entries = habit.entries.filter((entry) => entry.loggedAt >= day && entry.loggedAt < nextDay);
    const timeEntries = habit.timeEntries.filter((entry) => entry.startedAt >= day && entry.startedAt < nextDay);
    const progress = progressForWindow(habit, entries, timeEntries);
    if (progress >= habit.targetCount) {
      current += 1;
    } else {
      break;
    }
  }

  let longest = 0;
  let run = 0;
  for (const day of windows) {
    const nextDay = endOfDay(day);
    const entries = habit.entries.filter((entry) => entry.loggedAt >= day && entry.loggedAt < nextDay);
    const timeEntries = habit.timeEntries.filter((entry) => entry.startedAt >= day && entry.startedAt < nextDay);
    const progress = progressForWindow(habit, entries, timeEntries);
    if (progress >= habit.targetCount) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }

  return { currentStreak: current, longestStreak: longest };
}

function keptAliveStreakForHabit(habit: HabitWithRelations, now: Date) {
  if (habit.cadence === "weekly") {
    let streak = 0;
    const cursor = startOfWeek(now);
    while (streak < 104) {
      const weekEnd = endOfWeek(cursor);
      const { keptAlive } = keptAliveForWindow(habit, cursor, weekEnd);
      if (!keptAlive) break;
      streak += 1;
      cursor.setDate(cursor.getDate() - 7);
    }
    return streak;
  }

  const windows = buildDailyWindows(now, 60).filter((date) => isDueOnDate(habit, date));
  let current = 0;
  for (let i = windows.length - 1; i >= 0; i -= 1) {
    const day = windows[i]!;
    const nextDay = endOfDay(day);
    const { keptAlive } = keptAliveForWindow(habit, day, nextDay);
    if (keptAlive) {
      current += 1;
    } else {
      break;
    }
  }
  return current;
}

export function summarizeHabit(habit: HabitWithRelations, now: Date): HabitSummary {
  const todayStart = startOfDay(now);
  const tomorrow = endOfDay(now);
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);
  const todayEntries = habit.entries.filter((entry) => entry.loggedAt >= todayStart && entry.loggedAt < tomorrow);
  const todayTimeEntries = habit.timeEntries.filter((entry) => entry.startedAt >= todayStart && entry.startedAt < tomorrow);
  const entriesToday = fullEntries(todayEntries).reduce((sum, entry) => sum + entry.quantity, 0);
  const trackedMinutesToday = minutesFromEntries(todayTimeEntries);
  const progressToday = progressForWindow(habit, todayEntries, todayTimeEntries);
  const progressThisWeek = progressForRange(habit, habit.entries, habit.timeEntries, weekStart, weekEnd);
  const dueToday = isDueOnDate(habit, now);
  const completedToday = progressToday >= habit.targetCount;
  const completedThisWeek = progressThisWeek >= habit.targetCount;
  const { currentStreak, longestStreak } = streakForHabit(habit, now);
  const keptAliveStreak = keptAliveStreakForHabit(habit, now);
  const fallbackLoggedToday = todayEntries.some((entry) => entry.mode === "fallback");
  const recoveryLoggedToday = todayEntries.some((entry) => entry.mode === "recovery");
  const keptAliveToday = completedToday || fallbackLoggedToday || recoveryLoggedToday;
  const needsSaveToday = dueToday && !completedToday && !keptAliveToday;

  const recentDays = buildDailyWindows(now, 14).map((day) => {
    const nextDay = endOfDay(day);
    const due = isDueOnDate(habit, day);
    const entries = habit.entries.filter((entry) => entry.loggedAt >= day && entry.loggedAt < nextDay);
    const timeEntries = habit.timeEntries.filter((entry) => entry.startedAt >= day && entry.startedAt < nextDay);
    const progress = progressForWindow(habit, entries, timeEntries);
    const completed = due ? progress >= habit.targetCount : progress > 0;
    const keptAlive = due ? completed || entries.some((entry) => entry.mode === "fallback" || entry.mode === "recovery") : completed;
    return {
      dateKey: day.toISOString().slice(0, 10),
      label: day.toLocaleDateString([], { weekday: "short" }).slice(0, 2),
      due,
      progress,
      completed,
      keptAlive,
      mode: modeForWindow(entries, completed),
    };
  });

  const last30Due = buildDailyWindows(now, 30).filter((day) => isDueOnDate(habit, day));
  const completedCount = last30Due.filter((day) => {
    const nextDay = endOfDay(day);
    const entries = habit.entries.filter((entry) => entry.loggedAt >= day && entry.loggedAt < nextDay);
    const timeEntries = habit.timeEntries.filter((entry) => entry.startedAt >= day && entry.startedAt < nextDay);
    const progress = progressForWindow(habit, entries, timeEntries);
    return progress >= habit.targetCount;
  }).length;
  const keptAliveCount = last30Due.filter((day) => {
    const nextDay = endOfDay(day);
    const entries = habit.entries.filter((entry) => entry.loggedAt >= day && entry.loggedAt < nextDay);
    const timeEntries = habit.timeEntries.filter((entry) => entry.startedAt >= day && entry.startedAt < nextDay);
    const progress = progressForWindow(habit, entries, timeEntries);
    return progress >= habit.targetCount || entries.some((entry) => entry.mode === "fallback" || entry.mode === "recovery");
  }).length;

  return {
    ...habit,
    entriesToday,
    trackedMinutesToday,
    progressToday,
    completedToday,
    progressThisWeek,
    completedThisWeek,
    dueToday,
    currentStreak,
    keptAliveStreak,
    longestStreak,
    completionRate30d: last30Due.length > 0 ? Math.round((completedCount / last30Due.length) * 100) : 0,
    keptAliveRate30d: last30Due.length > 0 ? Math.round((keptAliveCount / last30Due.length) * 100) : 0,
    fallbackLoggedToday,
    recoveryLoggedToday,
    keptAliveToday,
    needsSaveToday,
    salvageLabel: habit.fallbackTitle ?? (habit.rescuePrompt ? "Run recovery" : null),
    recentDays,
    dayPartLabel: HABIT_DAY_PART_LABELS[normalizeDayPart(habit.dayPart)],
    cadenceLabel:
      habit.cadence === "custom"
        ? parseHabitDays(habit.daysOfWeek)
            .map((day) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day])
            .join(" · ")
        : habit.cadence === "weekdays"
          ? "Mon-Fri"
          : habit.cadence === "weekly"
            ? "Weekly"
            : "Daily",
    targetLabel:
      habit.goalUnit === "check"
        ? habit.targetCount === 1
          ? "Complete once"
          : `${habit.targetCount} checks`
        : `${formatHabitQuantity(habit.targetCount, habit.goalUnit as HabitGoalUnit)} target`,
  };
}

export function resolveHabitTaskLane(habit: HabitSummary): DoLane | null {
  if (habit.archivedAt) return null;
  if (habit.cadence === "weekly") {
    if (habit.completedThisWeek || habit.keptAliveToday) return null;
    return habit.dueToday ? "today" : "next";
  }
  if (!habit.dueToday || habit.completedToday || habit.keptAliveToday) return null;
  return "today";
}
