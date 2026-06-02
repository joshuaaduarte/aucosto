import "server-only";

import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { recordEvent } from "@/lib/services/events";
import { startEntry } from "@/lib/services/time";
import { type DoLane, DO_LANES, parseMinutes } from "@/lib/do";
import type { DoItem, TimeEntry } from "@/generated/prisma/client";

type DoItemWithEntries = DoItem & { timeEntries: TimeEntry[] };

export type DoItemSummary = DoItem & {
  trackedMinutes: number;
  effectiveActualMinutes: number | null;
};

export type SaveDoItemInput = {
  title: string;
  lane?: DoLane;
  estimatedMinutes?: number | null;
  actualMinutes?: number | null;
  notes?: string | null;
};

function laneRank(lane: string) {
  switch (lane) {
    case "today":
      return 0;
    case "next":
      return 1;
    case "later":
      return 2;
    case "someday":
      return 3;
    default:
      return 99;
  }
}

function summarize(item: DoItemWithEntries): DoItemSummary {
  const trackedMinutes = item.timeEntries.reduce((total, entry) => {
    if (!entry.endedAt) return total;
    return total + Math.max(0, Math.round((entry.endedAt.getTime() - entry.startedAt.getTime()) / 60000));
  }, 0);

  return {
    ...item,
    trackedMinutes,
    effectiveActualMinutes:
      item.actualMinutes ?? (trackedMinutes > 0 ? trackedMinutes : null),
  };
}

function sanitizeTitle(title: string) {
  return title.trim();
}

function sanitizeLane(lane: string | null | undefined): DoLane {
  if (lane && DO_LANES.includes(lane as DoLane)) {
    return lane as DoLane;
  }
  return "next";
}

export async function listDoItems(
  userId: string,
  options: { includeDone?: boolean; limit?: number } = {},
): Promise<DoItemSummary[]> {
  requireCan(userId, "do", "read");
  const items = await prisma.doItem.findMany({
    where: {
      userId,
      ...(options.includeDone ? {} : { status: "open" }),
    },
    include: {
      timeEntries: {
        where: { endedAt: { not: null } },
        select: {
          id: true,
          startedAt: true,
          endedAt: true,
          createdAt: true,
          userId: true,
          label: true,
          category: true,
          notes: true,
          doItemId: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: options.limit,
  });

  return items
    .map(summarize)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "open" ? -1 : 1;
      const laneDelta = laneRank(a.lane) - laneRank(b.lane);
      if (laneDelta !== 0) return laneDelta;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
}

export async function listSuggestedDoItems(
  userId: string,
  options: { limit?: number } = {},
): Promise<DoItemSummary[]> {
  const items = await listDoItems(userId, { includeDone: false });
  return items.slice(0, options.limit ?? 5);
}

export async function createDoItem(
  userId: string,
  input: SaveDoItemInput,
): Promise<DoItemSummary> {
  requireCan(userId, "do", "write");
  const title = sanitizeTitle(input.title);
  if (!title) throw new Error("Task title is required.");

  const item = await prisma.doItem.create({
    data: {
      userId,
      title,
      lane: sanitizeLane(input.lane),
      notes: input.notes?.trim() || null,
      estimatedMinutes: parseMinutes(input.estimatedMinutes),
      actualMinutes: parseMinutes(input.actualMinutes),
    },
    include: { timeEntries: true },
  });

  await recordEvent({
    userId,
    tool: "do",
    type: "do.created",
    refId: item.id,
    meta: { title: item.title, lane: item.lane },
  });

  return summarize(item);
}

export async function updateDoItem(
  userId: string,
  id: string,
  input: Partial<SaveDoItemInput> & { status?: "open" | "done" },
): Promise<DoItemSummary | null> {
  requireCan(userId, "do", "write");
  const existing = await prisma.doItem.findFirst({
    where: { userId, id },
    include: { timeEntries: true },
  });
  if (!existing) return null;

  const item = await prisma.doItem.update({
    where: { id },
    data: {
      title: input.title === undefined ? undefined : sanitizeTitle(input.title),
      lane: input.lane === undefined ? undefined : sanitizeLane(input.lane),
      notes: input.notes === undefined ? undefined : input.notes?.trim() || null,
      estimatedMinutes:
        input.estimatedMinutes === undefined
          ? undefined
          : parseMinutes(input.estimatedMinutes),
      actualMinutes:
        input.actualMinutes === undefined
          ? undefined
          : parseMinutes(input.actualMinutes),
      status: input.status ?? undefined,
      completedAt:
        input.status === "done"
          ? new Date()
          : input.status === "open"
            ? null
            : undefined,
    },
    include: {
      timeEntries: {
        where: { endedAt: { not: null } },
      },
    },
  });

  await recordEvent({
    userId,
    tool: "do",
    type: item.status === "done" ? "do.completed" : "do.updated",
    refId: item.id,
    meta: { title: item.title, lane: item.lane },
  });

  return summarize(item);
}

export async function deleteDoItem(userId: string, id: string): Promise<void> {
  requireCan(userId, "do", "write");
  const { count } = await prisma.doItem.deleteMany({
    where: { userId, id },
  });
  if (count > 0) {
    await recordEvent({
      userId,
      tool: "do",
      type: "do.deleted",
      refId: id,
    });
  }
}

export async function startTimerForDoItem(
  userId: string,
  id: string,
): Promise<TimeEntry | null> {
  requireCan(userId, "do", "write");
  const item = await prisma.doItem.findFirst({
    where: { userId, id, status: "open" },
  });
  if (!item) return null;

  const entry = await startEntry(userId, {
    label: item.title,
    category: "do",
    doItemId: item.id,
  });

  await prisma.doItem.update({
    where: { id: item.id },
    data: {
      lane: item.lane === "someday" ? "next" : item.lane,
      lastWorkedAt: new Date(),
    },
  });

  await recordEvent({
    userId,
    tool: "do",
    type: "do.timer_started",
    refId: item.id,
    meta: { title: item.title },
  });

  return entry;
}
