// Read paths: list tasks with derived summaries (including scheduled calendar
// minutes), suggestion scoring, and single-item lookup.

import "server-only";

import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import type { DoStatus } from "@/lib/do";
import { type DoItemSummary, summarize } from "./shared";

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
      habit: {
        select: { id: true, title: true },
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
