import "server-only";
import { prisma } from "@/lib/prisma";
import {
  resolveLinkedProjectStatus,
  resolveLinkedTaskStatus,
} from "@/lib/work";
import type {
  WorkAreaSummary,
  WorkMeetingSummary,
  WorkNoteSummary,
  WorkPersonSummary,
  WorkProjectSummary,
  WorkRecurrence,
  WorkReviewSummary,
  WorkTaskSummary,
} from "@/lib/work";

// ── Ensure tables (raw SQL, memoized — same pattern as rolodex.ts) ────────
// `prisma migrate dev` currently demands a destructive reset, so Work tables
// go in via idempotent DDL on first use. prisma/schema/work.prisma mirrors
// this exactly so `prisma generate` (Vercel build) picks up the types.

let workTablesReady: Promise<void> | null = null;

export function ensureWorkTables(): Promise<void> {
  if (!workTablesReady) {
    workTablesReady = _createWorkTables();
  }
  return workTablesReady;
}

async function _createWorkTables(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "WorkWorkspace" (
        "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "userId"      TEXT NOT NULL,
        "name"        TEXT NOT NULL,
        "description" TEXT,
        "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "WorkWorkspace_userId_idx"
        ON "WorkWorkspace" ("userId")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "WorkArea" (
        "id"           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "userId"       TEXT NOT NULL,
        "workspaceId"  TEXT NOT NULL
                         REFERENCES "WorkWorkspace"("id") ON DELETE CASCADE,
        "name"         TEXT NOT NULL,
        "description"  TEXT,
        "currentFocus" TEXT,
        "status"       TEXT NOT NULL DEFAULT 'active',
        "sortOrder"    INTEGER NOT NULL DEFAULT 0,
        "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "WorkArea_userId_workspaceId_status_idx"
        ON "WorkArea" ("userId", "workspaceId", "status")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "WorkProject" (
        "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "userId"      TEXT NOT NULL,
        "workspaceId" TEXT NOT NULL
                        REFERENCES "WorkWorkspace"("id") ON DELETE CASCADE,
        "areaId"      TEXT REFERENCES "WorkArea"("id") ON DELETE SET NULL,
        "name"        TEXT NOT NULL,
        "outcome"     TEXT,
        "status"      TEXT NOT NULL DEFAULT 'active',
        "dueDate"     TIMESTAMPTZ,
        "nextAction"  TEXT,
        "notes"       TEXT,
        "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "WorkProject_userId_workspaceId_status_idx"
        ON "WorkProject" ("userId", "workspaceId", "status")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "WorkPerson" (
        "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "userId"          TEXT NOT NULL,
        "workspaceId"     TEXT NOT NULL
                            REFERENCES "WorkWorkspace"("id") ON DELETE CASCADE,
        "name"            TEXT NOT NULL,
        "role"            TEXT,
        "relationship"    TEXT,
        "team"            TEXT,
        "notes"           TEXT,
        "oneOnOneNotes"   TEXT,
        "rolodexPersonId" TEXT,
        "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "WorkPerson_userId_workspaceId_idx"
        ON "WorkPerson" ("userId", "workspaceId")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "WorkMeeting" (
        "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "userId"          TEXT NOT NULL,
        "workspaceId"     TEXT NOT NULL
                            REFERENCES "WorkWorkspace"("id") ON DELETE CASCADE,
        "title"           TEXT NOT NULL,
        "scheduledAt"     TIMESTAMPTZ,
        "durationMinutes" INTEGER,
        "recurrence"      TEXT NOT NULL DEFAULT 'none',
        "personId"        TEXT REFERENCES "WorkPerson"("id") ON DELETE SET NULL,
        "projectId"       TEXT,
        "areaId"          TEXT,
        "agenda"          TEXT,
        "notes"           TEXT,
        "status"          TEXT NOT NULL DEFAULT 'active',
        "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "WorkMeeting_userId_workspaceId_status_idx"
        ON "WorkMeeting" ("userId", "workspaceId", "status")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "WorkTask" (
        "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "userId"      TEXT NOT NULL,
        "workspaceId" TEXT NOT NULL
                        REFERENCES "WorkWorkspace"("id") ON DELETE CASCADE,
        "title"       TEXT NOT NULL,
        "status"      TEXT NOT NULL DEFAULT 'open',
        "kind"        TEXT NOT NULL DEFAULT 'task',
        "dueDate"     TIMESTAMPTZ,
        "isImportant" BOOLEAN NOT NULL DEFAULT false,
        "waitingOn"   TEXT,
        "notes"       TEXT,
        "areaId"      TEXT REFERENCES "WorkArea"("id") ON DELETE SET NULL,
        "projectId"   TEXT REFERENCES "WorkProject"("id") ON DELETE SET NULL,
        "personId"    TEXT REFERENCES "WorkPerson"("id") ON DELETE SET NULL,
        "meetingId"   TEXT REFERENCES "WorkMeeting"("id") ON DELETE SET NULL,
        "completedAt" TIMESTAMPTZ,
        "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "WorkTask_userId_workspaceId_status_dueDate_idx"
        ON "WorkTask" ("userId", "workspaceId", "status", "dueDate")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "WorkNote" (
        "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "userId"      TEXT NOT NULL,
        "workspaceId" TEXT NOT NULL
                        REFERENCES "WorkWorkspace"("id") ON DELETE CASCADE,
        "kind"        TEXT NOT NULL DEFAULT 'note',
        "title"       TEXT,
        "body"        TEXT NOT NULL,
        "resolved"    BOOLEAN NOT NULL DEFAULT false,
        "areaId"      TEXT,
        "projectId"   TEXT,
        "personId"    TEXT,
        "meetingId"   TEXT,
        "occurredAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "WorkNote_userId_workspaceId_occurredAt_idx"
        ON "WorkNote" ("userId", "workspaceId", "occurredAt" DESC)
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "WorkReview" (
        "id"             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "userId"         TEXT NOT NULL,
        "workspaceId"    TEXT NOT NULL
                           REFERENCES "WorkWorkspace"("id") ON DELETE CASCADE,
        "kind"           TEXT NOT NULL,
        "periodKey"      TEXT NOT NULL,
        "looseEnds"      TEXT,
        "tomorrowFocus"  TEXT,
        "wins"           TEXT,
        "challenges"     TEXT,
        "nextPriorities" TEXT,
        "energy"         INTEGER,
        "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE ("userId", "workspaceId", "kind", "periodKey")
      )
    `);
    // Link columns tying Work rows to their canonical objects in the owning
    // tools (added after the initial tables shipped — idempotent ALTERs cover
    // both fresh and existing databases). No FK constraints on purpose: the
    // referenced tables are owned by other tools and reads fall back to the
    // Work-side copy when a link dangles.
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "WorkTask" ADD COLUMN IF NOT EXISTS "doItemId" TEXT`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "WorkMeeting" ADD COLUMN IF NOT EXISTS "calendarItemId" TEXT`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "WorkProject" ADD COLUMN IF NOT EXISTS "projectId" TEXT`,
    );
  } catch (error) {
    workTablesReady = null;
    console.error("[work] ensureWorkTables failed", error);
    throw error;
  }
}

// ── Row types + mappers ───────────────────────────────────────────────────

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

export type WorkspaceRow = {
  id: string;
  name: string;
  description: string | null;
};

export type AreaRow = {
  id: string;
  name: string;
  description: string | null;
  currentFocus: string | null;
  status: string;
  sortOrder: number;
};

export type ProjectRow = {
  id: string;
  areaId: string | null;
  name: string;
  outcome: string | null;
  status: string;
  dueDate: Date | null;
  nextAction: string | null;
  notes: string | null;
  updatedAt: Date;
  projectId: string | null;
  /** Status of the linked Aucosto Project (joined), null when unlinked. */
  linkedStatus: string | null;
};

export type PersonRow = {
  id: string;
  name: string;
  role: string | null;
  relationship: string | null;
  team: string | null;
  notes: string | null;
  oneOnOneNotes: string | null;
  rolodexPersonId: string | null;
};

export type MeetingRow = {
  id: string;
  title: string;
  scheduledAt: Date | null;
  durationMinutes: number | null;
  recurrence: string;
  personId: string | null;
  projectId: string | null;
  areaId: string | null;
  agenda: string | null;
  notes: string | null;
  status: string;
  calendarItemId: string | null;
};

export type TaskRow = {
  id: string;
  title: string;
  status: string;
  kind: string;
  dueDate: Date | null;
  isImportant: boolean;
  waitingOn: string | null;
  notes: string | null;
  areaId: string | null;
  projectId: string | null;
  personId: string | null;
  meetingId: string | null;
  completedAt: Date | null;
  createdAt: Date;
  doItemId: string | null;
  /** Status of the linked DoItem (joined), null when unlinked. */
  doStatus: string | null;
};

export type NoteRow = {
  id: string;
  kind: string;
  title: string | null;
  body: string;
  resolved: boolean;
  areaId: string | null;
  projectId: string | null;
  personId: string | null;
  meetingId: string | null;
  occurredAt: Date;
};

export type ReviewRow = {
  id: string;
  kind: string;
  periodKey: string;
  looseEnds: string | null;
  tomorrowFocus: string | null;
  wins: string | null;
  challenges: string | null;
  nextPriorities: string | null;
  energy: number | null;
  updatedAt: Date;
};

export function rowToArea(row: AreaRow): WorkAreaSummary {
  return { ...row };
}

export function rowToProject(row: ProjectRow): WorkProjectSummary {
  const { projectId, linkedStatus, ...rest } = row;
  return {
    ...rest,
    status: resolveLinkedProjectStatus(row.status, linkedStatus),
    dueDate: iso(row.dueDate),
    updatedAt: iso(row.updatedAt) ?? "",
    linkedProjectId: projectId,
  };
}

export function rowToPerson(row: PersonRow): WorkPersonSummary {
  return { ...row };
}

export function rowToMeeting(row: MeetingRow): WorkMeetingSummary {
  return {
    ...row,
    recurrence: row.recurrence as WorkRecurrence,
    scheduledAt: iso(row.scheduledAt),
  };
}

export function rowToTask(row: TaskRow): WorkTaskSummary {
  const { doStatus, ...rest } = row;
  return {
    ...rest,
    status: row.doItemId
      ? resolveLinkedTaskStatus(row.status, doStatus)
      : (row.status as WorkTaskSummary["status"]),
    kind: row.kind as WorkTaskSummary["kind"],
    dueDate: iso(row.dueDate),
    completedAt: iso(row.completedAt),
    createdAt: iso(row.createdAt) ?? "",
  };
}

export function rowToNote(row: NoteRow): WorkNoteSummary {
  return {
    ...row,
    kind: row.kind as WorkNoteSummary["kind"],
    occurredAt: iso(row.occurredAt) ?? "",
  };
}

export function rowToReview(row: ReviewRow): WorkReviewSummary {
  return {
    ...row,
    kind: row.kind as WorkReviewSummary["kind"],
    updatedAt: iso(row.updatedAt) ?? "",
  };
}
