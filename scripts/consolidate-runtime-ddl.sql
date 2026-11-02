-- Consolidated runtime DDL (2026-11-02).
--
-- Every CREATE/ALTER that services currently run lazily at request time via
-- their ensure*() helpers, collected in one idempotent file so the live
-- schema can be brought in line once, deliberately, instead of on every cold
-- start. Generated from the service sources; each section names its origin.
--
-- Apply over DIRECT_URL (session pooler):
--   npx tsx --env-file=.env scripts/apply-sql.ts scripts/consolidate-runtime-ddl.sql
--
-- Safe to re-run: everything is IF [NOT] EXISTS or a no-op on clean data.
-- After it has been applied to production, the ensure*() helpers become
-- no-ops and can be deleted (follow-up), and `prisma migrate` can be
-- re-baselined — see docs/lessons.md "Re-baselining migrations".

-- ── src/lib/services/time-categories.ts ──
CREATE TABLE IF NOT EXISTS "TimeCategory" ("id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "color" TEXT NOT NULL DEFAULT '#6366f1', "emoji" TEXT, "isHidden" BOOLEAN NOT NULL DEFAULT false, "sortOrder" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE INDEX IF NOT EXISTS "TimeCategory_userId_sortOrder_idx" ON "TimeCategory" ("userId", "sortOrder");

-- ── src/lib/services/time-calendar.ts ──
ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "calendarEventId" TEXT REFERENCES "CalendarItem"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "TimeEntry_userId_calendarEventId_idx" ON "TimeEntry"("userId", "calendarEventId");

-- ── src/lib/services/time-people.ts ──
CREATE TABLE IF NOT EXISTS "TimeEntryPerson" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "timeEntryId" TEXT NOT NULL, "personId" TEXT NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE("userId", "timeEntryId", "personId"));

CREATE INDEX IF NOT EXISTS "TimeEntryPerson_user_time_idx" ON "TimeEntryPerson" ("userId", "timeEntryId");

CREATE INDEX IF NOT EXISTS "TimeEntryPerson_user_person_idx" ON "TimeEntryPerson" ("userId", "personId");

-- ── src/lib/services/calendar.ts ──
ALTER TABLE "CalendarItem" ADD COLUMN IF NOT EXISTS "categoryId" TEXT REFERENCES "TimeCategory"("id");

ALTER TABLE "CalendarItem" ADD COLUMN IF NOT EXISTS "recurrenceRule" JSONB;

ALTER TABLE "CalendarItem" ADD COLUMN IF NOT EXISTS "recurrenceParentId" TEXT;

ALTER TABLE "CalendarItem" ADD COLUMN IF NOT EXISTS "recurrenceOriginalStart" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "CalendarItem_userId_recurrenceParentId_recurrenceOriginalStart_idx" ON "CalendarItem"("userId", "recurrenceParentId", "recurrenceOriginalStart");

-- ── src/lib/services/habits/shared.ts ──
ALTER TABLE "Habit" ADD COLUMN IF NOT EXISTS "windowStart" TEXT, ADD COLUMN IF NOT EXISTS "windowEnd" TEXT;

-- ── src/lib/services/projects.ts ──
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "areaId" TEXT, ADD COLUMN IF NOT EXISTS "intent" TEXT, ADD COLUMN IF NOT EXISTS "energyType" TEXT NOT NULL DEFAULT 'deep', ADD COLUMN IF NOT EXISTS "timeBudgetMinutes" INTEGER, ADD COLUMN IF NOT EXISTS "nextAction" TEXT;

CREATE TABLE IF NOT EXISTS "Area" ("id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "color" TEXT NOT NULL DEFAULT '#6366f1', "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE INDEX IF NOT EXISTS "Area_userId_idx" ON "Area" ("userId");

CREATE TABLE IF NOT EXISTS "ProjectTask" ("id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE, "userId" TEXT NOT NULL, "title" TEXT NOT NULL, "done" BOOLEAN NOT NULL DEFAULT false, "isToday" BOOLEAN NOT NULL DEFAULT false, "sortOrder" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE INDEX IF NOT EXISTS "ProjectTask_projectId_idx" ON "ProjectTask" ("projectId");

ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "projectId" TEXT;

CREATE INDEX IF NOT EXISTS "TimeEntry_projectId_startedAt_idx" ON "TimeEntry" ("projectId", "startedAt");

-- ── src/lib/services/project-planning.ts ──
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "goal" TEXT;

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "why_it_matters" TEXT;

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "whyItMatters" TEXT;

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "open_questions" TEXT;

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "openQuestions" TEXT;

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "blockers" TEXT;

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "plan_notes" TEXT;

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "planNotes" TEXT;

-- ── src/lib/services/rolodex.ts ──
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
);

CREATE INDEX IF NOT EXISTS "RolodexPerson_userId_idx"
  ON "RolodexPerson" ("userId");

CREATE INDEX IF NOT EXISTS "RolodexPerson_userId_displayName_idx"
  ON "RolodexPerson" ("userId", "displayName");

ALTER TABLE "RolodexPerson"
  ADD COLUMN IF NOT EXISTS "contactKind" TEXT NOT NULL DEFAULT 'person';

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
);

CREATE INDEX IF NOT EXISTS "RolodexInteraction_userId_idx"
  ON "RolodexInteraction" ("userId");

CREATE INDEX IF NOT EXISTS "RolodexInteraction_personId_occurredAt_idx"
  ON "RolodexInteraction" ("personId", "occurredAt" DESC);

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
);

