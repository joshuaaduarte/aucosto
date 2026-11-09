// Per-habit preferences (Apple Health measure, Focus/Later, "after…" cue)
// in the raw-SQL HabitPreference table (scripts/create-habit-preferences.sql).
// Reads degrade to empty while the table is missing; writes say what's needed.

import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { recordEvent } from "@/lib/services/events";
import { healthQuantity, isHealthMetric, type HealthDay, type HealthMetric } from "@/lib/health-habits";

export type HabitFocus = "focus" | "later";

export type HabitPreferenceRow = {
  habitId: string;
  healthMetric: HealthMetric | null;
  focus: HabitFocus | null;
  cue: string | null;
};

export const HEALTH_NOTE = "Apple Health";

export class HabitPreferencesUnavailableError extends Error {
  constructor() {
    super("Habit settings need one database step first (scripts/create-habit-preferences.sql).");
  }
}

function isMissingTable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021") return true;
    if (error.code === "P2010") return JSON.stringify(error.meta ?? {}).includes("42P01");
  }
  return error instanceof Error && error.message.includes("42P01");
}

/** habitId → preferences. Empty map when the table isn't there yet. */
export async function listHabitPreferences(
  userId: string,
): Promise<Map<string, HabitPreferenceRow>> {
  requireCan(userId, "habit", "read");
  try {
    const rows = await prisma.$queryRaw<
      Array<{ habitId: string; healthMetric: string | null; focus: string | null; cue: string | null }>
    >(Prisma.sql`
      SELECT "habitId", "healthMetric", "focus", "cue"
      FROM "HabitPreference"
      WHERE "userId" = ${userId}
    `);
    return new Map(
      rows.map((row) => [
        row.habitId,
        {
          habitId: row.habitId,
          healthMetric: isHealthMetric(row.healthMetric) ? row.healthMetric : null,
          focus: row.focus === "focus" || row.focus === "later" ? row.focus : null,
          cue: row.cue,
        },
      ]),
    );
  } catch (error) {
    if (!isMissingTable(error)) console.error("[habits] preferences read failed", error);
    return new Map();
  }
}

/** True once the HabitPreference table exists. */
export async function habitPreferencesReady(userId: string): Promise<boolean> {
  requireCan(userId, "habit", "read");
  try {
    await prisma.$queryRaw(Prisma.sql`SELECT 1 FROM "HabitPreference" LIMIT 1`);
    return true;
  } catch {
    return false;
  }
}

/** Upsert any subset of a habit's preferences. `undefined` leaves a field alone. */
export async function setHabitPreference(
  userId: string,
  habitId: string,
  patch: { healthMetric?: HealthMetric | null; focus?: HabitFocus | null; cue?: string | null },
): Promise<void> {
  requireCan(userId, "habit", "write");
  const habit = await prisma.habit.findFirst({ where: { id: habitId, userId }, select: { id: true } });
  if (!habit) throw new Error("Habit not found.");
  const cue = patch.cue === undefined ? undefined : patch.cue?.trim().slice(0, 80) || null;
  try {
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "HabitPreference" ("habitId", "userId", "healthMetric", "focus", "cue", "updatedAt")
      VALUES (${habitId}, ${userId}, ${patch.healthMetric ?? null}, ${patch.focus ?? null}, ${cue ?? null}, NOW())
      ON CONFLICT ("habitId") DO UPDATE SET
        "healthMetric" = CASE WHEN ${patch.healthMetric !== undefined}::boolean THEN EXCLUDED."healthMetric" ELSE "HabitPreference"."healthMetric" END,
        "focus" = CASE WHEN ${patch.focus !== undefined}::boolean THEN EXCLUDED."focus" ELSE "HabitPreference"."focus" END,
        "cue" = CASE WHEN ${cue !== undefined}::boolean THEN EXCLUDED."cue" ELSE "HabitPreference"."cue" END,
        "updatedAt" = NOW()
    `);
  } catch (error) {
    if (isMissingTable(error)) throw new HabitPreferencesUnavailableError();
    throw error;
  }
}

function dayBounds(dateKey: string) {
  const start = new Date(`${dateKey}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/**
 * Apply one day of Apple Health numbers to every linked habit. Idempotent:
 * the Shortcut sends running daily totals several times a day, so each run
 * replaces that day's earlier "Apple Health" entry instead of adding to it.
 * Returns what changed, for the Shortcut's response.
 */
export async function applyHealthDay(
  userId: string,
  dateKey: string,
  day: HealthDay,
  now: Date = new Date(),
): Promise<Array<{ habit: string; quantity: number }>> {
  requireCan(userId, "habit", "write");
  const prefs = await listHabitPreferences(userId);
  const linked = [...prefs.values()].filter((pref) => pref.healthMetric);
  if (linked.length === 0) return [];
  const habits = await prisma.habit.findMany({
    where: { userId, archivedAt: null, id: { in: linked.map((pref) => pref.habitId) } },
    select: { id: true, title: true, goalUnit: true },
  });
  const { start, end } = dayBounds(dateKey);
  const loggedAt = now >= start && now < end ? now : new Date(start.getTime() + 12 * 3600_000);
  const applied: Array<{ habit: string; quantity: number }> = [];

  for (const habit of habits) {
    const metric = prefs.get(habit.id)?.healthMetric;
    if (!metric) continue;
    const quantity = healthQuantity(metric, day, habit);
    if (quantity === null) continue;
    await prisma.$transaction([
      prisma.habitEntry.deleteMany({
        where: { userId, habitId: habit.id, notes: HEALTH_NOTE, loggedAt: { gte: start, lt: end } },
      }),
      ...(quantity > 0
        ? [
            prisma.habitEntry.create({
              data: { userId, habitId: habit.id, mode: "full", quantity, notes: HEALTH_NOTE, loggedAt },
            }),
          ]
        : []),
    ]);
    applied.push({ habit: habit.title, quantity });
  }

  if (applied.length > 0) {
    await recordEvent({
      userId,
      tool: "habit",
      type: "habit.health_synced",
      meta: { dateKey, habits: applied.length },
    });
  }
  return applied;
}
