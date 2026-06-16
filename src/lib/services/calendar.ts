import "server-only";

import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { recordEvent } from "@/lib/services/events";
import { ensureTimeCategoryTable } from "@/lib/services/time-categories";
import type { CalendarItem } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";

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
};

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
  try {
    await ensureCalendarCategoryColumn();
    const rows = await prisma.$queryRaw<Array<{ id: string; categoryId: string | null }>>(
      Prisma.sql`
        SELECT "id", "categoryId"
        FROM "CalendarItem"
        WHERE "userId" = ${userId} AND "id" IN (${Prisma.join(ids)})
      `,
    );
    for (const row of rows) result.set(row.id, row.categoryId);
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
): Promise<CalendarItem[]> {
  requireCan(userId, "calendar", "read");
  try {
    return await prisma.calendarItem.findMany({
      where: {
        userId,
        startsAt: { lt: range.to },
        endsAt: { gt: range.from },
        status: { not: "cancelled" },
      },
      orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
    });
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
): Promise<CalendarItem[]> {
  requireCan(userId, "calendar", "read");
  try {
    return await prisma.calendarItem.findMany({
      where: {
        userId,
        endsAt: { gte: options.from ?? new Date() },
        status: { not: "cancelled" },
      },
      orderBy: [{ startsAt: "asc" }],
      take: options.limit ?? 10,
    });
  } catch (error) {
    if (isMissingCalendarTableError(error)) {
      return [];
    }
    throw error;
  }
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