CREATE INDEX IF NOT EXISTS "RolodexMention_userId_idx"
  ON "RolodexMention" ("userId");

CREATE INDEX IF NOT EXISTS "RolodexMention_userId_resolved_idx"
  ON "RolodexMention" ("userId", "resolved");

CREATE INDEX IF NOT EXISTS "RolodexMention_personId_idx"
  ON "RolodexMention" ("personId");

ALTER TABLE "RolodexMention"
  ADD COLUMN IF NOT EXISTS "dismissed" BOOLEAN NOT NULL DEFAULT FALSE;

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
);

CREATE INDEX IF NOT EXISTS "RolodexRelation_userId_from_idx"
  ON "RolodexRelation"("userId", "fromEntityId");

CREATE INDEX IF NOT EXISTS "RolodexRelation_userId_to_idx"
  ON "RolodexRelation"("userId", "toEntityId");

-- ── src/lib/services/captured-insights.ts ──
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
);

CREATE TABLE IF NOT EXISTS "CapturedInsightPerson" (
  "id"        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"    TEXT NOT NULL,
  "insightId" TEXT NOT NULL REFERENCES "CapturedInsight"("id") ON DELETE CASCADE,
  "personId"  TEXT NOT NULL,
  UNIQUE("insightId", "personId")
);

CREATE INDEX IF NOT EXISTS "CapturedInsight_userId_idx"
  ON "CapturedInsight"("userId");

CREATE INDEX IF NOT EXISTS "CapturedInsight_userId_occurredAt_idx"
  ON "CapturedInsight"("userId", "occurredAt" DESC);

CREATE INDEX IF NOT EXISTS "CapturedInsight_source_idx"
  ON "CapturedInsight"("userId", "sourceTool", "sourceRecordId");

CREATE INDEX IF NOT EXISTS "CapturedInsightPerson_userId_personId_idx"
  ON "CapturedInsightPerson"("userId", "personId");

-- ── src/lib/services/work/shared.ts ──
CREATE TABLE IF NOT EXISTS "WorkWorkspace" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"      TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "WorkWorkspace_userId_idx"
  ON "WorkWorkspace" ("userId");

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
);

CREATE INDEX IF NOT EXISTS "WorkArea_userId_workspaceId_status_idx"
  ON "WorkArea" ("userId", "workspaceId", "status");

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
);

CREATE INDEX IF NOT EXISTS "WorkProject_userId_workspaceId_status_idx"
  ON "WorkProject" ("userId", "workspaceId", "status");

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
);

CREATE INDEX IF NOT EXISTS "WorkPerson_userId_workspaceId_idx"
  ON "WorkPerson" ("userId", "workspaceId");

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
);

CREATE INDEX IF NOT EXISTS "WorkMeeting_userId_workspaceId_status_idx"
  ON "WorkMeeting" ("userId", "workspaceId", "status");

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
);

CREATE INDEX IF NOT EXISTS "WorkTask_userId_workspaceId_status_dueDate_idx"
  ON "WorkTask" ("userId", "workspaceId", "status", "dueDate");

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
);

CREATE INDEX IF NOT EXISTS "WorkNote_userId_workspaceId_occurredAt_idx"
  ON "WorkNote" ("userId", "workspaceId", "occurredAt" DESC);

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
);

ALTER TABLE "WorkTask" ADD COLUMN IF NOT EXISTS "doItemId" TEXT;

ALTER TABLE "WorkMeeting" ADD COLUMN IF NOT EXISTS "calendarItemId" TEXT;

ALTER TABLE "WorkProject" ADD COLUMN IF NOT EXISTS "projectId" TEXT;

-- ── src/lib/services/assistant-audit.ts ──
CREATE TABLE IF NOT EXISTS assistant_action_audits (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'assistant',
  risk_level TEXT NOT NULL DEFAULT 'low',
  confirmed BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'previewed',
  source JSONB,
  normalized_input JSONB NOT NULL DEFAULT '{}',
  preview_text TEXT NOT NULL DEFAULT '',
  result_record_id TEXT,
  result_record_type TEXT,
  before_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aaa_user_created
ON assistant_action_audits(user_id, created_at DESC);

-- ── Review fixes (not previously in any service) ──

-- At most one running timer per user. startEntry() now serializes per user,
-- this index makes the invariant hold even against concurrent writers. First
-- close any duplicates (keep the newest running entry per user).
UPDATE "TimeEntry" t
SET "endedAt" = GREATEST(t."startedAt", now())
WHERE t."endedAt" IS NULL
  AND EXISTS (
    SELECT 1 FROM "TimeEntry" o
    WHERE o."userId" = t."userId"
      AND o."endedAt" IS NULL
      AND (o."startedAt" > t."startedAt" OR (o."startedAt" = t."startedAt" AND o."id" > t."id"))
  );

CREATE UNIQUE INDEX IF NOT EXISTS "TimeEntry_userId_running_key"
  ON "TimeEntry" ("userId") WHERE "endedAt" IS NULL;

-- The app lock was removed; drop its columns.
ALTER TABLE "User" DROP COLUMN IF EXISTS "appLockEnabled", DROP COLUMN IF EXISTS "appLockPinHash";

-- Demo workspace users are entered via the demo-mode cookie, never by
-- logging in. Clear the old derivable password.
UPDATE "User" SET "password" = NULL WHERE "isDemo" = true;
