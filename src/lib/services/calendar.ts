import "server-only";

import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { recordEvent } from "@/lib/services/events";
import type { CalendarItem } from "@/generated/prisma/client";

export type CalendarRange = { from: Date; to: Date };

export type CreateCalendarItemInput = {
  title: string;
  startsAt: Date;
  endsAt: Date;
  notes?: string | null;
  location?: string | null;
  kind?: string;
  status?: string;
  allDay?: boolean;
  sourceTool?: string | null;
  sourceRefId?: string | null;
  externalId?: string | null;
};

function sanitizeTitle(title: string) {
  return title.trim();
}

function validateWindow(startsAt: Date, endsAt: Date) {
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new Error("Calendar times are invalid.");
  }
  if (endsAt <= startsAt) {
    throw new Error("End time must be after start time.");
  }
}

export async function listCalendarItems(
  userId: string,
  range: CalendarRange,
): Promise<CalendarItem[]> {
  requireCan(userId, "calendar", "read");
  return prisma.calendarItem.findMany({
    where: {
      userId,
      startsAt: { lt: range.to },
      endsAt: { gt: range.from },
      status: { not: "cancelled" },
    },
    orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
  });
}

export async function listUpcomingCalendarItems(
  userId: string,
  options: { from?: Date; limit?: number } = {},
): Promise<CalendarItem[]> {
  requireCan(userId, "calendar", "read");
  return prisma.calendarItem.findMany({
    where: {
      userId,
      endsAt: { gte: options.from ?? new Date() },
      status: { not: "cancelled" },
    },
    orderBy: [{ startsAt: "asc" }],
    take: options.limit ?? 10,
  });
}

export async function createCalendarItem(
  userId: string,
  input: CreateCalendarItemInput,
): Promise<CalendarItem> {
  requireCan(userId, "calendar", "write");
  const title = sanitizeTitle(input.title);
  if (!title) {
    throw new Error("Title is required.");
  }
  validateWindow(input.startsAt, input.endsAt);

  const item = await prisma.calendarItem.create({
    data: {
      userId,
      title,
      kind: input.kind ?? "block",
      status: input.status ?? "confirmed",
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      allDay: input.allDay ?? false,
      notes: input.notes?.trim() || null,
      location: input.location?.trim() || null,
      sourceTool: input.sourceTool ?? null,
      sourceRefId: input.sourceRefId ?? null,
      externalId: input.externalId ?? null,
    },
  });

  await recordEvent({
    userId,
    tool: "calendar",
    type: "calendar.created",
    refId: item.id,
    meta: { title: item.title, kind: item.kind },
  });

  return item;
}

export async function updateCalendarItem(
  userId: string,
  id: string,
  input: Partial<CreateCalendarItemInput> & { status?: string },
): Promise<CalendarItem | null> {
  requireCan(userId, "calendar", "write");

  const existing = await prisma.calendarItem.findFirst({ where: { id, userId } });
  if (!existing) return null;

  const startsAt = input.startsAt ?? existing.startsAt;
  const endsAt = input.endsAt ?? existing.endsAt;
  validateWindow(startsAt, endsAt);

  const item = await prisma.calendarItem.update({
    where: { id },
    data: {
      title: input.title ? sanitizeTitle(input.title) : undefined,
      startsAt,
      endsAt,
      notes: input.notes === undefined ? undefined : input.notes?.trim() || null,
      location:
        input.location === undefined ? undefined : input.location?.trim() || null,
      kind: input.kind ?? undefined,
      status: input.status ?? undefined,
      allDay: input.allDay ?? undefined,
    },
  });

  await recordEvent({
    userId,
    tool: "calendar",
    type: item.status === "done" ? "calendar.completed" : "calendar.updated",
    refId: item.id,
    meta: { title: item.title, status: item.status },
  });

  return item;
}

export async function deleteCalendarItem(userId: string, id: string): Promise<void> {
  requireCan(userId, "calendar", "write");
  const { count } = await prisma.calendarItem.deleteMany({
    where: { id, userId },
  });
  if (count > 0) {
    await recordEvent({
      userId,
      tool: "calendar",
      type: "calendar.deleted",
      refId: id,
    });
  }
}
