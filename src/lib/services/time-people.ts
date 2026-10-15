// Service layer for linking Rolodex people to time entries ("time with people").
//
// Like time-categories and rolodex, the TimeEntryPerson join table is created
// via raw SQL (`ensureTimeEntryPersonTable`) rather than `prisma migrate` —
// the generated client predates this model, so all access here goes through
// $queryRaw / $executeRaw. Reads degrade to empty when the table is missing;
// writes surface a clear error.
//
// Date-range filtering is done through the Prisma TimeEntry model (not raw
// SQL) to avoid parameterized date-arithmetic pitfalls — see docs/lessons.md
// #2. Only completed entries (endedAt != null) count toward summaries.

import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { listPersons } from "@/lib/services/rolodex";

export interface PersonTimeSummary {
  personId: string;
  displayName: string;
  totalMinutes: number;
  entryCount: number;
  byCategory: { category: string; minutes: number }[];
}

type LinkRow = {
  timeEntryId: string;
  personId: string;
};

/**
 * True when the TimeEntryPerson table hasn't been created yet. Matches error
 * CODES first (the pg adapter rewrites 42P01 → Prisma P2021); message text only
 * as a fallback — see docs/lessons.md #3.
 */
function isMissingTableError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021") return true;
    if (error.code === "P2010") {
      return JSON.stringify(error.meta ?? {}).includes("42P01");
    }
  }
  return (
    error instanceof Error &&
    (error.message.includes("42P01") ||
      (error.message.includes("TimeEntryPerson") &&
        error.message.includes("does not exist")))
  );
}

let tableReady: Promise<void> | null = null;

export function ensureTimeEntryPersonTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await prisma.$executeRawUnsafe(
        'CREATE TABLE IF NOT EXISTS "TimeEntryPerson" (' +
          '"id" TEXT PRIMARY KEY, ' +
          '"userId" TEXT NOT NULL, ' +
          '"timeEntryId" TEXT NOT NULL, ' +
          '"personId" TEXT NOT NULL, ' +
          '"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), ' +
          'UNIQUE("userId", "timeEntryId", "personId"));',
      );
      await prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "TimeEntryPerson_user_time_idx" ' +
          'ON "TimeEntryPerson" ("userId", "timeEntryId");',
      );
      await prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "TimeEntryPerson_user_person_idx" ' +
          'ON "TimeEntryPerson" ("userId", "personId");',
      );
    })();
  }
  return tableReady;
}

/**
 * Replace the set of people linked to a time entry. Throws when the entry
 * does not exist or belongs to another user.
 */
export async function setEntryPeople(
  userId: string,
  timeEntryId: string,
  personIds: string[],
): Promise<void> {
  requireCan(userId, "time", "write");
  await ensureTimeEntryPersonTable();
  const entry = await prisma.timeEntry.findFirst({
    where: { id: timeEntryId, userId },
    select: { id: true },
  });
  if (!entry) throw new Error(`Time entry "${timeEntryId}" not found`);
  const unique = [...new Set(personIds.filter((id) => id && id.trim()))];
  await prisma.$executeRawUnsafe(
    'DELETE FROM "TimeEntryPerson" WHERE "userId" = $1 AND "timeEntryId" = $2',
    userId,
    timeEntryId,
  );
  for (const personId of unique) {
    await prisma.$executeRawUnsafe(
      'INSERT INTO "TimeEntryPerson" ("id", "userId", "timeEntryId", "personId") ' +
        "VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
      randomUUID(),
      userId,
      timeEntryId,
      personId,
    );
  }
}

/** Person IDs linked to one time entry. Empty when the table is missing. */
export async function listEntryPeople(
  userId: string,
  timeEntryId: string,
): Promise<string[]> {
  requireCan(userId, "time", "read");
  try {
    await ensureTimeEntryPersonTable();
    const rows = await prisma.$queryRawUnsafe<LinkRow[]>(
      'SELECT "timeEntryId", "personId" FROM "TimeEntryPerson" ' +
        'WHERE "userId" = $1 AND "timeEntryId" = $2',
      userId,
      timeEntryId,
    );
    return rows.map((r) => r.personId);
  } catch (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
}

export interface PersonTimeRange {
  from: Date;
  to: Date;
}

/**
 * Per-person time totals for completed entries overlapping [from, to).
 * Minutes are attributed in full to every linked person (a 60-minute dinner
 * with two people counts 60 minutes for each — it's time *with* people, not
 * time divided by people). Returns [] when the table is missing.
 */
export async function personTimeSummary(
  userId: string,
  range: PersonTimeRange,
): Promise<PersonTimeSummary[]> {
  requireCan(userId, "time", "read");
  try {
    await ensureTimeEntryPersonTable();
    const links = await prisma.$queryRawUnsafe<LinkRow[]>(
      'SELECT "timeEntryId", "personId" FROM "TimeEntryPerson" WHERE "userId" = $1',
      userId,
    );
    if (links.length === 0) return [];

    const entryIds = [...new Set(links.map((l) => l.timeEntryId))];
    const entries = await prisma.timeEntry.findMany({
      where: {
        id: { in: entryIds },
        userId,
        startedAt: { gte: range.from, lt: range.to },
        endedAt: { not: null },
      },
      select: { id: true, startedAt: true, endedAt: true, category: true },
    });
    const byId = new Map(entries.map((e) => [e.id, e]));

    let nameById = new Map<string, string>();
    try {
      const persons = await listPersons(userId);
      nameById = new Map(persons.map((p) => [p.id, p.displayName]));
    } catch {
      // Rolodex unavailable — fall back to raw person IDs below.
    }

    const agg = new Map<
      string,
      { minutes: number; entryIds: Set<string>; byCategory: Map<string, number> }
    >();
    for (const link of links) {
      const entry = byId.get(link.timeEntryId);
      if (!entry?.endedAt) continue;
      const minutes = Math.max(
        0,
        Math.round(
          (entry.endedAt.getTime() - entry.startedAt.getTime()) / 60000,
        ),
      );
      let bucket = agg.get(link.personId);
      if (!bucket) {
        bucket = { minutes: 0, entryIds: new Set(), byCategory: new Map() };
        agg.set(link.personId, bucket);
      }
      bucket.minutes += minutes;
      bucket.entryIds.add(entry.id);
      const cat = entry.category?.trim() || "uncategorized";
      bucket.byCategory.set(cat, (bucket.byCategory.get(cat) ?? 0) + minutes);
    }

    return [...agg.entries()]
      .map(([personId, b]) => ({
        personId,
        displayName: nameById.get(personId) ?? personId,
        totalMinutes: b.minutes,
        entryCount: b.entryIds.size,
        byCategory: [...b.byCategory.entries()]
          .map(([category, minutes]) => ({ category, minutes }))
          .sort((a, b2) => b2.minutes - a.minutes),
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes);
  } catch (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
}
