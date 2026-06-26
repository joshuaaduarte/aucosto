import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { recordEvent } from "@/lib/services/events";

// ── Types ─────────────────────────────────────────────────────────────────

export interface ContactField {
  label: string;
  value: string;
}

export interface SocialLink {
  platform: string;
  handle: string;
  url?: string;
}

export interface LabeledDate {
  label: string;
  date: string;
}

export interface RolodexPersonSummary {
  id: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  aliases: string[];
  contactKind: string;
  relationshipType: string | null;
  organization: string | null;
  birthday: string | null;
  createdAt: string;
  lastInteractionAt: string | null;
}

export interface RolodexPersonDetail extends RolodexPersonSummary {
  emails: ContactField[];
  phones: ContactField[];
  addresses: ContactField[];
  socials: SocialLink[];
  importantDates: LabeledDate[];
  notes: string | null;
  preferences: string | null;
  giftIdeas: string[];
  communicationNotes: string | null;
  collaborationNotes: string | null;
  sensitivities: string | null;
  interactions: RolodexInteraction[];
}

export interface RolodexInteraction {
  id: string;
  personId: string;
  sourceTool: string | null;
  sourceRecordId: string | null;
  occurredAt: string;
  title: string;
  body: string | null;
  followUpNeeded: boolean;
  followUpDate: string | null;
  createdAt: string;
}

export interface RolodexMention {
  id: string;
  mentionedName: string;
  personId: string | null;
  resolved: boolean;
  sourceTool: string;
  sourceRecordId: string;
  createdAt: string;
}

export interface CreatePersonInput {
  displayName: string;
  firstName?: string | null;
  lastName?: string | null;
  aliases?: string[];
  relationshipType?: string | null;
  organization?: string | null;
  role?: string | null;
  emails?: ContactField[];
  phones?: ContactField[];
  addresses?: ContactField[];
  socials?: SocialLink[];
  contactKind?: string;
  birthday?: string | null;
  importantDates?: LabeledDate[];
  notes?: string | null;
  preferences?: string | null;
  giftIdeas?: string[];
  communicationNotes?: string | null;
  collaborationNotes?: string | null;
  sensitivities?: string | null;
}

export interface AddInteractionInput {
  title: string;
  body?: string | null;
  occurredAt?: string | null;
  sourceTool?: string | null;
  sourceRecordId?: string | null;
  followUpNeeded?: boolean;
  followUpDate?: string | null;
}

export interface CreateMentionInput {
  mentionedName: string;
  sourceTool: string;
  sourceRecordId: string;
  sourceField?: string | null;
  personId?: string | null;
}

export interface BirthdaySummary {
  personId: string;
  displayName: string;
  birthday: string;
  daysUntil: number;
}

export interface FollowUpSummary {
  interactionId: string;
  personId: string;
  personName: string;
  title: string;
  followUpDate: string | null;
}

export interface RecentMentionSummary {
  personId: string | null;
  personName: string | null;
  mentionedName: string;
  resolved: boolean;
  sourceTool: string;
}

// ── JSON helpers ──────────────────────────────────────────────────────────

function parseJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function isoString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

// ── Ensure tables (raw SQL, memoized) ────────────────────────────────────

let rolodexTablesReady: Promise<void> | null = null;

export function ensureRolodexTables(): Promise<void> {
  if (!rolodexTablesReady) {
    rolodexTablesReady = _createRolodexTables();
  }
  return rolodexTablesReady;
}

