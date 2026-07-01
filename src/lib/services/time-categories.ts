// Service layer for user-manageable time categories.
//
// Like reflect/rhythms/projects, the TimeCategory table is created via raw SQL
// (`ensureTimeCategoryTable`) rather than `prisma migrate` — the generated
// client predates this model, so all access here goes through $queryRaw /
// $executeRaw. Reads degrade to the hardcoded presets so the time tracker keeps
// working before the table exists; writes surface a clear "not ready" error.
//
// The stored category *value* on a TimeEntry stays the normalized name (e.g.
// "work", "deep focus"), so `categoryColor`/`categoryLabel` (pure helpers) keep
// resolving preset colors. Custom categories carry their own color/emoji here,
// which the time page threads into the picker and entry list.

import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { recordEvent } from "@/lib/services/events";
import { PRESET_TIME_CATEGORIES, categoryColor } from "@/lib/time-categories";

export type TimeCategoryRecord = {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
  isHidden: boolean;
  sortOrder: number;
};

type Row = {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
  isHidden: boolean;
  sortOrder: number;
};

/**
 * True when the TimeCategory table hasn't been created yet. Matches error CODES
 * first (the pg adapter rewrites 42P01 → Prisma P2021); message text only as a
 * fallback — see docs/lessons.md #3.
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
      (error.message.includes("TimeCategory") &&
        error.message.includes("does not exist")))
  );
}

let tableReady: Promise<void> | null = null;

/**
 * Idempotently create the TimeCategory table + index. Memoized per process; a
 * failure resets the memo so a cold-start DB blip retries instead of poisoning
 * the process (same shape as ensureProjectBoardTables).
 */
export function ensureTimeCategoryTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await prisma.$executeRawUnsafe(
        'CREATE TABLE IF NOT EXISTS "TimeCategory" (' +
          '"id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(), ' +
          '"userId" TEXT NOT NULL, ' +
          '"name" TEXT NOT NULL, ' +
          "\"color\" TEXT NOT NULL DEFAULT '#6366f1', " +
          '"emoji" TEXT, ' +
          '"isHidden" BOOLEAN NOT NULL DEFAULT false, ' +
          '"sortOrder" INTEGER NOT NULL DEFAULT 0, ' +
          '"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now());',
      );
      await prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "TimeCategory_userId_sortOrder_idx" ON "TimeCategory" ("userId", "sortOrder");',
      );
    })()
      .then(() => undefined)
      .catch((error) => {
        tableReady = null;
        console.error("[time-categories] ensureTimeCategoryTable failed", error);
      });
  }
  return tableReady;
}

/**
 * One-time seed of the user's defaults from the hardcoded preset list. Only
 * runs when the user has no categories yet — so it never clobbers edits.
 */
async function seedDefaultsIfEmpty(userId: string): Promise<void> {
  const existing = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS "count" FROM "TimeCategory" WHERE "userId" = ${userId}
  `);
  if ((existing[0]?.count ?? 0) > 0) return;
  for (let index = 0; index < PRESET_TIME_CATEGORIES.length; index += 1) {
    const preset = PRESET_TIME_CATEGORIES[index]!;
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "TimeCategory" ("id", "userId", "name", "color", "emoji", "isHidden", "sortOrder", "createdAt")
      VALUES (${randomUUID()}, ${userId}, ${preset.label}, ${preset.color}, ${null}, false, ${index}, now())
    `);
  }
}

/**
 * The user's categories, ordered by sortOrder. Seeds defaults on first call.
 * Degrades to the hardcoded presets if the table is missing, so the picker
 * always has something to show.
 */
