// Mutations: create/update/archive/delete habits, log progress entries, and
// start timers. Every write records an event after the DB write succeeds.

import "server-only";

import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import type { HabitCadence, HabitDayPart, HabitGoalUnit } from "@/lib/habits";
import { recordEvent } from "@/lib/services/events";
import { startEntry } from "@/lib/services/time";
import { summarizeHabit } from "./derive";
import { ensureHabitWindowColumns, type HabitEntryMode } from "./shared";

export type SaveHabitInput = {
  title: string;
  bucket?: string | null;
  notes?: string | null;
  fallbackTitle?: string | null;
  rescuePrompt?: string | null;
  dayPart?: HabitDayPart;
  cadence?: HabitCadence;
  daysOfWeek?: string | null;
  targetCount?: number;
  goalUnit?: HabitGoalUnit;
  defaultDurationMinutes?: number | null;
  reminderTime?: string | null;
  windowStart?: string | null;
  windowEnd?: string | null;
};

function sanitizeTitle(title: string) {
  return title.trim();
}

function sanitizeOptionalString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function createHabit(userId: string, input: SaveHabitInput) {
  requireCan(userId, "habit", "write");
  await ensureHabitWindowColumns();
  const title = sanitizeTitle(input.title);
  if (!title) throw new Error("Habit title is required.");

  const habit = await prisma.habit.create({
    data: {
      userId,
      title,
      bucket: sanitizeOptionalString(input.bucket),
      notes: sanitizeOptionalString(input.notes),
      fallbackTitle: sanitizeOptionalString(input.fallbackTitle),
      rescuePrompt: sanitizeOptionalString(input.rescuePrompt),
      dayPart: input.dayPart ?? "anytime",
      cadence: input.cadence ?? "daily",
      daysOfWeek: sanitizeOptionalString(input.daysOfWeek),
      targetCount: Math.max(1, input.targetCount ?? 1),
      goalUnit: input.goalUnit ?? "check",
      defaultDurationMinutes: input.defaultDurationMinutes ?? null,
      reminderTime: sanitizeOptionalString(input.reminderTime),
      windowStart: sanitizeOptionalString(input.windowStart),
      windowEnd: sanitizeOptionalString(input.windowEnd),
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
  await ensureHabitWindowColumns();
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
      fallbackTitle: input.fallbackTitle === undefined ? undefined : sanitizeOptionalString(input.fallbackTitle),
      rescuePrompt: input.rescuePrompt === undefined ? undefined : sanitizeOptionalString(input.rescuePrompt),
      dayPart: input.dayPart ?? undefined,
      cadence: input.cadence ?? undefined,
      daysOfWeek: input.daysOfWeek === undefined ? undefined : sanitizeOptionalString(input.daysOfWeek),
      targetCount: input.targetCount === undefined ? undefined : Math.max(1, input.targetCount),
      goalUnit: input.goalUnit ?? undefined,
      defaultDurationMinutes:
        input.defaultDurationMinutes === undefined ? undefined : input.defaultDurationMinutes,
      reminderTime:
        input.reminderTime === undefined ? undefined : sanitizeOptionalString(input.reminderTime),
      windowStart:
        input.windowStart === undefined ? undefined : sanitizeOptionalString(input.windowStart),
      windowEnd:
        input.windowEnd === undefined ? undefined : sanitizeOptionalString(input.windowEnd),
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
  await ensureHabitWindowColumns();
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

export async function deleteHabit(userId: string, id: string) {
  requireCan(userId, "habit", "write");
  const habit = await prisma.habit.findFirst({
    where: { userId, id },
    select: { id: true, title: true, archivedAt: true },
  });
  if (!habit) return null;
  if (!habit.archivedAt) {
    throw new Error("Pause the habit before deleting it.");
  }

  await prisma.habit.delete({
    where: { id: habit.id },
  });

  await recordEvent({
    userId,
    tool: "habit",
    type: "habit.deleted",
    refId: habit.id,
    meta: { title: habit.title },
  });

  return habit;
}

export async function logHabitProgress(
  userId: string,
  habitId: string,
  input: { quantity: number; notes?: string | null; loggedAt?: Date; mode?: HabitEntryMode },
) {
  requireCan(userId, "habit", "write");
  await ensureHabitWindowColumns();
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

  const mode = input.mode ?? "full";
  await prisma.habitEntry.create({
    data: {
      userId,
      habitId,
      mode,
      quantity: mode === "full" ? Math.max(1, input.quantity) : Math.max(0, input.quantity),
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
    meta: { title: refreshed.title, quantity: input.quantity, mode },
  });

  return summarizeHabit(refreshed, new Date());
}

/**
 * Auto-credit a habit after a linked timer stops — "logging time IS logging
 * the habit". Idempotent and conservative:
 *  - no-op if the habit is already complete / kept alive today (or this week
 *    for weekly cadence), so it never double-logs;
 *  - no-op for minutes-based habits, whose tracked time already counts toward
 *    progress via the summary (faking a manual entry would double-count);
 *  - otherwise logs a single full entry sufficient to hit the target.
 */
export async function markHabitDoneFromTimer(
  userId: string,
  habitId: string,
): Promise<void> {
  requireCan(userId, "habit", "write");
  await ensureHabitWindowColumns();
  const habit = await prisma.habit.findFirst({
    where: { userId, id: habitId, archivedAt: null },
    include: {
      entries: true,
      timeEntries: { where: { endedAt: { not: null } } },
    },
  });
  if (!habit) return;

  const summary = summarizeHabit(habit, new Date());
  const alreadyDone =
    habit.cadence === "weekly"
      ? summary.completedThisWeek
      : summary.completedToday;
  if (alreadyDone || summary.keptAliveToday) return;
  if (habit.goalUnit === "minutes") return;

  const progress =
    habit.cadence === "weekly" ? summary.progressThisWeek : summary.progressToday;
  const remaining = Math.max(1, habit.targetCount - progress);
  await logHabitProgress(userId, habitId, {
    quantity: remaining,
    notes: "Logged from the time tracker.",
    mode: "full",
  });
}

export async function startTimerForHabit(userId: string, habitId: string) {
  requireCan(userId, "habit", "write");
  await ensureHabitWindowColumns();
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

/**
 * Remove today's entries for a habit — the undo path for accidental or
 * wrong logs. Clears the whole day so the user can re-log cleanly.
 */
export async function removeTodayHabitEntries(
  userId: string,
  habitId: string,
): Promise<number> {
  requireCan(userId, "habit", "write");
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const { count } = await prisma.habitEntry.deleteMany({
    where: { userId, habitId, loggedAt: { gte: dayStart } },
  });
  if (count > 0) {
    await recordEvent({
      userId,
      tool: "habit",
      type: "habit.unlogged",
      refId: habitId,
      meta: { entriesRemoved: count },
    });
  }
  return count;
}
