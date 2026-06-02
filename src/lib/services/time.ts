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
import type { TimeEntry } from "@/generated/prisma/client";

export async function getRunningEntry(
  userId: string,
): Promise<TimeEntry | null> {
  requireCan(userId, "time", "read");
  return prisma.timeEntry.findFirst({
    where: { userId, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
}

export async function listRecentEntries(
  userId: string,
  options: { limit?: number } = {},
): Promise<TimeEntry[]> {
  requireCan(userId, "time", "read");
  return prisma.timeEntry.findMany({
    where: { userId, endedAt: { not: null } },
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

export async function startEntry(
  userId: string,
  input: { label: string; category?: string | null; doItemId?: string | null },
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
      startedAt: new Date(),
    },
  });
  await recordEvent({
    userId,
    tool: "time",
    type: "time.started",
    refId: entry.id,
    meta: { label: entry.label, category: entry.category, doItemId: entry.doItemId },
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
