// Service layer for the time tracker.
//
// Server actions, server components, widgets, and (eventually) agent route
// handlers MUST go through this module; they should never touch
// prisma.timeEntry.* directly. The service is where authorization is enforced
// and the natural seam where future agent endpoints will live.

import "server-only";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { recordEvent } from "@/lib/services/events";
import type { DoItem, Habit, TimeEntry } from "@/generated/prisma/client";

export type RunningTimeEntry = TimeEntry & {
  doItem: Pick<DoItem, "id" | "title" | "estimatedMinutes" | "actualMinutes"> | null;
  habit: Pick<Habit, "id" | "title" | "goalUnit" | "targetCount"> | null;
};

export async function getRunningEntry(
  userId: string,
): Promise<RunningTimeEntry | null> {
  requireCan(userId, "time", "read");
  return prisma.timeEntry.findFirst({
    where: { userId, endedAt: null },
    include: {
      doItem: {
        select: {
          id: true,
          title: true,
          estimatedMinutes: true,
          actualMinutes: true,
        },
      },
      habit: {
        select: {
          id: true,
          title: true,
          goalUnit: true,
          targetCount: true,
        },
      },
    },
    orderBy: { startedAt: "desc" },
  });
}

export type RecentTimeEntry = TimeEntry & {
  doItem: Pick<DoItem, "id" | "title"> | null;
  habit: Pick<Habit, "id" | "title"> | null;
};

export async function listRecentEntries(
  userId: string,
  options: { limit?: number } = {},
): Promise<RecentTimeEntry[]> {
  requireCan(userId, "time", "read");
  return prisma.timeEntry.findMany({
    where: { userId, endedAt: { not: null } },
    include: {
      doItem: { select: { id: true, title: true } },
      habit: { select: { id: true, title: true } },
    },
    orderBy: { startedAt: "desc" },
    take: options.limit ?? 30,
  });
}

export async function listCompletedSince(
  userId: string,
  since: Date,
): Promise<TimeEntry[]> {
  requireCan(userId, "time", "read");
  return prisma.timeEntry.findMany({
    where: { userId, startedAt: { gte: since }, endedAt: { not: null } },
  });
}

/** Entries overlapping [from, to) — completed and running — for timeline views. */
export async function listEntriesBetween(
  userId: string,
  range: { from: Date; to: Date },
): Promise<TimeEntry[]> {
  requireCan(userId, "time", "read");
  return prisma.timeEntry.findMany({
    where: {
      userId,
      startedAt: { lt: range.to },
      OR: [{ endedAt: null }, { endedAt: { gt: range.from } }],
    },
    orderBy: { startedAt: "asc" },
  });
}

/** Retroactively log a completed entry (untracked-gap backfill). */
export async function createPastEntry(
  userId: string,
  input: {
    label: string;
    category?: string | null;
    doItemId?: string | null;
    startedAt: Date;
    endedAt: Date;
  },
): Promise<TimeEntry> {
  requireCan(userId, "time", "write");
  if (
    Number.isNaN(input.startedAt.getTime()) ||
    Number.isNaN(input.endedAt.getTime())
  ) {
    throw new Error("Entry times are invalid.");
  }
  if (input.endedAt <= input.startedAt) {
    throw new Error("End time must be after start time.");
  }
  if (input.endedAt.getTime() - input.startedAt.getTime() > 24 * 60 * 60 * 1000) {
    throw new Error("Backfilled entries are capped at 24 hours.");
  }
  const entry = await prisma.timeEntry.create({
    data: {
      userId,
      label: input.label,
      category: input.category ?? null,
      doItemId: input.doItemId ?? null,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
    },
  });
  await recordEvent({
    userId,
    tool: "time",
    type: "time.logged",
    refId: entry.id,
    meta: { label: entry.label, category: entry.category },
  });
  return entry;
}

export async function startEntry(
  userId: string,
  input: { label: string; category?: string | null; doItemId?: string | null; habitId?: string | null },
): Promise<TimeEntry> {
  requireCan(userId, "time", "write");
  await prisma.timeEntry.updateMany({
    where: { userId, endedAt: null },
    data: { endedAt: new Date() },
  });
  const entry = await prisma.timeEntry.create({
    data: {
      userId,
      label: input.label,
      category: input.category ?? null,
      doItemId: input.doItemId ?? null,
      habitId: input.habitId ?? null,
      startedAt: new Date(),
    },
  });
  await recordEvent({
    userId,
    tool: "time",
    type: "time.started",
    refId: entry.id,
    meta: { label: entry.label, category: entry.category, doItemId: entry.doItemId, habitId: entry.habitId },
  });
  return entry;
}

/** Edit a logged entry's label, category, or times (fix tracker mistakes). */
export async function updateEntry(
  userId: string,
  id: string,
  input: {
    label?: string;
    category?: string | null;
    doItemId?: string | null;
    startedAt?: Date;
    endedAt?: Date;
  },
): Promise<TimeEntry | null> {
  requireCan(userId, "time", "write");
  const existing = await prisma.timeEntry.findFirst({ where: { id, userId } });
  if (!existing) return null;

  const startedAt = input.startedAt ?? existing.startedAt;
  const endedAt = input.endedAt ?? existing.endedAt;
  if (Number.isNaN(startedAt.getTime()) || (endedAt && Number.isNaN(endedAt.getTime()))) {
    throw new Error("Entry times are invalid.");
  }
  if (endedAt && endedAt <= startedAt) {
    throw new Error("End time must be after start time.");
  }
  if (endedAt && endedAt.getTime() - startedAt.getTime() > 24 * 60 * 60 * 1000) {
    throw new Error("Entries are capped at 24 hours.");
  }

  const entry = await prisma.timeEntry.update({
    where: { id },
    data: {
      label: input.label === undefined ? undefined : input.label,
      category: input.category === undefined ? undefined : input.category,
      doItemId: input.doItemId === undefined ? undefined : input.doItemId,
      startedAt: input.startedAt === undefined ? undefined : input.startedAt,
      endedAt: input.endedAt === undefined ? undefined : input.endedAt,
    },
  });
  await recordEvent({
    userId,
    tool: "time",
    type: "time.updated",
    refId: entry.id,
    meta: { label: entry.label, category: entry.category },
  });
  return entry;
}

export async function stopRunning(userId: string): Promise<void> {
  requireCan(userId, "time", "write");
  const { count } = await prisma.timeEntry.updateMany({
    where: { userId, endedAt: null },
    data: { endedAt: new Date() },
  });
  if (count > 0) {
    await recordEvent({
      userId,
      tool: "time",
      type: "time.stopped",
      meta: { count },
    });
  }
}

export async function deleteEntry(userId: string, id: string): Promise<void> {
  requireCan(userId, "time", "write");
  const { count } = await prisma.timeEntry.deleteMany({
    where: { id, userId },
  });
  if (count > 0) {
    await recordEvent({
      userId,
      tool: "time",
      type: "time.deleted",
      refId: id,
    });
  }
}
