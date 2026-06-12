// Service layer for Life Rhythms.
//
// NOTE: like the reflect service, this uses $queryRaw/$executeRaw instead of
// the typed client. The RhythmSession model is in prisma/schema/rhythms.prisma
// and its migration is checked in (scripts/create-rhythm-table.sql is the
// idempotent fallback), but the generated Prisma client could not be
// regenerated in the environment that authored this feature. Once
// `npm run db:generate` has run with the current schema, these queries can be
// swapped for `prisma.rhythmSession.*` without touching any callers. All raw
// SQL stays confined to this file (the service is the chokepoint).

import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { recordEvent } from "@/lib/services/events";
import {
  normalizeRhythmType,
  rhythmDurationMinutes,
  type RhythmType,
} from "@/lib/rhythms";

export type RhythmSessionRecord = {
  id: string;
  type: RhythmType;
  startedAt: Date;
  endedAt: Date | null;
  durationMinutes: number | null;
  notes: string | null;
};

type Row = {
  id: string;
  type: string;
  startedAt: Date;
  endedAt: Date | null;
  durationMinutes: number | null;
  notes: string | null;
};

/**
 * True when the RhythmSession table hasn't been migrated yet. Reads degrade
 * to empty so the hub/page render before the table exists. Matches error
 * CODES first (the pg adapter rewrites 42P01 → Prisma P2021), message text
 * only as a fallback — see docs/lessons.md #3.
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
      (error.message.includes("RhythmSession") &&
        error.message.includes("does not exist")))
  );
}

function toRecord(row: Row): RhythmSessionRecord {
  return {
    id: row.id,
    type: (normalizeRhythmType(row.type) ?? "work") as RhythmType,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    durationMinutes: row.durationMinutes,
    notes: row.notes,
  };
}

const SELECT_FIELDS = Prisma.sql`
  "id", "type", "startedAt", "endedAt", "durationMinutes", "notes"
`;

/** The currently-running session (endedAt IS NULL), optionally of one type. */
export async function getActiveRhythm(
  userId: string,
  type?: RhythmType,
): Promise<RhythmSessionRecord | null> {
  requireCan(userId, "rhythm", "read");
  try {
    const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT ${SELECT_FIELDS}
      FROM "RhythmSession"
      WHERE "userId" = ${userId}
        AND "endedAt" IS NULL
        AND (${type ?? null}::text IS NULL OR "type" = ${type ?? null}::text)
      ORDER BY "startedAt" DESC
      LIMIT 1
    `);
    return rows[0] ? toRecord(rows[0]) : null;
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error("[rhythms] getActiveRhythm failed", error);
    }
    return null;
  }
}

/** All currently-running sessions, keyed by type (one card can be active). */
export async function listActiveRhythms(
  userId: string,
): Promise<Map<RhythmType, RhythmSessionRecord>> {
  requireCan(userId, "rhythm", "read");
  const byType = new Map<RhythmType, RhythmSessionRecord>();
  try {
    const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT ${SELECT_FIELDS}
      FROM "RhythmSession"
      WHERE "userId" = ${userId} AND "endedAt" IS NULL
      ORDER BY "startedAt" DESC
    `);
    for (const row of rows) {
      const record = toRecord(row);
      if (!byType.has(record.type)) byType.set(record.type, record);
    }
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error("[rhythms] listActiveRhythms failed", error);
    }
  }
  return byType;
}

/** Recent sessions across all types, newest first (for grouping per card). */
export async function listRecentRhythms(
  userId: string,
  options: { limit?: number; sinceKey?: string } = {},
): Promise<RhythmSessionRecord[]> {
  requireCan(userId, "rhythm", "read");
  try {
    const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT ${SELECT_FIELDS}
      FROM "RhythmSession"
      WHERE "userId" = ${userId}
        AND (${options.sinceKey ?? null}::date IS NULL OR "startedAt" >= ${options.sinceKey ?? null}::date)
      ORDER BY "startedAt" DESC
      LIMIT ${options.limit ?? 120}
    `);
    return rows.map(toRecord);
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error("[rhythms] listRecentRhythms failed", error);
    }
    return [];
  }
}

/** Start a new rhythm session. Closes any stale active one of the same type. */
export async function startRhythm(
  userId: string,
  type: RhythmType,
  notes?: string | null,
): Promise<RhythmSessionRecord | null> {
  requireCan(userId, "rhythm", "write");
  const id = randomUUID();
  const trimmedNotes = notes?.trim() || null;
  try {
    // Avoid orphaning a forgotten running session of the same type.
    const existing = await getActiveRhythm(userId, type);
    if (existing) {
      await endRhythm(userId, existing.id);
    }
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "RhythmSession" (
        "id", "userId", "type", "startedAt", "notes", "createdAt"
      ) VALUES (
        ${id}, ${userId}, ${type}, now(), ${trimmedNotes}, now()
      )
    `);
  } catch (error) {
    if (isMissingTableError(error)) {
      throw new Error(
        "The rhythms table isn't migrated yet — apply scripts/create-rhythm-table.sql first.",
      );
    }
    throw error;
  }
  await recordEvent({
    userId,
    tool: "rhythm",
    type: "rhythm.started",
    refId: id,
    meta: { rhythm: type },
  });
  return {
    id,
    type,
    startedAt: new Date(),
    endedAt: null,
    durationMinutes: null,
    notes: trimmedNotes,
  };
}

/** End a running session, computing duration in JS (never DB date math). */
export async function endRhythm(
  userId: string,
  sessionId: string,
  notes?: string | null,
): Promise<RhythmSessionRecord | null> {
  requireCan(userId, "rhythm", "write");
  let record: RhythmSessionRecord | null = null;
  try {
    const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT ${SELECT_FIELDS}
      FROM "RhythmSession"
      WHERE "userId" = ${userId} AND "id" = ${sessionId} AND "endedAt" IS NULL
      LIMIT 1
    `);
    if (!rows[0]) return null;
    const endedAt = new Date();
    const duration = rhythmDurationMinutes(rows[0].startedAt, endedAt);
    const trimmedNotes = notes?.trim();
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "RhythmSession"
      SET "endedAt" = ${endedAt},
          "durationMinutes" = ${duration},
          "notes" = COALESCE(${trimmedNotes ?? null}, "notes")
      WHERE "userId" = ${userId} AND "id" = ${sessionId}
    `);
    record = {
      ...toRecord(rows[0]),
      endedAt,
      durationMinutes: duration,
      notes: trimmedNotes || rows[0].notes,
    };
  } catch (error) {
    if (isMissingTableError(error)) {
      throw new Error(
        "The rhythms table isn't migrated yet — apply scripts/create-rhythm-table.sql first.",
      );
    }
    throw error;
  }
  await recordEvent({
    userId,
    tool: "rhythm",
    type: "rhythm.ended",
    refId: sessionId,
    meta: { rhythm: record.type, durationMinutes: record.durationMinutes },
  });
  return record;
}
