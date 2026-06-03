import "server-only";

import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { recordEvent } from "@/lib/services/events";
import { startEntry } from "@/lib/services/time";
import {
  type DoLane,
  type DoStatus,
  DO_LANES,
  normalizeDoStatus,
  parseMinutes,
} from "@/lib/do";
import type { DoItem, TimeEntry } from "@/generated/prisma/client";

type DoItemWithEntries = DoItem & {
  timeEntries: TimeEntry[];
  project: { id: string; name: string } | null;
};

export type DoItemSummary = DoItem & {
  status: DoStatus;
  trackedMinutes: number;
  effectiveActualMinutes: number | null;
  scheduledMinutes: number;
  scheduledCount: number;
  projectName: string | null;
};

export type SaveDoItemInput = {
  title: string;
  bucket?: string | null;
  projectId?: string | null;
  lane?: DoLane;
  status?: DoStatus;
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

function statusRank(status: DoStatus) {
  switch (status) {
    case "in_progress":
      return 0;
    case "ready":
      return 1;
    case "scheduled":
      return 2;
    case "waiting":
      return 3;
    case "done":
      return 4;
    default:
      return 99;
  }
}

function summarize(
  item: DoItemWithEntries,
  scheduledMinutes: number,
  scheduledCount: number,
): DoItemSummary {
  const trackedMinutes = item.timeEntries.reduce((total, entry) => {
    if (!entry.endedAt) return total;
    return total + Math.max(0, Math.round((entry.endedAt.getTime() - entry.startedAt.getTime()) / 60000));
  }, 0);
  const status = normalizeDoStatus(item.status);

  return {
    ...item,
    status,
    trackedMinutes,
    scheduledMinutes,
    scheduledCount,
    projectName: item.project?.name ?? null,
    effectiveActualMinutes:
      item.actualMinutes ?? (trackedMinutes > 0 ? trackedMinutes : null),
  };
}

function sanitizeTitle(title: string) {
  return title.trim();
}

function sanitizeOptionalString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function sanitizeLane(lane: string | null | undefined): DoLane {
  if (lane && DO_LANES.includes(lane as DoLane)) {
    return lane as DoLane;
  }
  return "next";
}

function sanitizeStatus(status: string | null | undefined): DoStatus {
  return normalizeDoStatus(status);
}

function scoreSuggestedTask(
  item: DoItemSummary,
  options: { now?: Date; availableMinutes?: number | null } = {},
) {
  const now = options.now ?? new Date();
  const availableMinutes = options.availableMinutes ?? null;
  const estimate = item.estimatedMinutes ?? 30;
  let score = 0;

  switch (item.lane) {
    case "today":
      score += 40;
      break;
    case "next":
      score += 26;
      break;
    case "later":
      score += 12;
      break;
    case "someday":
      score += 4;
      break;
  }

  switch (item.status) {
    case "in_progress":
      score += 24;
      break;
    case "ready":
      score += 18;
      break;
    case "scheduled":
      score += 10;
      break;
    case "waiting":
      score -= 40;
      break;
    case "done":
      score -= 100;
      break;
  }

  if (item.trackedMinutes > 0) {
    score += Math.min(16, Math.round(item.trackedMinutes / 15) * 2);
  }

  if (item.scheduledMinutes === 0 && item.lane === "today") {
    score += 10;
  }

  if (availableMinutes !== null) {
    if (estimate <= availableMinutes) {
      score += 18;
      score += Math.max(0, 12 - Math.abs(availableMinutes - estimate));
    } else {
      score -= Math.min(30, (estimate - availableMinutes) * 2);
    }
  }

  const anchor = item.lastWorkedAt ?? item.updatedAt ?? item.createdAt;
  const staleHours = Math.max(
    0,
    Math.round((now.getTime() - anchor.getTime()) / (60 * 60 * 1000)),
  );
  score += Math.min(14, Math.floor(staleHours / 12) * 2);

  return score;
}

export async function listDoItems(
  userId: string,
  options: { includeDone?: boolean; limit?: number } = {},
): Promise<DoItemSummary[]> {
  requireCan(userId, "do", "read");
  const items = await prisma.doItem.findMany({
    where: {
      userId,
      ...(options.includeDone ? {} : { status: { not: "done" } }),
    },
    include: {
      project: {
        select: { id: true, name: true },
      },
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
          habitId: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: options.limit,
  });

  const scheduleMap = new Map<
    string,
    {
      scheduledMinutes: number;
      scheduledCount: number;
    }
  >();
  const doItemIds = items.map((item) => item.id);
  if (doItemIds.length > 0) {
    const calendarItems = await prisma.calendarItem.findMany({
      where: {
        userId,
        sourceTool: "do",
        sourceRefId: { in: doItemIds },
        status: { not: "cancelled" },
      },
      select: {
        sourceRefId: true,
        startsAt: true,
        endsAt: true,
      },
    });

    for (const calendarItem of calendarItems) {
      if (!calendarItem.sourceRefId) continue;
      const current = scheduleMap.get(calendarItem.sourceRefId) ?? {
        scheduledMinutes: 0,
        scheduledCount: 0,
      };
      current.scheduledCount += 1;
      current.scheduledMinutes += Math.max(
        0,
        Math.round(
          (calendarItem.endsAt.getTime() - calendarItem.startsAt.getTime()) / 60000,
        ),
      );
      scheduleMap.set(calendarItem.sourceRefId, current);
    }
  }

  return items
    .map((item) => {
      const schedule = scheduleMap.get(item.id);
      return summarize(
        item,
        schedule?.scheduledMinutes ?? 0,
        schedule?.scheduledCount ?? 0,
      );
    })
    .sort((a, b) => {
      if (a.status !== b.status) {
        return statusRank(a.status) - statusRank(b.status);
      }
      const laneDelta = laneRank(a.lane) - laneRank(b.lane);
      if (laneDelta !== 0) return laneDelta;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
}

export async function listSuggestedDoItems(
  userId: string,
  options: { limit?: number; availableMinutes?: number | null; now?: Date } = {},
): Promise<DoItemSummary[]> {
  const items = await listDoItems(userId, { includeDone: false });
  return items
    .filter((item) => item.status !== "waiting" && item.status !== "done")
    .sort((a, b) => {
      const scoreDelta =
        scoreSuggestedTask(b, options) - scoreSuggestedTask(a, options);
      if (scoreDelta !== 0) return scoreDelta;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    })
    .slice(0, options.limit ?? 5);
}

export async function getDoItemSummary(
  userId: string,
  id: string,
): Promise<DoItemSummary | null> {
  const items = await listDoItems(userId, { includeDone: true });
  return items.find((item) => item.id === id) ?? null;
}

export async function createDoItem(
  userId: string,
  input: SaveDoItemInput,
): Promise<DoItemSummary> {
  requireCan(userId, "do", "write");
  const title = sanitizeTitle(input.title);
  if (!title) throw new Error("Task title is required.");
  const projectId = input.projectId
    ? (
        await prisma.project.findFirst({
          where: { userId, id: input.projectId },
          select: { id: true },
        })
      )?.id ?? null
    : null;

  const item = await prisma.doItem.create({
    data: {
      userId,
      title,
      bucket: sanitizeOptionalString(input.bucket),
      projectId,
      lane: sanitizeLane(input.lane),
      status: sanitizeStatus(input.status),
      notes: input.notes?.trim() || null,
      estimatedMinutes: parseMinutes(input.estimatedMinutes),
      actualMinutes: parseMinutes(input.actualMinutes),
    },
    include: {
      project: { select: { id: true, name: true } },
      timeEntries: true,
    },
  });

  await recordEvent({
    userId,
    tool: "do",
    type: "do.created",
    refId: item.id,
    meta: { title: item.title, lane: item.lane, status: normalizeDoStatus(item.status) },
  });

  return summarize(item, 0, 0);
}

export async function updateDoItem(
  userId: string,
  id: string,
  input: Partial<SaveDoItemInput>,
): Promise<DoItemSummary | null> {
  requireCan(userId, "do", "write");
  const existing = await prisma.doItem.findFirst({
    where: { userId, id },
    include: {
      project: { select: { id: true, name: true } },
      timeEntries: true,
    },
  });
  if (!existing) return null;

  const projectId =
    input.projectId === undefined
      ? undefined
      : input.projectId
        ? (
            await prisma.project.findFirst({
              where: { userId, id: input.projectId },
              select: { id: true },
            })
          )?.id ?? null
        : null;

  const item = await prisma.doItem.update({
    where: { id },
    data: {
      title: input.title === undefined ? undefined : sanitizeTitle(input.title),
      bucket:
        input.bucket === undefined ? undefined : sanitizeOptionalString(input.bucket),
      projectId,
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
      status:
        input.status === undefined ? undefined : sanitizeStatus(input.status),
      completedAt:
        input.status === undefined
          ? undefined
          : input.status === "done"
            ? new Date()
            : null,
      lastWorkedAt:
        input.status === "in_progress" ? new Date() : undefined,
    },
    include: {
      project: { select: { id: true, name: true } },
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
    meta: {
      title: item.title,
      lane: item.lane,
      status: normalizeDoStatus(item.status),
    },
  });

  const schedule = await prisma.calendarItem.findMany({
    where: {
      userId,
      sourceTool: "do",
      sourceRefId: item.id,
      status: { not: "cancelled" },
    },
    select: {
      startsAt: true,
      endsAt: true,
    },
  });

  const scheduledMinutes = schedule.reduce((total, calendarItem) => {
    return (
      total +
      Math.max(
        0,
        Math.round(
          (calendarItem.endsAt.getTime() - calendarItem.startsAt.getTime()) / 60000,
        ),
      )
    );
  }, 0);

  return summarize(item, scheduledMinutes, schedule.length);
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
    where: { userId, id, status: { not: "done" } },
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
      status: "in_progress",
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

export async function reflectOnDoItemSession(
  userId: string,
  id: string,
  input: {
    outcome: "done" | "continue" | "waiting";
    actualMinutes?: number | null;
    remainingMinutes?: number | null;
    notes?: string | null;
  },
): Promise<DoItemSummary | null> {
  requireCan(userId, "do", "write");
  const item = await prisma.doItem.findFirst({
    where: { userId, id },
  });
  if (!item) return null;

  const status: DoStatus =
    input.outcome === "done"
      ? "done"
      : input.outcome === "waiting"
        ? "waiting"
        : "ready";

  const updated = await updateDoItem(userId, id, {
    status,
    actualMinutes: input.actualMinutes,
    estimatedMinutes:
      input.remainingMinutes === undefined
        ? undefined
        : input.outcome === "done"
          ? item.estimatedMinutes
          : input.remainingMinutes,
    notes:
      input.notes === undefined
        ? undefined
        : [item.notes?.trim(), input.notes?.trim()].filter(Boolean).join("\n"),
  });

  await recordEvent({
    userId,
    tool: "do",
    type: "do.reflected",
    refId: id,
    meta: {
      outcome: input.outcome,
      actualMinutes: parseMinutes(input.actualMinutes),
      remainingMinutes: parseMinutes(input.remainingMinutes),
    },
  });

  return updated;
}