async function _createRolodexTables(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "RolodexPerson" (
        "id"                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "userId"            TEXT NOT NULL,
        "displayName"       TEXT NOT NULL,
        "firstName"         TEXT,
        "lastName"          TEXT,
        "aliases"           TEXT,
        "relationshipType"  TEXT,
        "organization"      TEXT,
        "role"              TEXT,
        "emails"            TEXT,
        "phones"            TEXT,
        "addresses"         TEXT,
        "socials"           TEXT,
        "birthday"          TIMESTAMPTZ,
        "importantDates"    TEXT,
        "notes"             TEXT,
        "preferences"       TEXT,
        "giftIdeas"         TEXT,
        "communicationNotes" TEXT,
        "collaborationNotes" TEXT,
        "sensitivities"     TEXT,
        "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "RolodexPerson_userId_idx"
        ON "RolodexPerson" ("userId")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "RolodexPerson_userId_displayName_idx"
        ON "RolodexPerson" ("userId", "displayName")
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "RolodexPerson"
        ADD COLUMN IF NOT EXISTS "contactKind" TEXT NOT NULL DEFAULT 'person'
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "RolodexInteraction" (
        "id"             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "userId"         TEXT NOT NULL,
        "personId"       TEXT NOT NULL
                           REFERENCES "RolodexPerson"("id") ON DELETE CASCADE,
        "sourceTool"     TEXT,
        "sourceRecordId" TEXT,
        "occurredAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "title"          TEXT NOT NULL,
        "body"           TEXT,
        "followUpNeeded" BOOLEAN NOT NULL DEFAULT false,
        "followUpDate"   TIMESTAMPTZ,
        "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "RolodexInteraction_userId_idx"
        ON "RolodexInteraction" ("userId")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "RolodexInteraction_personId_occurredAt_idx"
        ON "RolodexInteraction" ("personId", "occurredAt" DESC)
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "RolodexMention" (
        "id"             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "userId"         TEXT NOT NULL,
        "personId"       TEXT REFERENCES "RolodexPerson"("id") ON DELETE SET NULL,
        "mentionedName"  TEXT NOT NULL,
        "resolved"       BOOLEAN NOT NULL DEFAULT false,
        "sourceTool"     TEXT NOT NULL,
        "sourceRecordId" TEXT NOT NULL,
        "sourceField"    TEXT,
        "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "RolodexMention_userId_idx"
        ON "RolodexMention" ("userId")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "RolodexMention_userId_resolved_idx"
        ON "RolodexMention" ("userId", "resolved")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "RolodexMention_personId_idx"
        ON "RolodexMention" ("personId")
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "RolodexMention"
        ADD COLUMN IF NOT EXISTS "dismissed" BOOLEAN NOT NULL DEFAULT FALSE
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "RolodexRelation" (
        "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text PRIMARY KEY,
        "userId"       TEXT NOT NULL,
        "fromEntityId" TEXT NOT NULL,
        "toEntityId"   TEXT NOT NULL,
        "type"         TEXT NOT NULL DEFAULT 'knows',
        "label"        TEXT,
        "notes"        TEXT,
        "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "RolodexRelation_userId_from_idx"
        ON "RolodexRelation"("userId", "fromEntityId")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "RolodexRelation_userId_to_idx"
        ON "RolodexRelation"("userId", "toEntityId")
    `);

    // Clean up any reserved-marker mentions that leaked through before the fix
    await _cleanupReservedMarkerMentions();
  } catch (error) {
    rolodexTablesReady = null;
    console.error("[rolodex] ensureRolodexTables failed", error);
    throw error;
  }
}

// ── Reserved-marker cleanup (runs once on table init) ────────────────────

async function _cleanupReservedMarkerMentions(): Promise<void> {
  try {
    const deleted = await prisma.$executeRawUnsafe(
      `DELETE FROM "RolodexMention"
       WHERE "resolvedPersonId" IS NULL
         AND (
           LOWER("mentionedName") = 'insight'
           OR LOWER("mentionedName") LIKE 'insight %'
         )`,
    );
    if (deleted > 0) {
      console.log(`[rolodex] cleaned up ${deleted} reserved-marker mention rows`);
    }
  } catch {
    // Column might not exist yet or table structure differs — safe to ignore
    try {
      const deleted2 = await prisma.$executeRawUnsafe(
        `DELETE FROM "RolodexMention"
         WHERE "personId" IS NULL
           AND "resolved" = false
           AND (
             LOWER("mentionedName") = 'insight'
             OR LOWER("mentionedName") LIKE 'insight %'
           )`,
      );
      if (deleted2 > 0) {
        console.log(`[rolodex] cleaned up ${deleted2} reserved-marker mention rows`);
      }
    } catch (e2) {
      console.error("[rolodex] reserved-marker cleanup failed", e2);
    }
  }
}

export async function listBogusReservedPersons(
  userId: string,
): Promise<Array<{ id: string; displayName: string }>> {
  requireCan(userId, "rolodex", "read");
  try {
    return await prisma.$queryRawUnsafe<Array<{ id: string; displayName: string }>>(
      `SELECT "id", "displayName" FROM "RolodexPerson"
       WHERE "userId" = $1
         AND (LOWER("displayName") = 'insight' OR LOWER("displayName") LIKE 'insight %')`,
      userId,
    );
  } catch {
    return [];
  }
}

// ── Row → type mappers ────────────────────────────────────────────────────

type PersonRow = {
  id: string;
  userId: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  aliases: string | null;
  relationshipType: string | null;
  organization: string | null;
  role: string | null;
  contactKind: string;
  emails: string | null;
  phones: string | null;
  addresses: string | null;
  socials: string | null;
  birthday: Date | null;
  importantDates: string | null;
  notes: string | null;
  preferences: string | null;
  giftIdeas: string | null;
  communicationNotes: string | null;
  collaborationNotes: string | null;
  sensitivities: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type InteractionRow = {
  id: string;
  userId: string;
  personId: string;
  sourceTool: string | null;
  sourceRecordId: string | null;
  occurredAt: Date;
  title: string;
  body: string | null;
  followUpNeeded: boolean;
  followUpDate: Date | null;
  createdAt: Date;
};

function rowToSummary(row: PersonRow & { lastInteractionAt?: Date | null }): RolodexPersonSummary {
  return {
    id: row.id,
    displayName: row.displayName,
    firstName: row.firstName,
    lastName: row.lastName,
    aliases: parseJsonArray<string>(row.aliases),
    contactKind: row.contactKind ?? "person",
    relationshipType: row.relationshipType,
    organization: row.organization,
    birthday: isoString(row.birthday),
    createdAt: isoString(row.createdAt) ?? "",
    lastInteractionAt: isoString(row.lastInteractionAt ?? null),
  };
}

function rowToDetail(row: PersonRow, interactions: RolodexInteraction[]): RolodexPersonDetail {
  return {
    ...rowToSummary(row),
    emails: parseJsonArray<ContactField>(row.emails),
    phones: parseJsonArray<ContactField>(row.phones),
    addresses: parseJsonArray<ContactField>(row.addresses),
    socials: parseJsonArray<SocialLink>(row.socials),
    importantDates: parseJsonArray<LabeledDate>(row.importantDates),
    notes: row.notes,
    preferences: row.preferences,
    giftIdeas: parseJsonArray<string>(row.giftIdeas),
    communicationNotes: row.communicationNotes,
    collaborationNotes: row.collaborationNotes,
    sensitivities: row.sensitivities,
    interactions,
  };
}

function rowToInteraction(row: InteractionRow): RolodexInteraction {
  return {
    id: row.id,
    personId: row.personId,
    sourceTool: row.sourceTool,
    sourceRecordId: row.sourceRecordId,
    occurredAt: isoString(row.occurredAt) ?? "",
    title: row.title,
    body: row.body,
    followUpNeeded: row.followUpNeeded,
    followUpDate: isoString(row.followUpDate),
    createdAt: isoString(row.createdAt) ?? "",
  };
}

// ── Person CRUD ───────────────────────────────────────────────────────────

export async function listPersons(
  userId: string,
  opts: { search?: string; relationshipType?: string; contactKind?: string } = {},
): Promise<RolodexPersonSummary[]> {
  requireCan(userId, "rolodex", "read");
  try {
    const rows = await prisma.$queryRawUnsafe<(PersonRow & { lastInteractionAt: Date | null })[]>(
      `SELECT p.id, p."userId", p."displayName", p."firstName", p."lastName", p.aliases,
              p."relationshipType", p.organization, p.role, p.birthday, p."createdAt", p."updatedAt",
              COALESCE(p."contactKind", 'person') AS "contactKind",
              NULL::text AS emails, NULL::text AS phones, NULL::text AS addresses,
              NULL::text AS socials, NULL::text AS "importantDates",
              NULL::text AS notes, NULL::text AS preferences,
              NULL::text AS "giftIdeas", NULL::text AS "communicationNotes",
              NULL::text AS "collaborationNotes", NULL::text AS sensitivities,
              (SELECT MAX(i."occurredAt") FROM "RolodexInteraction" i WHERE i."personId" = p.id) AS "lastInteractionAt"
       FROM "RolodexPerson" p
       WHERE p."userId" = $1
       ORDER BY p."displayName" ASC`,
      userId,
    );

    let result = rows.map(rowToSummary);

    if (opts.search) {
      const lower = opts.search.toLowerCase();
      result = result.filter(
        (p) =>
          p.displayName.toLowerCase().includes(lower) ||
          (p.firstName?.toLowerCase().includes(lower) ?? false) ||
          (p.lastName?.toLowerCase().includes(lower) ?? false) ||
          (p.organization?.toLowerCase().includes(lower) ?? false) ||
          p.aliases.some((a) => a.toLowerCase().includes(lower)),
      );
    }

    if (opts.contactKind) {
      result = result.filter((p) => p.contactKind === opts.contactKind);
    }

    if (opts.relationshipType) {
      result = result.filter((p) => p.relationshipType === opts.relationshipType);
    }

    return result;
  } catch (error) {
    console.error("[rolodex] listPersons failed", error);
    return [];
  }
}

export async function getPerson(
  userId: string,
  personId: string,
): Promise<RolodexPersonDetail | null> {
  requireCan(userId, "rolodex", "read");
  try {
    const rows = await prisma.$queryRawUnsafe<PersonRow[]>(
      `SELECT * FROM "RolodexPerson" WHERE "id" = $1 AND "userId" = $2 LIMIT 1`,
      personId,
      userId,
    );
    const row = rows[0];
    if (!row) return null;

    const interactions = await listInteractions(userId, personId);
    return rowToDetail(row, interactions);
  } catch (error) {
    console.error("[rolodex] getPerson failed", error);
    return null;
  }
}

export async function createPerson(
  userId: string,
  data: CreatePersonInput,
): Promise<string> {
  requireCan(userId, "rolodex", "write");
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "RolodexPerson" (
       "id", "userId", "displayName", "firstName", "lastName", "aliases",
       "relationshipType", "organization", "role", "contactKind", "emails", "phones",
       "addresses", "socials", "birthday", "importantDates", "notes",
       "preferences", "giftIdeas", "communicationNotes", "collaborationNotes",
       "sensitivities", "createdAt", "updatedAt"
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
       $15::timestamptz, $16, $17, $18, $19, $20, $21, $22, NOW(), NOW()
     )`,
    id,
    userId,
    data.displayName.trim(),
    data.firstName?.trim() ?? null,
    data.lastName?.trim() ?? null,
    data.aliases?.length ? JSON.stringify(data.aliases) : null,
    data.relationshipType ?? null,
    data.organization?.trim() ?? null,
    data.role?.trim() ?? null,
    data.contactKind ?? "person",
    data.emails?.length ? JSON.stringify(data.emails) : null,
    data.phones?.length ? JSON.stringify(data.phones) : null,
    data.addresses?.length ? JSON.stringify(data.addresses) : null,
    data.socials?.length ? JSON.stringify(data.socials) : null,
    data.birthday ?? null,
    data.importantDates?.length ? JSON.stringify(data.importantDates) : null,
    data.notes?.trim() ?? null,
    data.preferences?.trim() ?? null,
    data.giftIdeas?.length ? JSON.stringify(data.giftIdeas) : null,
    data.communicationNotes?.trim() ?? null,
    data.collaborationNotes?.trim() ?? null,
    data.sensitivities?.trim() ?? null,
  );
  await recordEvent({
    userId,
    tool: "rolodex",
    type: "rolodex.person_created",
    refId: id,
    meta: { displayName: data.displayName },
  });
  return id;
}

export async function updatePerson(
  userId: string,
  personId: string,
  patch: Partial<CreatePersonInput>,
): Promise<void> {
  requireCan(userId, "rolodex", "write");
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  function add(col: string, val: unknown) {
    sets.push(`"${col}" = $${idx++}`);
    values.push(val);
  }

  if (patch.displayName !== undefined) add("displayName", patch.displayName.trim());
  if (patch.firstName !== undefined) add("firstName", patch.firstName?.trim() ?? null);
  if (patch.lastName !== undefined) add("lastName", patch.lastName?.trim() ?? null);
  if (patch.aliases !== undefined) add("aliases", patch.aliases?.length ? JSON.stringify(patch.aliases) : null);
  if (patch.relationshipType !== undefined) add("relationshipType", patch.relationshipType);
  if (patch.organization !== undefined) add("organization", patch.organization?.trim() ?? null);
  if (patch.role !== undefined) add("role", patch.role?.trim() ?? null);
  if (patch.emails !== undefined) add("emails", patch.emails?.length ? JSON.stringify(patch.emails) : null);
  if (patch.phones !== undefined) add("phones", patch.phones?.length ? JSON.stringify(patch.phones) : null);
  if (patch.addresses !== undefined) add("addresses", patch.addresses?.length ? JSON.stringify(patch.addresses) : null);
  if (patch.socials !== undefined) add("socials", patch.socials?.length ? JSON.stringify(patch.socials) : null);
  if (patch.contactKind !== undefined) add("contactKind", patch.contactKind);
  if (patch.birthday !== undefined) {
    sets.push(`"birthday" = $${idx++}::timestamptz`);
    values.push(patch.birthday ?? null);
  }
  if (patch.importantDates !== undefined) add("importantDates", patch.importantDates?.length ? JSON.stringify(patch.importantDates) : null);
  if (patch.notes !== undefined) add("notes", patch.notes?.trim() ?? null);
  if (patch.preferences !== undefined) add("preferences", patch.preferences?.trim() ?? null);
  if (patch.giftIdeas !== undefined) add("giftIdeas", patch.giftIdeas?.length ? JSON.stringify(patch.giftIdeas) : null);
  if (patch.communicationNotes !== undefined) add("communicationNotes", patch.communicationNotes?.trim() ?? null);
  if (patch.collaborationNotes !== undefined) add("collaborationNotes", patch.collaborationNotes?.trim() ?? null);
  if (patch.sensitivities !== undefined) add("sensitivities", patch.sensitivities?.trim() ?? null);

  if (sets.length === 0) return;

  sets.push(`"updatedAt" = NOW()`);
  values.push(personId, userId);

  await prisma.$executeRawUnsafe(
    `UPDATE "RolodexPerson" SET ${sets.join(", ")} WHERE "id" = $${idx++} AND "userId" = $${idx++}`,
    ...values,
  );
  await recordEvent({
    userId,
    tool: "rolodex",
    type: "rolodex.person_updated",
    refId: personId,
  });
}

// ── Interaction CRUD ──────────────────────────────────────────────────────

export async function listInteractions(
  userId: string,
  personId: string,
): Promise<RolodexInteraction[]> {
  requireCan(userId, "rolodex", "read");
  try {
    const rows = await prisma.$queryRawUnsafe<InteractionRow[]>(
      `SELECT * FROM "RolodexInteraction"
       WHERE "userId" = $1 AND "personId" = $2
       ORDER BY "occurredAt" DESC`,
      userId,
      personId,
    );
    return rows.map(rowToInteraction);
  } catch (error) {
    console.error("[rolodex] listInteractions failed", error);
    return [];
  }
}

export async function addInteraction(
  userId: string,
  personId: string,
  data: AddInteractionInput,
): Promise<string> {
  requireCan(userId, "rolodex", "write");
  const id = randomUUID();
  const occurredAt = data.occurredAt ? new Date(data.occurredAt) : new Date();
  const followUpDate = data.followUpDate ? new Date(data.followUpDate) : null;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "RolodexInteraction" (
       "id", "userId", "personId", "sourceTool", "sourceRecordId",
       "occurredAt", "title", "body", "followUpNeeded", "followUpDate", "createdAt"
     ) VALUES ($1,$2,$3,$4,$5,$6::timestamptz,$7,$8,$9,$10::timestamptz,NOW())`,
    id,
    userId,
    personId,
    data.sourceTool ?? null,
    data.sourceRecordId ?? null,
    occurredAt.toISOString(),
    data.title.trim(),
    data.body?.trim() ?? null,
    data.followUpNeeded ?? false,
    followUpDate?.toISOString() ?? null,
  );
  await recordEvent({
    userId,
    tool: "rolodex",
    type: "rolodex.interaction_added",
    refId: personId,
    meta: { title: data.title },
  });
  return id;
}

export async function updateFollowUp(
  userId: string,
  interactionId: string,
  followUpNeeded: boolean,
  followUpDate?: string,
): Promise<void> {
  requireCan(userId, "rolodex", "write");
  const date = followUpDate ? new Date(followUpDate) : null;
  await prisma.$executeRawUnsafe(
    `UPDATE "RolodexInteraction"
     SET "followUpNeeded" = $1, "followUpDate" = $2::timestamptz
     WHERE "id" = $3 AND "userId" = $4`,
    followUpNeeded,
    date?.toISOString() ?? null,
    interactionId,
    userId,
  );
}

// ── Mention resolution ────────────────────────────────────────────────────

export async function createMention(
  userId: string,
  data: CreateMentionInput,
): Promise<string> {
  requireCan(userId, "rolodex", "write");
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "RolodexMention" (
       "id","userId","personId","mentionedName","resolved",
       "sourceTool","sourceRecordId","sourceField","createdAt"
     ) VALUES ($1,$2,$3,$4,false,$5,$6,$7,NOW())`,
    id,
    userId,
    data.personId ?? null,
    data.mentionedName,
    data.sourceTool,
    data.sourceRecordId,
    data.sourceField ?? null,
  );
  return id;
}

export async function resolveMention(
  userId: string,
  mentionId: string,
  personId: string,
): Promise<void> {
  requireCan(userId, "rolodex", "write");
  await prisma.$executeRawUnsafe(
    `UPDATE "RolodexMention"
     SET "resolved" = true, "personId" = $1
     WHERE "id" = $2 AND "userId" = $3`,
    personId,
    mentionId,
    userId,
  );
  await recordEvent({
    userId,
    tool: "rolodex",
    type: "rolodex.mention_resolved",
    refId: mentionId,
  });
}

export async function dismissMention(
  userId: string,
  mentionId: string,
): Promise<void> {
  requireCan(userId, "rolodex", "write");
  await prisma.$executeRawUnsafe(
    `UPDATE "RolodexMention"
     SET "dismissed" = true
     WHERE "id" = $1 AND "userId" = $2`,
    mentionId,
    userId,
  );
}

export async function listUnresolvedMentions(userId: string): Promise<RolodexMention[]> {
  requireCan(userId, "rolodex", "read");
  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        mentionedName: string;
        personId: string | null;
        resolved: boolean;
        sourceTool: string;
        sourceRecordId: string;
        createdAt: Date;
      }>
    >(
      `SELECT "id","mentionedName","personId","resolved","sourceTool","sourceRecordId","createdAt"
       FROM "RolodexMention"
       WHERE "userId" = $1 AND "resolved" = false AND "dismissed" = false
       ORDER BY "createdAt" DESC`,
      userId,
    );
    return rows.map((r) => ({
      id: r.id,
      mentionedName: r.mentionedName,
      personId: r.personId,
      resolved: r.resolved,
      sourceTool: r.sourceTool,
      sourceRecordId: r.sourceRecordId,
      createdAt: isoString(r.createdAt) ?? "",
    }));
  } catch (error) {
    console.error("[rolodex] listUnresolvedMentions failed", error);
    return [];
  }
}

