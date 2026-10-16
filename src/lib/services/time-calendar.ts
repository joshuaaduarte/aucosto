// Service layer for linking calendar blocks to time entries ("planned vs
// actual").
//
// Like CalendarItem.categoryId and the TimeEntryPerson join table, the
// `TimeEntry.calendarEventId` column is created via raw SQL
// (`ensureTimeEntryCalendarLinkColumn`) rather than `prisma migrate` — the
// generated client predates it, so all access here goes through $queryRaw /
// $executeRaw. Reads degrade gracefully when the column is missing; writes
// surface a clear error.
//
// Semantics:
// - One entry links to at most one calendar block (single FK), while a block
//   can have many linked entries.
// - The stored id is always the *backing* CalendarItem id: recurring
//   occurrences (`parentId::iso` virtual ids) resolve to their parent row.
// - Deleting the calendar event clears the link (ON DELETE SET NULL) — the
//   time entry itself is never deleted.
// - Name resolution and auto-suggestions never guess: unknown/ambiguous input
//   produces warnings, and suggestions are returned to the caller (the
//   assistant) rather than applied.

import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import {
  listCalendarItems,
  getCalendarItem,
  backingCalendarItemId,
  type CalendarOccurrence,
} from "@/lib/services/calendar";

export interface CalendarLinkSuggestion {
  eventId: string;
  title: string;
}

export interface CalendarBlockResolution {
  /** Backing CalendarItem id (recurrence occurrences resolve to parent). */
  eventId: string | null;
  title: string | null;
  warnings: string[];
}

/**
 * True when the TimeEntry.calendarEventId column hasn't been created yet.
 * Matches error CODES first (the pg adapter rewrites 42P01 → Prisma P2021 and
 * 42703 → P2010/P2022); message text only as a fallback — see
 * docs/lessons.md #3.
 */
function isMissingLinkColumnError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021") return true;
    if (error.code === "P2010" || error.code === "P2022") {
      const meta = JSON.stringify(error.meta ?? {});
      if (meta.includes("42P01") || meta.includes("42703")) return true;
    }
  }
  return (
    error instanceof Error &&
    (error.message.includes("42P01") ||
      error.message.includes("42703") ||
      (error.message.includes("calendarEventId") &&
        (error.message.includes("does not exist") ||
          error.message.includes("does not exist"))))
  );
}

let columnReady: Promise<void> | null = null;

/**
 * Idempotently add `TimeEntry.calendarEventId` (FK → CalendarItem, cleared on
 * delete) plus a covering index. Memoized per process; a failure resets the
 * memo so a cold-start DB blip retries instead of poisoning the process (same
 * shape as ensureTimeEntryPersonTable).
 */
export function ensureTimeEntryCalendarLinkColumn(): Promise<void> {
  if (!columnReady) {
    columnReady = (async () => {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "calendarEventId" TEXT ' +
          'REFERENCES "CalendarItem"("id") ON DELETE SET NULL;',
      );
      await prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "TimeEntry_userId_calendarEventId_idx" ' +
          'ON "TimeEntry"("userId", "calendarEventId");',
      );
    })()
      .then(() => undefined)
      .catch((error) => {
        columnReady = null;
        console.error("[time-calendar] ensureTimeEntryCalendarLinkColumn failed", error);
        throw error;
      });
  }
  return columnReady;
}

/**
 * Link (or unlink with `null`) a time entry to a calendar block. The stored id
 * is the backing CalendarItem id — virtual recurrence-occurrence ids resolve
 * to their parent. Throws when the entry doesn't exist, belongs to another
 * user, or the calendar event can't be found.
 */
