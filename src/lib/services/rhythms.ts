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
import { startOfToday } from "@/lib/time";
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

/**
 * Backfill an already-completed session with explicit start/end timestamps
 * (e.g. a forgotten sleep log). Duration is computed in JS — never DB date
 * math. Both timestamps are passed as JS Dates and bound as params.
 */
export async function logRhythmSession(
  userId: string,
  type: RhythmType,
  startedAt: Date,
  endedAt: Date,
  notes?: string | null,
): Promise<RhythmSessionRecord | null> {
  requireCan(userId, "rhythm", "write");
  const id = randomUUID();
  const trimmedNotes = notes?.trim() || null;
  // Guard against inverted ranges: clamp so the session is never negative.
  const start = startedAt.getTime() <= endedAt.getTime() ? startedAt : endedAt;
  const end = startedAt.getTime() <= endedAt.getTime() ? endedAt : startedAt;
  const duration = rhythmDurationMinutes(start, end);
  try {
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "RhythmSession" (
        "id", "userId", "type", "startedAt", "endedAt",
        "durationMinutes", "notes", "createdAt"
      ) VALUES (
        ${id}, ${userId}, ${type}, ${start}, ${end},
        ${duration}, ${trimmedNotes}, now()
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
    type: "rhythm.ended",
    refId: id,
    meta: { rhythm: type, durationMinutes: duration, backfilled: true },
  });
  return {
    id,
    type,
    startedAt: start,
    endedAt: end,
    durationMinutes: duration,
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

// ── Morning check-in ──────────────────────────────────────────────
//
// The hub's morning card is the whole "wake-up" flow now (there's no
// dedicated page). One `wakeup` RhythmSession per day carries the morning:
// `metadata.wakeTime` ("HH:mm" as the visitor typed it) and a derived
// `metadata.sleepMinutes`. It's started when you log your wake time and
// ended ("completed") when you tap "Done with morning". "Today" uses the
// server's pinned LA day boundary (startOfToday) — single-user app.

export type MorningStatus = {
  /** The wakeup session's id (for direct updates). */
  id: string;
  /** "HH:mm" the user reported waking, or null if not captured. */
  wakeTime: string | null;
  startedAt: Date;
  /** endedAt is set → the morning was explicitly wrapped up. */
  completed: boolean;
  /** Sleep duration carried over from last night, when known. */
  sleepMinutes: number | null;
};

type MetaRow = Row & { metadata: unknown };

function readMorningMeta(metadata: unknown): {
  wakeTime: string | null;
  sleepMinutes: number | null;
} {
  const meta = (metadata ?? {}) as {
    wakeTime?: unknown;
    sleepMinutes?: unknown;
  };
  return {
    wakeTime: typeof meta.wakeTime === "string" ? meta.wakeTime : null,
    sleepMinutes:
      typeof meta.sleepMinutes === "number" ? meta.sleepMinutes : null,
  };
}

/** Today's morning (wakeup) session, or null before the day's first check-in. */
export async function getTodayMorning(
  userId: string,
): Promise<MorningStatus | null> {
  requireCan(userId, "rhythm", "read");
  try {
    const rows = await prisma.$queryRaw<MetaRow[]>(Prisma.sql`
      SELECT ${SELECT_FIELDS}, "metadata"
      FROM "RhythmSession"
      WHERE "userId" = ${userId}
        AND "type" = 'wakeup'
        AND "startedAt" >= ${startOfToday()}
      ORDER BY "startedAt" DESC
      LIMIT 1
    `);
    const row = rows[0];
    if (!row) return null;
    const meta = readMorningMeta(row.metadata);
    return {
      id: row.id,
      wakeTime: meta.wakeTime,
      startedAt: row.startedAt,
      completed: row.endedAt !== null,
      sleepMinutes: meta.sleepMinutes,
    };
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error("[rhythms] getTodayMorning failed", error);
    }
    return null;
  }
}

/**
 * Resolve last night's sleep into a duration. A sleep session started since
 * ~6pm yesterday is either still running (tapped "going to bed" and never
 * closed → close it at wake time = now) or already backfilled (read its
 * stored duration). Degrades to null if the table's missing.
 */
async function resolveLastNightSleepMinutes(
  userId: string,
): Promise<number | null> {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - 1);
  windowStart.setHours(18, 0, 0, 0);
  try {
    const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT ${SELECT_FIELDS}
      FROM "RhythmSession"
      WHERE "userId" = ${userId}
        AND "type" = 'sleep'
        AND "startedAt" >= ${windowStart}
      ORDER BY "startedAt" DESC
      LIMIT 1
    `);
    const row = rows[0];
    if (!row) return null;
    if (row.endedAt) return row.durationMinutes;
    const ended = await endRhythm(userId, row.id);
    return ended?.durationMinutes ?? null;
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error("[rhythms] resolveLastNightSleepMinutes failed", error);
    }
    return null;
  }
}

/**
 * Log (or update) today's wake time and start the morning. Closes any open
 * sleep session and carries its duration into metadata. Idempotent: a second
 * call just refreshes the wake time. Returns the resolved sleep duration so
 * the card can show "You slept ~7h 20m".
 */
export async function startMorning(
  userId: string,
  wakeTime: string | null,
): Promise<{ sleepMinutes: number | null }> {
  requireCan(userId, "rhythm", "write");
  const cleanWake =
    typeof wakeTime === "string" && /^\d{1,2}:\d{2}$/.test(wakeTime.trim())
      ? wakeTime.trim()
      : null;

  const existing = await getTodayMorning(userId);
  const sleepMinutes =
    existing?.sleepMinutes ?? (await resolveLastNightSleepMinutes(userId));
  const metaJson = JSON.stringify({ wakeTime: cleanWake, sleepMinutes });

  try {
    if (existing) {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE "RhythmSession"
        SET "metadata" = ${metaJson}::jsonb
        WHERE "userId" = ${userId} AND "id" = ${existing.id}
      `);
    } else {
      const id = randomUUID();
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "RhythmSession" (
          "id", "userId", "type", "startedAt", "metadata", "createdAt"
        ) VALUES (
          ${id}, ${userId}, 'wakeup', now(), ${metaJson}::jsonb, now()
        )
      `);
      await recordEvent({
        userId,
        tool: "rhythm",
        type: "rhythm.started",
        refId: id,
        meta: { rhythm: "wakeup", wakeTime: cleanWake },
      });
    }
  } catch (error) {
    if (isMissingTableError(error)) {
      throw new Error(
        "The rhythms table isn't migrated yet — apply scripts/create-rhythm-table.sql first.",
      );
    }
    throw error;
  }
  return { sleepMinutes };
}

/** Wrap up today's morning (sets endedAt → the hub card dismisses itself). */
export async function completeMorning(userId: string): Promise<void> {
  requireCan(userId, "rhythm", "write");
  try {
    const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT ${SELECT_FIELDS}
      FROM "RhythmSession"
      WHERE "userId" = ${userId}
        AND "type" = 'wakeup'
        AND "startedAt" >= ${startOfToday()}
        AND "endedAt" IS NULL
      ORDER BY "startedAt" DESC
      LIMIT 1
    `);
    if (rows[0]) await endRhythm(userId, rows[0].id);
  } catch (error) {
    if (isMissingTableError(error)) return;
    throw error;
  }
}

