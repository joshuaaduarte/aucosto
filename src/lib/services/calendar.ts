import "server-only";

import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { recordEvent } from "@/lib/services/events";
import { ensureTimeCategoryTable } from "@/lib/services/time-categories";
import type { CalendarItem } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import {
  expandRecurrence,
  normalizeRecurrenceRule,
  type RecurrenceRule,
} from "@/lib/recurrence";

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
  /** TimeCategory id, or null to clear. `undefined` leaves it untouched. */
  categoryId?: string | null;
  sourceTool?: string | null;
  sourceRefId?: string | null;
  externalId?: string | null;
  recurrenceRule?: RecurrenceRule | null;
};

export type CalendarOccurrence = CalendarItem & {
  recurrenceRule: Prisma.JsonValue | null;
  recurrenceParentId: string | null;
  recurrenceOriginalStart: Date | null;
};

const VIRTUAL_ID_SEPARATOR = "::";

export function virtualCalendarItemId(parentId: string, originalStart: Date) {
  return `${parentId}${VIRTUAL_ID_SEPARATOR}${originalStart.toISOString()}`;
}

function parseVirtualCalendarItemId(id: string) {
  const [parentId, originalStartIso] = id.split(VIRTUAL_ID_SEPARATOR);
  if (!parentId || !originalStartIso) return null;
  const originalStart = new Date(originalStartIso);
  if (Number.isNaN(originalStart.getTime())) return null;
  return { parentId, originalStart };
}

// ── Category column (raw SQL, like TimeCategory itself) ────────────────────
// `CalendarItem.categoryId` is added out-of-band: the generated Prisma client
// predates it, so the typed `prisma.calendarItem.*` calls neither select nor
// write it. All categoryId access goes through $queryRaw / $executeRaw here,
// mirroring the reflect/rhythms/time-categories pattern. Once `prisma generate`
// has run with the current schema, this can be folded into the typed client.

let categoryColumnReady: Promise<void> | null = null;

/**
 * Idempotently add `CalendarItem.categoryId` (FK → TimeCategory). Memoized per
 * process; a failure resets the memo so a cold-start DB blip retries instead of
 * poisoning the process (same shape as ensureTimeCategoryTable). Ensures the
 * TimeCategory table exists first so the REFERENCES clause can resolve.
 */
export function ensureCalendarCategoryColumn(): Promise<void> {
  if (!categoryColumnReady) {
    categoryColumnReady = (async () => {
      await ensureTimeCategoryTable();
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "CalendarItem" ADD COLUMN IF NOT EXISTS "categoryId" TEXT REFERENCES "TimeCategory"("id");',
      );
    })()
      .then(() => undefined)
      .catch((error) => {
        categoryColumnReady = null;
        console.error("[calendar] ensureCalendarCategoryColumn failed", error);
      });
  }
  return categoryColumnReady;
}

/**
 * Map of calendar item id → categoryId for the given ids. Reads through raw SQL
 * (the typed client can't see the column). Degrades to an empty map if the
 * column/table isn't there yet, so the timeline still renders uncategorized.
 */
export async function getCalendarItemCategoryIds(
  userId: string,
  ids: string[],
): Promise<Map<string, string | null>> {
  requireCan(userId, "calendar", "read");
  const result = new Map<string, string | null>();
  if (ids.length === 0) return result;
  const backingIds = ids.map((id) => parseVirtualCalendarItemId(id)?.parentId ?? id);
  try {
    await ensureCalendarCategoryColumn();
    const rows = await prisma.$queryRaw<Array<{ id: string; categoryId: string | null }>>(
      Prisma.sql`
        SELECT "id", "categoryId"
        FROM "CalendarItem"
        WHERE "userId" = ${userId} AND "id" IN (${Prisma.join(backingIds)})
      `,
    );
    const byBackingId = new Map(rows.map((row) => [row.id, row.categoryId]));
    for (const id of ids) {
      const backingId = parseVirtualCalendarItemId(id)?.parentId ?? id;
      result.set(id, byBackingId.get(backingId) ?? null);
    }
  } catch (error) {
    console.error("[calendar] getCalendarItemCategoryIds failed", error);
  }
  return result;
}