export async function setEntryCalendarLink(
  userId: string,
  timeEntryId: string,
  calendarEventId: string | null,
): Promise<void> {
  requireCan(userId, "time", "write");
  await ensureTimeEntryCalendarLinkColumn();
  const entry = await prisma.timeEntry.findFirst({
    where: { id: timeEntryId, userId },
    select: { id: true },
  });
  if (!entry) throw new Error(`Time entry "${timeEntryId}" not found`);
  let backingId: string | null = null;
  if (calendarEventId) {
    const item = await getCalendarItem(userId, calendarEventId);
    if (!item) throw new Error(`Calendar event "${calendarEventId}" not found`);
    backingId = backingCalendarItemId(item.id);
  }
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "TimeEntry"
    SET "calendarEventId" = ${backingId}
    WHERE "id" = ${timeEntryId} AND "userId" = ${userId}
  `);
}

// ── Day bounds (server-local, matching parseDateTimeLocal in the executor) ──

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/** Local-day window containing `day` (defaults to today). */
export function localDayBounds(day: Date = new Date()): { from: Date; to: Date } {
  const from = startOfLocalDay(day);
  return { from, to: new Date(from.getTime() + 24 * 60 * 60 * 1000) };
}

// ── Name resolution (fuzzy, warn-and-skip) ───────────────────────────────────

/**
 * Resolve a calendar title against one day's blocks (defaults to today).
 * Exact title match wins; a single fuzzy (substring, either direction) match
 * is accepted; zero or ambiguous matches produce a warning and no link —
 * never fails, never guesses.
 */
export async function resolveCalendarBlockByTitle(
  userId: string,
  title: string,
  day: Date = new Date(),
): Promise<CalendarBlockResolution> {
  requireCan(userId, "calendar", "read");
  const query = title.trim();
  if (!query) {
    return { eventId: null, title: null, warnings: ["Empty calendar title — no calendar link added"] };
  }
  const blocks = await listCalendarItems(userId, localDayBounds(day));
  const lower = query.toLowerCase();
  const exact = blocks.filter((b) => b.title.toLowerCase() === lower);
  const fuzzy =
    exact.length > 0
      ? exact
      : blocks.filter(
          (b) =>
            b.title.toLowerCase().includes(lower) ||
            lower.includes(b.title.toLowerCase()),
        );
  if (fuzzy.length === 1) {
    const block = fuzzy[0]!;
    return {
      eventId: backingCalendarItemId(block.id),
      title: block.title,
      warnings: [],
    };
  }
  if (fuzzy.length === 0) {
    return {
      eventId: null,
      title: null,
      warnings: [`No calendar block matched "${query}" — no calendar link added`],
    };
  }
  return {
    eventId: null,
    title: null,
    warnings: [
      `Multiple calendar blocks matched "${query}" (${fuzzy
        .map((b) => b.title)
        .join(", ")}) — skipping to avoid a wrong link`,
    ],
  };
}

// ── Auto-suggestions (suggested, never applied) ─────────────────────────────

const SUGGEST_WINDOW_MS = 15 * 60 * 1000;

/**
 * Suggest a calendar block when starting a timer within 15 minutes of a
 * block's start (|blockStart − now| ≤ 15 min). Nearest start wins.
 */
export async function suggestCalendarLinkForStart(
  userId: string,
  now: Date = new Date(),
): Promise<CalendarLinkSuggestion | null> {
  requireCan(userId, "calendar", "read");
  const blocks = await listCalendarItems(userId, {
    from: new Date(now.getTime() - SUGGEST_WINDOW_MS),
    to: new Date(now.getTime() + SUGGEST_WINDOW_MS),
  });
  let best: CalendarOccurrence | null = null;
  let bestDiff = Infinity;
  for (const block of blocks) {
    const diff = Math.abs(block.startsAt.getTime() - now.getTime());
    if (diff <= SUGGEST_WINDOW_MS && diff < bestDiff) {
      best = block;
      bestDiff = diff;
    }
  }
  return best ? { eventId: best.id, title: best.title } : null;
}

/**
 * Suggest a calendar block when a logged entry's window overlaps a block's
 * range. Largest overlap wins; ties break toward the earliest block start.
 */
export async function suggestCalendarLinkForRange(
  userId: string,
  start: Date,
  end: Date,
): Promise<CalendarLinkSuggestion | null> {
  requireCan(userId, "calendar", "read");
  if (!(end.getTime() > start.getTime())) return null;
  const blocks = await listCalendarItems(userId, { from: start, to: end });
  let best: CalendarOccurrence | null = null;
  let bestOverlap = -1;
  for (const block of blocks) {
    const overlap =
      Math.min(block.endsAt.getTime(), end.getTime()) -
      Math.max(block.startsAt.getTime(), start.getTime());
    if (
      overlap > bestOverlap ||
      (overlap === bestOverlap && best !== null && block.startsAt < best.startsAt)
    ) {
      best = block;
      bestOverlap = overlap;
    }
  }
  return best && bestOverlap > 0 ? { eventId: best.id, title: best.title } : null;
}

// ── Read side: entries linked to blocks ─────────────────────────────────────

export interface LinkedTimeEntryRow {
  id: string;
  label: string;
  startedAt: Date;
  endedAt: Date | null;
  calendarEventId: string | null;
}

/**
 * Time entries linked to any of the given *backing* calendar event ids.
 * Returns an empty array when the column doesn't exist yet (degrades like the
 * other out-of-band reads). Runs and completed entries both included — the
 * caller decides what counts toward totals.
 */
export async function listEntriesForCalendarEvents(
  userId: string,
  eventIds: string[],
): Promise<LinkedTimeEntryRow[]> {
  requireCan(userId, "time", "read");
  if (eventIds.length === 0) return [];
  try {
    await ensureTimeEntryCalendarLinkColumn();
    return await prisma.$queryRaw<LinkedTimeEntryRow[]>(Prisma.sql`
      SELECT "id", "label", "startedAt", "endedAt", "calendarEventId"
      FROM "TimeEntry"
      WHERE "userId" = ${userId}
        AND "calendarEventId" IN (${Prisma.join(eventIds)})
      ORDER BY "startedAt" ASC
    `);
  } catch (error) {
    if (isMissingLinkColumnError(error)) return [];
    throw error;
  }
}
