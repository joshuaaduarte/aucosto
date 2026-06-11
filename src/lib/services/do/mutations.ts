// Mutations: create/update/delete tasks, start timers, and the post-session
// reflection flow (which syncs linked habits). Every write records an event
// after the DB write succeeds.

import "server-only";

import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { recordEvent } from "@/lib/services/events";
import { startEntry } from "@/lib/services/time";
import { listHabits, logHabitProgress } from "@/lib/services/habits";
import {
  type DoLane,
  type DoStatus,
  DO_LANES,
  normalizeDoStatus,
  parseMinutes,
} from "@/lib/do";
import type { TimeEntry } from "@/generated/prisma/client";
import { type DoItemSummary, summarize } from "./shared";

export type SaveDoItemInput = {
  title: string;
  bucket?: string | null;
  projectId?: string | null;
  habitId?: string | null;
  lane?: DoLane;
  status?: DoStatus;
  estimatedMinutes?: number | null;
  actualMinutes?: number | null;
  notes?: string | null;
};

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
  const habitId = input.habitId
    ? (
        await prisma.habit.findFirst({
          where: { userId, id: input.habitId, archivedAt: null },
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
      habitId,
      lane: sanitizeLane(input.lane),
      status: sanitizeStatus(input.status),
      notes: input.notes?.trim() || null,
      estimatedMinutes: parseMinutes(input.estimatedMinutes),
      actualMinutes: parseMinutes(input.actualMinutes),
    },
    include: {
      project: { select: { id: true, name: true } },
      habit: { select: { id: true, title: true } },
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
      habit: { select: { id: true, title: true } },
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
      habit: { select: { id: true, title: true } },
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

/** Bulk-delete every task linked to a project (used by project deletion). */
export async function deleteDoItemsByProject(
  userId: string,
  projectId: string,
): Promise<number> {
  requireCan(userId, "do", "write");
  const { count } = await prisma.doItem.deleteMany({
    where: { userId, projectId },
  });
  if (count > 0) {
    await recordEvent({
      userId,
      tool: "do",
      type: "do.bulk_deleted",
      refId: projectId,
      meta: { count },
    });
  }
  return count;
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
    habitId: item.habitId,
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

async function syncLinkedHabitIfNeeded(userId: string, item: DoItemSummary | null) {
  if (!item?.habitId) return;

  const habits = await listHabits(userId, { includeArchived: true });
  const habit = habits.find((candidate) => candidate.id === item.habitId && !candidate.archivedAt);
  if (!habit) return;
  const progress = habit.cadence === "weekly" ? habit.progressThisWeek : habit.progressToday;
  if (progress >= habit.targetCount) return;

  const remaining = Math.max(1, habit.targetCount - progress);
  await logHabitProgress(userId, habit.id, {
    quantity: remaining,
    notes: `Completed from linked Do item "${item.title}".`,
    mode: "full",
  });
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

  if (input.outcome === "done") {
    await syncLinkedHabitIfNeeded(userId, updated);
  }

  return updated;
}
