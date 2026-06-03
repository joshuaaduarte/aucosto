import "server-only";

import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import type { DoLane } from "@/lib/do";
import {
  type HabitCadence,
  type HabitGoalUnit,
  formatHabitQuantity,
  parseHabitDays,
} from "@/lib/habits";
import { recordEvent } from "@/lib/services/events";
import { startEntry } from "@/lib/services/time";
import type { Habit, HabitEntry, TimeEntry } from "@/generated/prisma/client";

type HabitWithRelations = Habit & {
  entries: HabitEntry[];
  timeEntries: TimeEntry[];
};

export type SaveHabitInput = {
  title: string;
  bucket?: string | null;
  notes?: string | null;
  cadence?: HabitCadence;
  daysOfWeek?: string | null;
  targetCount?: number;
  goalUnit?: HabitGoalUnit;
  defaultDurationMinutes?: number | null;
  reminderTime?: string | null;
};

export type HabitSummary = Habit & {
  entriesToday: number;
  trackedMinutesToday: number;
  progressToday: number;
  completedToday: boolean;
  progressThisWeek: number;
  completedThisWeek: boolean;
  dueToday: boolean;
  currentStreak: number;
  longestStreak: number;
  completionRate30d: number;
  recentDays: Array<{
    dateKey: string;
    label: string;
    completed: boolean;
    due: boolean;
    progress: number;
  }>;
  cadenceLabel: string;
  targetLabel: string;
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

function sanitizeTitle(title: string) {
  return title.trim();
}

function sanitizeOptionalString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
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

function progressForWindow(
  habit: Pick<Habit, "goalUnit">,
  entries: HabitEntry[],
  timeEntries: TimeEntry[],
) {
  const manual = entries.reduce((sum, entry) => sum + entry.quantity, 0);
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

function summarizeHabit(habit: HabitWithRelations, now: Date): HabitSummary {
  const todayStart = startOfDay(now);
  const tomorrow = endOfDay(now);
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);
  const todayEntries = habit.entries.filter((entry) => entry.loggedAt >= todayStart && entry.loggedAt < tomorrow);
  const todayTimeEntries = habit.timeEntries.filter((entry) => entry.startedAt >= todayStart && entry.startedAt < tomorrow);
  const entriesToday = todayEntries.reduce((sum, entry) => sum + entry.quantity, 0);
  const trackedMinutesToday = minutesFromEntries(todayTimeEntries);
  const progressToday = progressForWindow(habit, todayEntries, todayTimeEntries);
  const progressThisWeek = progressForRange(habit, habit.entries, habit.timeEntries, weekStart, weekEnd);
  const dueToday = isDueOnDate(habit, now);
  const completedToday = progressToday >= habit.targetCount;
  const completedThisWeek = progressThisWeek >= habit.targetCount;
  const { currentStreak, longestStreak } = streakForHabit(habit, now);

  const recentDays = buildDailyWindows(now, 14).map((day) => {
    const nextDay = endOfDay(day);
    const due = isDueOnDate(habit, day);
    const entries = habit.entries.filter((entry) => entry.loggedAt >= day && entry.loggedAt < nextDay);
    const timeEntries = habit.timeEntries.filter((entry) => entry.startedAt >= day && entry.startedAt < nextDay);
    const progress = progressForWindow(habit, entries, timeEntries);
    return {
      dateKey: day.toISOString().slice(0, 10),
      label: day.toLocaleDateString([], { weekday: "short" }).slice(0, 2),
      due,
      progress,
      completed: due ? progress >= habit.targetCount : progress > 0,
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
    longestStreak,
    completionRate30d: last30Due.length > 0 ? Math.round((completedCount / last30Due.length) * 100) : 0,
    recentDays,
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

function resolveHabitTaskLane(habit: HabitSummary): DoLane | null {
  if (habit.archivedAt) return null;
  if (habit.cadence === "weekly") {
    if (habit.completedThisWeek) return null;
    return habit.dueToday ? "today" : "next";
  }
  if (!habit.dueToday || habit.completedToday) return null;
  return "today";
}

export async function listHabits(
  userId: string,
  options: { includeArchived?: boolean } = {},
): Promise<HabitSummary[]> {
  requireCan(userId, "habit", "read");
  const habits = await prisma.habit.findMany({
    where: {
      userId,
      ...(options.includeArchived ? {} : { archivedAt: null }),
    },
    include: {
      entries: true,
      timeEntries: {
        where: { endedAt: { not: null } },
      },
    },
    orderBy: [{ archivedAt: "asc" }, { updatedAt: "desc" }],
  });
  const now = new Date();
  return habits
    .map((habit) => summarizeHabit(habit, now))
    .sort((a, b) => {
      if (a.archivedAt && !b.archivedAt) return 1;
      if (!a.archivedAt && b.archivedAt) return -1;
      if (a.completedToday !== b.completedToday) return a.completedToday ? 1 : -1;
      if (a.dueToday !== b.dueToday) return a.dueToday ? -1 : 1;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
}

export async function listSuggestedHabits(
  userId: string,
  options: { limit?: number } = {},
): Promise<HabitSummary[]> {
  const habits = await listHabits(userId);
  return habits
    .filter((habit) => !habit.archivedAt)
    .sort((a, b) => {
      if (a.completedToday !== b.completedToday) return a.completedToday ? 1 : -1;
      if (a.dueToday !== b.dueToday) return a.dueToday ? -1 : 1;
      if (a.currentStreak !== b.currentStreak) return b.currentStreak - a.currentStreak;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    })
    .slice(0, options.limit ?? 4);
}

export async function listHabitTaskItems(
  userId: string,
  options: { limit?: number } = {},
): Promise<HabitTaskSummary[]> {
  const habits = await listHabits(userId);
  return habits
    .map((habit) => {
      const taskLane = resolveHabitTaskLane(habit);
      return taskLane ? { ...habit, taskLane } : null;
    })
    .filter((habit): habit is HabitTaskSummary => Boolean(habit))
    .sort((a, b) => {
      if (a.taskLane !== b.taskLane) return a.taskLane === "today" ? -1 : 1;
      if (a.dueToday !== b.dueToday) return a.dueToday ? -1 : 1;
      if ((a.reminderTime ?? "") !== (b.reminderTime ?? "")) {
        return (a.reminderTime ?? "").localeCompare(b.reminderTime ?? "");
      }
      if (a.currentStreak !== b.currentStreak) return b.currentStreak - a.currentStreak;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    })
    .slice(0, options.limit ?? 100);
}

export async function createHabit(userId: string, input: SaveHabitInput) {
  requireCan(userId, "habit", "write");
  const title = sanitizeTitle(input.title);
  if (!title) throw new Error("Habit title is required.");

  const habit = await prisma.habit.create({
    data: {
      userId,
      title,
      bucket: sanitizeOptionalString(input.bucket),
      notes: sanitizeOptionalString(input.notes),
      cadence: input.cadence ?? "daily",
      daysOfWeek: sanitizeOptionalString(input.daysOfWeek),
      targetCount: Math.max(1, input.targetCount ?? 1),
      goalUnit: input.goalUnit ?? "check",
      defaultDurationMinutes: input.defaultDurationMinutes ?? null,
      reminderTime: sanitizeOptionalString(input.reminderTime),
    },
    include: {
      entries: true,
      timeEntries: true,
    },
  });

  await recordEvent({
    userId,
    tool: "habit",
    type: "habit.created",
    refId: habit.id,
    meta: { title: habit.title, cadence: habit.cadence },
  });

  return summarizeHabit(habit, new Date());
}

export async function updateHabit(userId: string, id: string, input: Partial<SaveHabitInput>) {
  requireCan(userId, "habit", "write");
  const existing = await prisma.habit.findFirst({
    where: { userId, id },
    include: {
      entries: true,
      timeEntries: {
        where: { endedAt: { not: null } },
      },
    },
  });
  if (!existing) return null;

  const habit = await prisma.habit.update({
    where: { id },
    data: {
      title: input.title === undefined ? undefined : sanitizeTitle(input.title),
      bucket: input.bucket === undefined ? undefined : sanitizeOptionalString(input.bucket),
      notes: input.notes === undefined ? undefined : sanitizeOptionalString(input.notes),
      cadence: input.cadence ?? undefined,
      daysOfWeek: input.daysOfWeek === undefined ? undefined : sanitizeOptionalString(input.daysOfWeek),
      targetCount: input.targetCount === undefined ? undefined : Math.max(1, input.targetCount),
      goalUnit: input.goalUnit ?? undefined,
      defaultDurationMinutes:
        input.defaultDurationMinutes === undefined ? undefined : input.defaultDurationMinutes,
      reminderTime:
        input.reminderTime === undefined ? undefined : sanitizeOptionalString(input.reminderTime),
    },
    include: {
      entries: true,
      timeEntries: {
        where: { endedAt: { not: null } },
      },
    },
  });

  await recordEvent({
    userId,
    tool: "habit",
    type: "habit.updated",
    refId: habit.id,
    meta: { title: habit.title },
  });

  return summarizeHabit(habit, new Date());
}

export async function archiveHabit(userId: string, id: string, archived: boolean) {
  requireCan(userId, "habit", "write");
  const habit = await prisma.habit.update({
    where: { id },
    data: { archivedAt: archived ? new Date() : null },
    include: {
      entries: true,
      timeEntries: {
        where: { endedAt: { not: null } },
      },
    },
  });
  await recordEvent({
    userId,
    tool: "habit",
    type: archived ? "habit.archived" : "habit.reopened",
    refId: habit.id,
    meta: { title: habit.title },
  });
  return summarizeHabit(habit, new Date());
}

export async function logHabitProgress(
  userId: string,
  habitId: string,
  input: { quantity: number; notes?: string | null; loggedAt?: Date },
) {
  requireCan(userId, "habit", "write");
  const habit = await prisma.habit.findFirst({
    where: { userId, id: habitId },
    include: {
      entries: true,
      timeEntries: {
        where: { endedAt: { not: null } },
      },
    },
  });
  if (!habit) return null;

  await prisma.habitEntry.create({
    data: {
      userId,
      habitId,
      quantity: Math.max(1, input.quantity),
      notes: sanitizeOptionalString(input.notes),
      loggedAt: input.loggedAt ?? new Date(),
    },
  });

  const refreshed = await prisma.habit.findFirstOrThrow({
    where: { id: habitId, userId },
    include: {
      entries: true,
      timeEntries: {
        where: { endedAt: { not: null } },
      },
    },
  });

  await recordEvent({
    userId,
    tool: "habit",
    type: "habit.logged",
    refId: habitId,
    meta: { title: refreshed.title, quantity: input.quantity },
  });

  return summarizeHabit(refreshed, new Date());
}

export async function startTimerForHabit(userId: string, habitId: string) {
  requireCan(userId, "habit", "write");
  const habit = await prisma.habit.findFirst({
    where: { userId, id: habitId, archivedAt: null },
  });
  if (!habit) return null;
  const entry = await startEntry(userId, {
    label: habit.title,
    category: "habit",
    habitId: habit.id,
  });
  await recordEvent({
    userId,
    tool: "habit",
    type: "habit.timer_started",
    refId: habit.id,
    meta: { title: habit.title },
  });
  return entry;
}
