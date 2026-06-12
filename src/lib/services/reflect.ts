// Service layer for daily reflections.
//
// NOTE: this service uses $queryRaw instead of the typed client because the
// generated Prisma client (src/generated/prisma) couldn't be regenerated in
// the environment that authored this feature. The DailyReflection model IS in
// prisma/schema/reflect.prisma and its migration is checked in — after the
// next `npm run db:migrate` / `npm run db:generate`, these queries can be
// swapped for `prisma.dailyReflection.*` without changing any callers.
// All raw SQL stays confined to this file (the service is the chokepoint).

import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { recordEvent } from "@/lib/services/events";
import { dayKey, type ReflectionContextSnapshot } from "@/lib/reflect";
import { listDoItems } from "@/lib/services/do";
import { listHabits } from "@/lib/services/habits";
import { listEntriesBetween } from "@/lib/services/time";

export type DailyReflectionRecord = {
  id: string;
  dateKey: string;
  mood: number;
  energyLevel: number;
  productivityRating: number;
  dayRating: number;
  wentWell: string | null;
  carryForward: string | null;
  freeNotes: string | null;
  contextSnapshot: ReflectionContextSnapshot | null;
};

type Row = {
  id: string;
  dateKey: string;
  mood: number;
  energyLevel: number;
  productivityRating: number;
  dayRating: number;
  wentWell: string | null;
  carryForward: string | null;
  freeNotes: string | null;
  contextSnapshot: unknown;
};

/**
 * True when the DailyReflection table hasn't been migrated yet. Reads
 * degrade to empty so the hub/layout render before migration.
 *
 * IMPORTANT: the pg driver adapter translates postgres 42P01 into Prisma's
 * P2021 ("table does not exist", message uses backticks) — checking the raw
 * pg strings here once took the whole app down, because the guard never
 * matched and the layout's badge read threw on every request. Match on
 * error CODES first, message text only as a fallback.
 */
function isMissingTableError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021") return true;
    // P2010 = raw query failed; the database code rides in meta.
    if (error.code === "P2010") {
      return JSON.stringify(error.meta ?? {}).includes("42P01");
    }
  }
  return (
    error instanceof Error &&
    (error.message.includes("42P01") ||
      (error.message.includes("DailyReflection") &&
        error.message.includes("does not exist")))
  );
}

function toRecord(row: Row): DailyReflectionRecord {
  return {
    ...row,
    contextSnapshot: (row.contextSnapshot ??
      null) as ReflectionContextSnapshot | null,
  };
}

const SELECT_FIELDS = Prisma.sql`
  "id",
  to_char("date", 'YYYY-MM-DD') AS "dateKey",
  "mood",
  "energyLevel",
  "productivityRating",
  "dayRating",
  "wentWell",
  "carryForward",
  "freeNotes",
  "contextSnapshot"
`;

export async function getReflection(
  userId: string,
  dateKeyValue: string,
): Promise<DailyReflectionRecord | null> {
  requireCan(userId, "reflect", "read");
  try {
    const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT ${SELECT_FIELDS}
      FROM "DailyReflection"
      WHERE "userId" = ${userId} AND "date" = ${dateKeyValue}::date
      LIMIT 1
    `);
    return rows[0] ? toRecord(rows[0]) : null;
  } catch (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
}

export async function listReflections(
  userId: string,
  options: { limit?: number; sinceKey?: string } = {},
): Promise<DailyReflectionRecord[]> {
  requireCan(userId, "reflect", "read");
  try {
    const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT ${SELECT_FIELDS}
      FROM "DailyReflection"
      WHERE "userId" = ${userId}
        AND (${options.sinceKey ?? null}::date IS NULL OR "date" >= ${options.sinceKey ?? null}::date)
      ORDER BY "date" DESC
      LIMIT ${options.limit ?? 60}
    `);
    return rows.map(toRecord);
  } catch (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
}

export type SaveReflectionInput = {
  dateKey: string;
  mood: number;
  energyLevel: number;
  productivityRating: number;
  dayRating: number;
  wentWell?: string | null;
  carryForward?: string | null;
  freeNotes?: string | null;
  contextSnapshot: ReflectionContextSnapshot;
};

