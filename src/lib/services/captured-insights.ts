import "server-only";

import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { recordEvent } from "@/lib/services/events";

export interface CapturedInsight {
  id: string;
  userId: string;
  sourceTool: string;
  sourceRecordId: string;
  sourceField: string | null;
  occurredAt: string;
  text: string;
  kind: string;
  status: string;
  createdAt: string;
  linkedPersonIds: string[];
}

type InsightRow = {
  id: string;
  userId: string;
  sourceTool: string;
  sourceRecordId: string;
  sourceField: string | null;
  occurredAt: Date;
  text: string;
  kind: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

type PersonLinkRow = {
  insightId: string;
  personId: string;
};

function isoString(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function rowToInsight(row: InsightRow, personIds: string[] = []): CapturedInsight {
  return {
    id: row.id,
    userId: row.userId,
    sourceTool: row.sourceTool,
    sourceRecordId: row.sourceRecordId,
    sourceField: row.sourceField,
    occurredAt: isoString(row.occurredAt) ?? "",
    text: row.text,
    kind: row.kind,
    status: row.status,
    createdAt: isoString(row.createdAt) ?? "",
    linkedPersonIds: personIds,
  };
}

let insightTablesReady: Promise<void> | null = null;

export function ensureInsightTables(): Promise<void> {
  if (!insightTablesReady) {
    insightTablesReady = _createInsightTables();
  }
  return insightTablesReady;
}

async function _createInsightTables(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CapturedInsight" (
        "id"             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "userId"         TEXT NOT NULL,
        "sourceTool"     TEXT NOT NULL,
        "sourceRecordId" TEXT NOT NULL,
        "sourceField"    TEXT,
        "occurredAt"     TIMESTAMPTZ NOT NULL,
        "text"           TEXT NOT NULL,
        "kind"           TEXT NOT NULL DEFAULT 'insight',
        "status"         TEXT NOT NULL DEFAULT 'active',
        "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CapturedInsightPerson" (
        "id"        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "userId"    TEXT NOT NULL,
        "insightId" TEXT NOT NULL REFERENCES "CapturedInsight"("id") ON DELETE CASCADE,
        "personId"  TEXT NOT NULL,
        UNIQUE("insightId", "personId")
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "CapturedInsight_userId_idx"
        ON "CapturedInsight"("userId")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "CapturedInsight_userId_occurredAt_idx"
        ON "CapturedInsight"("userId", "occurredAt" DESC)
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "CapturedInsight_source_idx"
        ON "CapturedInsight"("userId", "sourceTool", "sourceRecordId")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "CapturedInsightPerson_userId_personId_idx"
        ON "CapturedInsightPerson"("userId", "personId")
    `);
  } catch (error) {
    insightTablesReady = null;
    console.error("[captured-insights] ensureInsightTables failed", error);
    throw error;
  }
}

export async function deleteInsightsForSource(
  userId: string,
  sourceTool: string,
  sourceRecordId: string,
  sourceField: string | null,
): Promise<void> {
  requireCan(userId, "insight", "write");
  if (sourceField) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "CapturedInsight"
       WHERE "userId" = $1 AND "sourceTool" = $2 AND "sourceRecordId" = $3 AND "sourceField" = $4`,
      userId,
      sourceTool,
      sourceRecordId,
      sourceField,
    );
  } else {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "CapturedInsight"
       WHERE "userId" = $1 AND "sourceTool" = $2 AND "sourceRecordId" = $3 AND "sourceField" IS NULL`,
      userId,
      sourceTool,
      sourceRecordId,
    );
  }
}

export async function createInsight(data: {
  userId: string;
  sourceTool: string;
  sourceRecordId: string;
  sourceField: string | null;
  occurredAt: Date;
  text: string;
  kind?: string;
}): Promise<CapturedInsight> {
  requireCan(data.userId, "insight", "write");
  const rows = await prisma.$queryRawUnsafe<InsightRow[]>(
    `INSERT INTO "CapturedInsight" (
       "userId", "sourceTool", "sourceRecordId", "sourceField",
       "occurredAt", "text", "kind"
     ) VALUES ($1, $2, $3, $4, $5::timestamptz, $6, $7)
     RETURNING *`,
    data.userId,
    data.sourceTool,
    data.sourceRecordId,
    data.sourceField,
    data.occurredAt.toISOString(),
    data.text,
    data.kind ?? "insight",
  );
  const row = rows[0]!;
  await recordEvent({
    userId: data.userId,
    tool: "insight",
    type: "insight.captured",
    refId: row.id,
    meta: { text: data.text.slice(0, 100) },
  });
  return rowToInsight(row);
}

export async function linkInsightToPerson(
  userId: string,
  insightId: string,
  personId: string,
): Promise<void> {
  requireCan(userId, "insight", "write");
  await prisma.$executeRawUnsafe(
    `INSERT INTO "CapturedInsightPerson" ("userId", "insightId", "personId")
     VALUES ($1, $2, $3)
     ON CONFLICT ("insightId", "personId") DO NOTHING`,
    userId,
    insightId,
    personId,
  );
}

export async function unlinkInsightFromPerson(
  userId: string,
  insightId: string,
  personId: string,
): Promise<void> {
  requireCan(userId, "insight", "write");
  await prisma.$executeRawUnsafe(
    `DELETE FROM "CapturedInsightPerson"
     WHERE "userId" = $1 AND "insightId" = $2 AND "personId" = $3`,
    userId,
    insightId,
    personId,
  );
}

export async function listInsightsForSource(
  userId: string,
  sourceTool: string,
  sourceRecordId: string,
): Promise<CapturedInsight[]> {
  requireCan(userId, "insight", "read");
  try {
    const rows = await prisma.$queryRawUnsafe<InsightRow[]>(
      `SELECT * FROM "CapturedInsight"
       WHERE "userId" = $1 AND "sourceTool" = $2 AND "sourceRecordId" = $3
       ORDER BY "occurredAt" DESC`,
      userId,
      sourceTool,
      sourceRecordId,
    );
    const insightIds = rows.map((r) => r.id);
    const personLinks = insightIds.length > 0
      ? await prisma.$queryRawUnsafe<PersonLinkRow[]>(
          `SELECT "insightId", "personId" FROM "CapturedInsightPerson"
           WHERE "insightId" = ANY($1::text[])`,
          insightIds,
        )
      : [];
    const linkMap = new Map<string, string[]>();
    for (const link of personLinks) {
      const arr = linkMap.get(link.insightId) ?? [];
      arr.push(link.personId);
      linkMap.set(link.insightId, arr);
    }
    return rows.map((r) => rowToInsight(r, linkMap.get(r.id) ?? []));
  } catch (error) {
    console.error("[captured-insights] listInsightsForSource failed", error);
    return [];
  }
}

export async function listInsightsForPerson(
  userId: string,
  personId: string,
  opts?: { limit?: number },
): Promise<CapturedInsight[]> {
  requireCan(userId, "insight", "read");
  const limit = opts?.limit ?? 20;
  try {
    const rows = await prisma.$queryRawUnsafe<InsightRow[]>(
      `SELECT ci.* FROM "CapturedInsight" ci
       JOIN "CapturedInsightPerson" cip ON cip."insightId" = ci."id"
       WHERE ci."userId" = $1 AND cip."personId" = $2 AND ci."status" = 'active'
       ORDER BY ci."occurredAt" DESC
       LIMIT $3`,
      userId,
      personId,
      limit,
    );
    return rows.map((r) => rowToInsight(r, [personId]));
  } catch (error) {
    console.error("[captured-insights] listInsightsForPerson failed", error);
    return [];
  }
}

export async function listRecentInsights(
  userId: string,
  opts?: { limit?: number; since?: Date },
): Promise<CapturedInsight[]> {
  requireCan(userId, "insight", "read");
  const limit = opts?.limit ?? 10;
  try {
    let rows: InsightRow[];
    if (opts?.since) {
      rows = await prisma.$queryRawUnsafe<InsightRow[]>(
        `SELECT * FROM "CapturedInsight"
         WHERE "userId" = $1 AND "status" = 'active' AND "occurredAt" >= $2::timestamptz
         ORDER BY "occurredAt" DESC
         LIMIT $3`,
        userId,
        opts.since.toISOString(),
        limit,
      );
    } else {
      rows = await prisma.$queryRawUnsafe<InsightRow[]>(
        `SELECT * FROM "CapturedInsight"
         WHERE "userId" = $1 AND "status" = 'active'
         ORDER BY "occurredAt" DESC
         LIMIT $2`,
        userId,
        limit,
      );
    }
    const insightIds = rows.map((r) => r.id);
    const personLinks = insightIds.length > 0
      ? await prisma.$queryRawUnsafe<PersonLinkRow[]>(
          `SELECT "insightId", "personId" FROM "CapturedInsightPerson"
           WHERE "insightId" = ANY($1::text[])`,
          insightIds,
        )
      : [];
    const linkMap = new Map<string, string[]>();
    for (const link of personLinks) {
      const arr = linkMap.get(link.insightId) ?? [];
      arr.push(link.personId);
      linkMap.set(link.insightId, arr);
    }
    return rows.map((r) => rowToInsight(r, linkMap.get(r.id) ?? []));
  } catch (error) {
    console.error("[captured-insights] listRecentInsights failed", error);
    return [];
  }
}