export async function listTimeCategories(
  userId: string,
  options: { includeHidden?: boolean } = {},
): Promise<TimeCategoryRecord[]> {
  requireCan(userId, "time", "read");
  try {
    await ensureTimeCategoryTable();
    await seedDefaultsIfEmpty(userId);
    const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT "id", "name", "color", "emoji", "isHidden", "sortOrder"
      FROM "TimeCategory"
      WHERE "userId" = ${userId}
        AND (${options.includeHidden ?? false} OR "isHidden" = false)
      ORDER BY "sortOrder" ASC, "name" ASC
    `);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      emoji: row.emoji,
      isHidden: row.isHidden,
      sortOrder: row.sortOrder,
    }));
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error("[time-categories] listTimeCategories failed", error);
    }
    // Fallback to presets so the tracker stays usable.
    return PRESET_TIME_CATEGORIES.map((preset, index) => ({
      id: preset.id,
      name: preset.label,
      color: preset.color,
      emoji: null,
      isHidden: false,
      sortOrder: index,
    }));
  }
}

function notReady(): never {
  throw new Error(
    "Categories aren't ready yet — reload the Time page and try again.",
  );
}

export async function createTimeCategory(
  userId: string,
  input: { name: string; color?: string | null; emoji?: string | null },
): Promise<TimeCategoryRecord> {
  requireCan(userId, "time", "write");
  const name = input.name.trim();
  if (!name) throw new Error("Category name is required.");
  // Default the color to the stable hash color for the name so the list dot
  // (which resolves through categoryColor) matches the picker out of the box.
  const color = input.color?.trim() || categoryColor(name);
  const emoji = input.emoji?.trim() || null;
  const id = randomUUID();
  try {
    await ensureTimeCategoryTable();
    const next = await prisma.$queryRaw<Array<{ next: number }>>(Prisma.sql`
      SELECT COALESCE(MAX("sortOrder"), -1) + 1 AS "next"
      FROM "TimeCategory" WHERE "userId" = ${userId}
    `);
    const sortOrder = next[0]?.next ?? 0;
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "TimeCategory" ("id", "userId", "name", "color", "emoji", "isHidden", "sortOrder", "createdAt")
      VALUES (${id}, ${userId}, ${name}, ${color}, ${emoji}, false, ${sortOrder}, now())
    `);
    await recordEvent({
      userId,
      tool: "time",
      type: "time.category_created",
      refId: id,
      meta: { name },
    });
    return { id, name, color, emoji, isHidden: false, sortOrder };
  } catch (error) {
    if (isMissingTableError(error)) notReady();
    throw error;
  }
}

export async function updateTimeCategory(
  userId: string,
  id: string,
  patch: {
    name?: string;
    color?: string;
    emoji?: string | null;
    isHidden?: boolean;
  },
): Promise<void> {
  requireCan(userId, "time", "write");
  const name = patch.name?.trim();
  const color = patch.color?.trim();
  // emoji: a provided non-empty value sets it; null/undefined leaves it. (The
  // manage UI only edits color/visibility/order, so this stays COALESCE-simple
  // to avoid null-typed parameter pitfalls in raw SQL.)
  const emoji = patch.emoji?.trim() || null;
  try {
    await ensureTimeCategoryTable();
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "TimeCategory" SET
        "name" = COALESCE(${name ?? null}, "name"),
        "color" = COALESCE(${color ?? null}, "color"),
        "emoji" = COALESCE(${emoji}, "emoji"),
        "isHidden" = COALESCE(${patch.isHidden ?? null}, "isHidden")
      WHERE "id" = ${id} AND "userId" = ${userId}
    `);
    await recordEvent({
      userId,
      tool: "time",
      type: "time.category_updated",
      refId: id,
    });
  } catch (error) {
    if (isMissingTableError(error)) notReady();
    throw error;
  }
}

/** Persist a new display order (drag / up-down arrows in the manage sheet). */
export async function reorderTimeCategories(
  userId: string,
  orderedIds: string[],
): Promise<void> {
  requireCan(userId, "time", "write");
  try {
    await ensureTimeCategoryTable();
    for (let index = 0; index < orderedIds.length; index += 1) {
      const categoryId = orderedIds[index];
      if (!categoryId) continue;
      await prisma.$executeRaw(Prisma.sql`
        UPDATE "TimeCategory" SET "sortOrder" = ${index}
        WHERE "id" = ${categoryId} AND "userId" = ${userId}
      `);
    }
  } catch (error) {
    if (isMissingTableError(error)) notReady();
    throw error;
  }
}