/**
 * Persist a calendar item's categoryId (raw SQL). `null` clears it. Caller is
 * responsible for ownership scoping — we still filter by userId defensively.
 */
async function writeCalendarItemCategory(
  userId: string,
  id: string,
  categoryId: string | null,
): Promise<void> {
  await ensureCalendarCategoryColumn();
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "CalendarItem" SET "categoryId" = ${categoryId}
    WHERE "id" = ${id} AND "userId" = ${userId}
  `);
}

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

function isMissingCalendarTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  );
}

export async function listCalendarItems(
  userId: string,
  range: CalendarRange,
): Promise<CalendarOccurrence[]> {
  requireCan(userId, "calendar", "read");
  try {
    const directItems = await prisma.calendarItem.findMany({
      where: {
        userId,
        startsAt: { lt: range.to },
        endsAt: { gt: range.from },
        status: { not: "cancelled" },
        OR: [{ recurrenceRule: { equals: Prisma.DbNull } }, { recurrenceParentId: { not: null } }],
      },
      orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
    });
    const recurringParents = await prisma.calendarItem.findMany({
      where: {
        userId,
        startsAt: { lt: range.to },
        recurrenceRule: { not: Prisma.DbNull },
        recurrenceParentId: null,
        status: { not: "cancelled" },
      },
      orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
    });
    const exceptions = directItems.filter((item) => item.recurrenceParentId);
    const exceptionByOriginal = new Map(
      exceptions
        .filter((item) => item.recurrenceParentId && item.recurrenceOriginalStart)
        .map((item) => [
          `${item.recurrenceParentId}:${item.recurrenceOriginalStart!.toISOString()}`,
          item,
        ]),
    );
    const generated = recurringParents.flatMap((parent) => {
      const rule = normalizeRecurrenceRule(parent.recurrenceRule as RecurrenceRule | null);
      if (!rule) return [];
      return expandRecurrence(parent.startsAt, parent.endsAt, rule, range)
        .filter((occurrence) => {
          const key = `${parent.id}:${occurrence.originalStart.toISOString()}`;
          return !exceptionByOriginal.has(key);
        })
        .map((occurrence) => ({
          ...parent,
          id: virtualCalendarItemId(parent.id, occurrence.originalStart),
          startsAt: occurrence.startsAt,
          endsAt: occurrence.endsAt,
          recurrenceParentId: parent.id,
          recurrenceOriginalStart: occurrence.originalStart,
        }));
    });
    return [...directItems, ...generated]
      .filter((item) => item.status !== "cancelled")
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.createdAt.getTime() - b.createdAt.getTime());
  } catch (error) {
    if (isMissingCalendarTableError(error)) {
      return [];
    }
    throw error;
  }
}

export async function listUpcomingCalendarItems(
  userId: string,
  options: { from?: Date; limit?: number } = {},
): Promise<CalendarOccurrence[]> {
  requireCan(userId, "calendar", "read");
  const from = options.from ?? new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + 90);
  return (await listCalendarItems(userId, { from, to })).slice(0, options.limit ?? 10);
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

  let item: CalendarItem;
  try {
    item = await prisma.calendarItem.create({
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
        recurrenceRule: input.recurrenceRule
          ? (normalizeRecurrenceRule(input.recurrenceRule) as Prisma.InputJsonValue)
          : Prisma.DbNull,
      },
    });
  } catch (error) {
    if (isMissingCalendarTableError(error)) {
      throw new Error("Calendar is deployed before its database table. Try again in a moment.");
    }
    throw error;
  }

  // categoryId lives outside the generated client — set it via raw SQL after
  // the typed create. Only when explicitly provided (undefined = leave unset).
  if (input.categoryId !== undefined) {
    await writeCalendarItemCategory(userId, item.id, input.categoryId || null);
  }

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
  const virtual = parseVirtualCalendarItemId(id);
  if (virtual) {
    const parent = await prisma.calendarItem.findFirst({
      where: { id: virtual.parentId, userId },
    });
    if (!parent) return null;
    const durationMs = parent.endsAt.getTime() - parent.startsAt.getTime();
    const startsAt = input.startsAt ?? virtual.originalStart;
    const endsAt = input.endsAt ?? new Date(startsAt.getTime() + durationMs);
    validateWindow(startsAt, endsAt);
    return createCalendarItem(userId, {
      title: input.title ?? parent.title,
      startsAt,
      endsAt,
      notes: input.notes === undefined ? parent.notes : input.notes,
      location: input.location === undefined ? parent.location : input.location,
      kind: input.kind ?? parent.kind,
      status: input.status ?? parent.status,
      allDay: input.allDay ?? parent.allDay,
      categoryId: input.categoryId,
      sourceTool: parent.sourceTool,
      sourceRefId: parent.sourceRefId,
      recurrenceRule: null,
      externalId: null,
    }).then(async (exception) => {
      await prisma.calendarItem.update({
        where: { id: exception.id },
        data: {
          recurrenceParentId: parent.id,
          recurrenceOriginalStart: virtual.originalStart,
        },
      });
      return prisma.calendarItem.findUnique({ where: { id: exception.id } });
    });
  }

  let existing: CalendarItem | null;
  try {
    existing = await prisma.calendarItem.findFirst({ where: { id, userId } });
  } catch (error) {
    if (isMissingCalendarTableError(error)) {
      return null;
    }
    throw error;
  }
  if (!existing) return null;

  const startsAt = input.startsAt ?? existing.startsAt;
  const endsAt = input.endsAt ?? existing.endsAt;
  validateWindow(startsAt, endsAt);

  let item: CalendarItem;
  try {
    item = await prisma.calendarItem.update({
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
        recurrenceRule:
          input.recurrenceRule === undefined
            ? undefined
            : input.recurrenceRule
              ? (normalizeRecurrenceRule(input.recurrenceRule) as Prisma.InputJsonValue)
              : Prisma.DbNull,
      },
    });
  } catch (error) {
    if (isMissingCalendarTableError(error)) {
      return null;
    }
    throw error;
  }

  // categoryId is stored out-of-band (raw SQL) — apply it when provided.
  if (input.categoryId !== undefined) {
    await writeCalendarItemCategory(userId, item.id, input.categoryId || null);
  }

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
  const virtual = parseVirtualCalendarItemId(id);
  if (virtual) {
    const parent = await prisma.calendarItem.findFirst({
      where: { id: virtual.parentId, userId },
    });
    if (!parent) return;
    await prisma.calendarItem.create({
      data: {
        userId,
        title: parent.title,
        kind: parent.kind,
        status: "cancelled",
        startsAt: virtual.originalStart,
        endsAt: new Date(
          virtual.originalStart.getTime() +
            (parent.endsAt.getTime() - parent.startsAt.getTime()),
        ),
        allDay: parent.allDay,
        notes: parent.notes,
        location: parent.location,
        sourceTool: parent.sourceTool,
        sourceRefId: parent.sourceRefId,
        recurrenceParentId: parent.id,
        recurrenceOriginalStart: virtual.originalStart,
      },
    });
    await recordEvent({
      userId,
      tool: "calendar",
      type: "calendar.deleted",
      refId: id,
    });
    return;
  }
  let count = 0;
  try {
    ({ count } = await prisma.calendarItem.deleteMany({
      where: { id, userId },
    }));
  } catch (error) {
    if (isMissingCalendarTableError(error)) {
      return;
    }
    throw error;
  }
  if (count > 0) {
    await recordEvent({
      userId,
      tool: "calendar",
      type: "calendar.deleted",
      refId: id,
    });
  }
}