// ── Lookup helpers ────────────────────────────────────────────────────────

export async function findPersonByName(
  userId: string,
  name: string,
): Promise<RolodexPersonSummary[]> {
  requireCan(userId, "rolodex", "read");
  try {
    const all = await listPersons(userId);
    const lower = name.toLowerCase();
    return all.filter(
      (p) =>
        p.displayName.toLowerCase().includes(lower) ||
        (p.firstName?.toLowerCase().includes(lower) ?? false) ||
        (p.lastName?.toLowerCase().includes(lower) ?? false) ||
        p.aliases.some((a) => a.toLowerCase().includes(lower)),
    );
  } catch (error) {
    console.error("[rolodex] findPersonByName failed", error);
    return [];
  }
}

// ── Assistant snapshot helpers ────────────────────────────────────────────

export async function getUpcomingBirthdays(
  userId: string,
  daysAhead = 30,
): Promise<BirthdaySummary[]> {
  requireCan(userId, "rolodex", "read");
  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{ id: string; displayName: string; birthday: Date }>
    >(
      `SELECT "id", "displayName", "birthday"
       FROM "RolodexPerson"
       WHERE "userId" = $1 AND "birthday" IS NOT NULL`,
      userId,
    );

    const now = new Date();
    const results: BirthdaySummary[] = [];

    for (const row of rows) {
      const bday = new Date(row.birthday);
      const thisYear = new Date(now.getFullYear(), bday.getMonth(), bday.getDate());
      const nextYear = new Date(now.getFullYear() + 1, bday.getMonth(), bday.getDate());
      const upcoming = thisYear >= now ? thisYear : nextYear;
      const diffMs = upcoming.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / 86_400_000);
      if (diffDays <= daysAhead) {
        results.push({
          personId: row.id,
          displayName: row.displayName,
          birthday: isoString(row.birthday) ?? "",
          daysUntil: diffDays,
        });
      }
    }

    return results.sort((a, b) => a.daysUntil - b.daysUntil);
  } catch (error) {
    console.error("[rolodex] getUpcomingBirthdays failed", error);
    return [];
  }
}