export async function upsertReflection(
  userId: string,
  input: SaveReflectionInput,
): Promise<void> {
  requireCan(userId, "reflect", "write");
  const id = randomUUID();
  const snapshotJson = JSON.stringify(input.contextSnapshot);
  try {
    await upsertRow(id, userId, input, snapshotJson);
  } catch (error) {
    if (isMissingTableError(error)) {
      throw new Error(
        "The reflection table isn't migrated yet — run `npm run db:migrate` first.",
      );
    }
    throw error;
  }
  await recordEvent({
    userId,
    tool: "reflect",
    type: "reflect.saved",
    meta: { dateKey: input.dateKey, dayRating: input.dayRating },
  });
}

async function upsertRow(
  id: string,
  userId: string,
  input: SaveReflectionInput,
  snapshotJson: string,
): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "DailyReflection" (
      "id", "userId", "date", "mood", "energyLevel", "productivityRating",
      "dayRating", "wentWell", "carryForward", "freeNotes",
      "contextSnapshot", "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${userId}, ${input.dateKey}::date, ${input.mood},
      ${input.energyLevel}, ${input.productivityRating}, ${input.dayRating},
      ${input.wentWell ?? null}, ${input.carryForward ?? null},
      ${input.freeNotes ?? null}, ${snapshotJson}::jsonb, now(), now()
    )
    ON CONFLICT ("userId", "date") DO UPDATE SET
      "mood" = EXCLUDED."mood",
      "energyLevel" = EXCLUDED."energyLevel",
      "productivityRating" = EXCLUDED."productivityRating",
      "dayRating" = EXCLUDED."dayRating",
      "wentWell" = EXCLUDED."wentWell",
      "carryForward" = EXCLUDED."carryForward",
      "freeNotes" = EXCLUDED."freeNotes",
      "contextSnapshot" = EXCLUDED."contextSnapshot",
      "updatedAt" = now()
  `);
}

/**
 * Freeze-frame of the day, captured at save time (and shown on the reflect
 * page): tracked minutes and entry notes from the time tool, tasks completed
 * today, due-habit progress.
 */
export async function buildReflectionSnapshot(
  userId: string,
  now: Date,
): Promise<ReflectionContextSnapshot> {
  requireCan(userId, "reflect", "read");
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayKey = dayKey(now);

  const [entries, tasks, habits] = await Promise.all([
    listEntriesBetween(userId, { from: todayStart, to: tomorrow }),
    listDoItems(userId, { includeDone: true }),
    listHabits(userId),
  ]);

  const trackedMs = entries.reduce((sum, entry) => {
    const end = entry.endedAt ?? now;
    const from = Math.max(entry.startedAt.getTime(), todayStart.getTime());
    const to = Math.min(end.getTime(), now.getTime());
    return sum + Math.max(0, to - from);
  }, 0);

  const tasksCompleted = tasks.filter(
    (task) => task.completedAt && dayKey(task.completedAt) === todayKey,
  ).length;

  const dueHabits = habits.filter((habit) => habit.dueToday);
  const hitHabits = dueHabits.filter((habit) => habit.completedToday);

  return {
    trackedMinutes: Math.round(trackedMs / 60000),
    entryCount: entries.length,
    tasksCompleted,
    habitsDue: dueHabits.length,
    habitsHit: hitHabits.length,
    entryNotes: entries
      .filter((entry) => entry.notes && entry.notes.trim().length > 0)
      .map((entry) => ({ label: entry.label, note: entry.notes!.trim() })),
  };
}

/** Last N days of (dateKey, mood) for the hub trends dots, oldest first. */
export async function listRecentMoods(
  userId: string,
  options: { days?: number } = {},
): Promise<Array<{ dateKey: string; mood: number }>> {
  requireCan(userId, "reflect", "read");
  const days = options.days ?? 7;
  try {
    const rows = await prisma.$queryRaw<
      Array<{ dateKey: string; mood: number }>
    >(Prisma.sql`
      SELECT to_char("date", 'YYYY-MM-DD') AS "dateKey", "mood"
      FROM "DailyReflection"
      WHERE "userId" = ${userId}
        AND "date" >= (now()::date - ${days - 1})
      ORDER BY "date" ASC
    `);
    return rows;
  } catch (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
}