export type SleepSessionRecord = {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  durationMinutes: number | null;
  /** "HH:mm" the user reported waking (metadata), useful when endedAt is null. */
  wakeTime: string | null;
};

/**
 * Sleep sessions overlapping [from, to) — the time tracker list renders these
 * as read-only bedtime / wake-up markers. Includes `metadata.wakeTime` so a
 * still-open session can show a known wake time before it's formally ended.
 * An open session is treated as running up to now() for the overlap test.
 */
export async function listSleepSessions(
  userId: string,
  range: { from: Date; to: Date },
): Promise<SleepSessionRecord[]> {
  requireCan(userId, "rhythm", "read");
  try {
    const rows = await prisma.$queryRaw<MetaRow[]>(Prisma.sql`
      SELECT ${SELECT_FIELDS}, "metadata"
      FROM "RhythmSession"
      WHERE "userId" = ${userId}
        AND "type" = 'sleep'
        AND "startedAt" < ${range.to}
        AND COALESCE("endedAt", now()) > ${range.from}
      ORDER BY "startedAt" ASC
    `);
    return rows.map((row) => ({
      id: row.id,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      durationMinutes: row.durationMinutes,
      wakeTime: readMorningMeta(row.metadata).wakeTime,
    }));
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error("[rhythms] listSleepSessions failed", error);
    }
    return [];
  }
}

/**
 * Sleep + wakeup sessions overlapping [from, to) — the calendar renders these
 * as soft, read-only context blocks beside tracked time. An open session is
 * treated as running up to now() for the overlap test.
 */
export async function listRhythmSessionsBetween(
  userId: string,
  range: { from: Date; to: Date },
): Promise<RhythmSessionRecord[]> {
  requireCan(userId, "rhythm", "read");
  try {
    const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT ${SELECT_FIELDS}
      FROM "RhythmSession"
      WHERE "userId" = ${userId}
        AND "type" IN ('sleep', 'wakeup')
        AND "startedAt" < ${range.to}
        AND COALESCE("endedAt", now()) > ${range.from}
      ORDER BY "startedAt" ASC
    `);
    return rows.map(toRecord);
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error("[rhythms] listRhythmSessionsBetween failed", error);
    }
    return [];
  }
}