export async function getDueFollowUps(userId: string): Promise<FollowUpSummary[]> {
  requireCan(userId, "rolodex", "read");
  try {
    const now = new Date();
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        personId: string;
        displayName: string;
        title: string;
        followUpDate: Date | null;
      }>
    >(
      `SELECT i."id", i."personId", p."displayName", i."title", i."followUpDate"
       FROM "RolodexInteraction" i
       JOIN "RolodexPerson" p ON p."id" = i."personId"
       WHERE i."userId" = $1
         AND i."followUpNeeded" = true
         AND (i."followUpDate" IS NULL OR i."followUpDate" <= $2)
       ORDER BY i."followUpDate" ASC NULLS LAST`,
      userId,
      now.toISOString(),
    );
    return rows.map((r) => ({
      interactionId: r.id,
      personId: r.personId,
      personName: r.displayName,
      title: r.title,
      followUpDate: isoString(r.followUpDate),
    }));
  } catch (error) {
    console.error("[rolodex] getDueFollowUps failed", error);
    return [];
  }
}

// ── Entity relationships ─────────────────────────────────────────────────

import { RELATION_TYPES, type RelationType, type RolodexRelation } from "@/lib/rolodex";
export { RELATION_TYPES, type RelationType, type RolodexRelation };

type RelationRow = {
  id: string;
  userId: string;
  fromEntityId: string;
  toEntityId: string;
  type: string;
  label: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  toEntityName: string | null;
  fromEntityName: string | null;
};

export async function createRelation(
  userId: string,
  input: {
    fromEntityId: string;
    toEntityId: string;
    type: string;
    label?: string;
    notes?: string;
  },
): Promise<RolodexRelation> {
  requireCan(userId, "rolodex", "write");
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "RolodexRelation" ("id","userId","fromEntityId","toEntityId","type","label","notes")
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    id,
    userId,
    input.fromEntityId,
    input.toEntityId,
    input.type,
    input.label?.trim() ?? null,
    input.notes?.trim() ?? null,
  );
  await recordEvent({
    userId,
    tool: "rolodex",
    type: "rolodex.relation_created",
    refId: id,
    meta: { type: input.type },
  });
  return {
    id,
    userId,
    fromEntityId: input.fromEntityId,
    toEntityId: input.toEntityId,
    type: input.type,
    label: input.label?.trim() ?? null,
    notes: input.notes?.trim() ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function listRelationsForEntity(
  userId: string,
  entityId: string,
): Promise<RolodexRelation[]> {
  requireCan(userId, "rolodex", "read");
  try {
    const rows = await prisma.$queryRawUnsafe<RelationRow[]>(
      `SELECT r.*,
              pTo."displayName" AS "toEntityName",
              pFrom."displayName" AS "fromEntityName"
       FROM "RolodexRelation" r
       LEFT JOIN "RolodexPerson" pTo ON pTo."id" = r."toEntityId"
       LEFT JOIN "RolodexPerson" pFrom ON pFrom."id" = r."fromEntityId"
       WHERE r."userId" = $1
         AND (r."fromEntityId" = $2 OR r."toEntityId" = $2)
       ORDER BY r."createdAt" DESC`,
      userId,
      entityId,
    );
    return rows.map((r) => ({
      ...r,
      toEntityName: r.toEntityName ?? undefined,
      fromEntityName: r.fromEntityName ?? undefined,
    }));
  } catch (error) {
    console.error("[rolodex] listRelationsForEntity failed", error);
    return [];
  }
}

export async function deleteRelation(
  userId: string,
  relationId: string,
): Promise<void> {
  requireCan(userId, "rolodex", "write");
  await prisma.$executeRawUnsafe(
    `DELETE FROM "RolodexRelation" WHERE "id" = $1 AND "userId" = $2`,
    relationId,
    userId,
  );
  await recordEvent({
    userId,
    tool: "rolodex",
    type: "rolodex.relation_deleted",
    refId: relationId,
  });
}

// ── Cross-tool linked records ─────────────────────────────────────────────

export interface LinkedCalendarItem {
  id: string;
  title: string;
  startAt: string;
}

export interface LinkedTimeEntry {
  id: string;
  title: string;
  startedAt: string;
}

export async function getLinkedCalendarItems(
  userId: string,
  personId: string,
): Promise<LinkedCalendarItem[]> {
  requireCan(userId, "rolodex", "read");
  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{ id: string; title: string; startedAt: Date }>
    >(
      `SELECT c."id", c."title", c."startsAt" AS "startedAt"
       FROM "RolodexMention" m
       JOIN "CalendarItem" c ON c."id" = m."sourceRecordId"
       WHERE m."userId" = $1 AND m."personId" = $2 AND m."sourceTool" = 'calendar'
       ORDER BY c."startsAt" DESC
       LIMIT 5`,
      userId,
      personId,
    );
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      startAt: isoString(r.startedAt) ?? "",
    }));
  } catch (error) {
    console.error("[rolodex] getLinkedCalendarItems failed", error);
    return [];
  }
}

export async function getLinkedTimeEntries(
  userId: string,
  personId: string,
): Promise<LinkedTimeEntry[]> {
  requireCan(userId, "rolodex", "read");
  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{ id: string; label: string; startedAt: Date }>
    >(
      `SELECT t."id", t."label", t."startedAt"
       FROM "RolodexMention" m
       JOIN "TimeEntry" t ON t."id" = m."sourceRecordId"
       WHERE m."userId" = $1 AND m."personId" = $2 AND m."sourceTool" = 'time'
       ORDER BY t."startedAt" DESC
       LIMIT 5`,
      userId,
      personId,
    );
    return rows.map((r) => ({
      id: r.id,
      title: r.label,
      startedAt: isoString(r.startedAt) ?? "",
    }));
  } catch (error) {
    console.error("[rolodex] getLinkedTimeEntries failed", error);
    return [];
  }
}

export interface PendingFollowUp {
  personId: string;
  followUpDate: string | null;
}

export async function listAllPendingFollowUps(userId: string): Promise<PendingFollowUp[]> {
  requireCan(userId, "rolodex", "read");
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ personId: string; followUpDate: Date | null }>>(
      `SELECT "personId", "followUpDate"
       FROM "RolodexInteraction"
       WHERE "userId" = $1 AND "followUpNeeded" = true
       ORDER BY "followUpDate" ASC NULLS LAST`,
      userId,
    );
    return rows.map((r) => ({
      personId: r.personId,
      followUpDate: isoString(r.followUpDate),
    }));
  } catch (error) {
    console.error("[rolodex] listAllPendingFollowUps failed", error);
    return [];
  }
}

export async function getRecentlyMentioned(
  userId: string,
  limit = 5,
): Promise<RecentMentionSummary[]> {
  requireCan(userId, "rolodex", "read");
  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        personId: string | null;
        displayName: string | null;
        mentionedName: string;
        resolved: boolean;
        sourceTool: string;
      }>
    >(
      `SELECT m."personId", p."displayName", m."mentionedName", m."resolved", m."sourceTool"
       FROM "RolodexMention" m
       LEFT JOIN "RolodexPerson" p ON p."id" = m."personId"
       WHERE m."userId" = $1
       ORDER BY m."createdAt" DESC
       LIMIT $2`,
      userId,
      limit,
    );
    return rows.map((r) => ({
      personId: r.personId,
      personName: r.displayName,
      mentionedName: r.mentionedName,
      resolved: r.resolved,
      sourceTool: r.sourceTool,
    }));
  } catch (error) {
    console.error("[rolodex] getRecentlyMentioned failed", error);
    return [];
  }
}
