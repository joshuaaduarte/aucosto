import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { recordEvent } from "@/lib/services/events";
import { ensureWorkTables } from "./shared";

// Writes stay strict and throw; server actions translate to `{ error }`.

// ── Generic patch helper (rolodex updatePerson pattern) ───────────────────

type PatchValue = string | number | boolean | null;

async function patchRow(
  table: string,
  id: string,
  userId: string,
  patch: Record<string, PatchValue | undefined>,
  opts: { touchUpdatedAt?: boolean; timestamptzCols?: string[] } = {},
): Promise<void> {
  const sets: string[] = [];
  const values: PatchValue[] = [];
  let idx = 1;
  for (const [col, val] of Object.entries(patch)) {
    if (val === undefined) continue;
    const cast = opts.timestamptzCols?.includes(col) ? "::timestamptz" : "";
    sets.push(`"${col}" = $${idx++}${cast}`);
    values.push(val);
  }
  if (sets.length === 0) return;
  if (opts.touchUpdatedAt !== false) sets.push(`"updatedAt" = NOW()`);
  await prisma.$executeRawUnsafe(
    `UPDATE "${table}" SET ${sets.join(", ")} WHERE "id" = $${idx++} AND "userId" = $${idx++}`,
    ...values,
    id,
    userId,
  );
}

// ── Areas ─────────────────────────────────────────────────────────────────

export interface WorkAreaInput {
  name: string;
  description?: string | null;
  currentFocus?: string | null;
}

export async function createArea(
  userId: string,
  workspaceId: string,
  input: WorkAreaInput,
): Promise<string> {
  requireCan(userId, "work", "write");
  await ensureWorkTables();
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "WorkArea" ("id", "userId", "workspaceId", "name", "description", "currentFocus")
     VALUES ($1, $2, $3, $4, $5, $6)`,
    id,
    userId,
    workspaceId,
    input.name.trim(),
    input.description?.trim() || null,
    input.currentFocus?.trim() || null,
  );
  await recordEvent({ userId, tool: "work", type: "work.area_created", refId: id, meta: { name: input.name } });
  return id;
}

export async function updateArea(
  userId: string,
  areaId: string,
  patch: Partial<WorkAreaInput> & { status?: string },
): Promise<void> {
  requireCan(userId, "work", "write");
  await patchRow("WorkArea", areaId, userId, {
    name: patch.name?.trim(),
    description: patch.description === undefined ? undefined : patch.description?.trim() || null,
    currentFocus: patch.currentFocus === undefined ? undefined : patch.currentFocus?.trim() || null,
    status: patch.status,
  });
  await recordEvent({ userId, tool: "work", type: "work.area_updated", refId: areaId });
}

// ── Projects ──────────────────────────────────────────────────────────────

export interface WorkProjectInput {
  name: string;
  outcome?: string | null;
  status?: string;
  dueDate?: string | null; // ISO or YYYY-MM-DD
  nextAction?: string | null;
  notes?: string | null;
  areaId?: string | null;
  /** Aucosto Project id this work project wraps (column "projectId"). */
  linkedProjectId?: string | null;
}

export async function createProject(
  userId: string,
  workspaceId: string,
  input: WorkProjectInput,
): Promise<string> {
  requireCan(userId, "work", "write");
  await ensureWorkTables();
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "WorkProject"
       ("id", "userId", "workspaceId", "areaId", "name", "outcome", "status", "dueDate", "nextAction", "notes", "projectId")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9, $10, $11)`,
    id,
    userId,
    workspaceId,
    input.areaId || null,
    input.name.trim(),
    input.outcome?.trim() || null,
    input.status || "active",
    input.dueDate || null,
    input.nextAction?.trim() || null,
    input.notes?.trim() || null,
    input.linkedProjectId || null,
  );
  await recordEvent({ userId, tool: "work", type: "work.project_created", refId: id, meta: { name: input.name } });
  return id;
}

/** Remove a work project row (the linked Aucosto Project, if any, is kept). */
export async function deleteWorkProject(
  userId: string,
  workProjectId: string,
): Promise<void> {
  requireCan(userId, "work", "write");
  await prisma.$executeRawUnsafe(
    `DELETE FROM "WorkProject" WHERE "id" = $1 AND "userId" = $2`,
    workProjectId,
    userId,
  );
  await recordEvent({ userId, tool: "work", type: "work.project_unlinked", refId: workProjectId });
}

export async function updateProject(
  userId: string,
  projectId: string,
  patch: Partial<WorkProjectInput>,
): Promise<void> {
  requireCan(userId, "work", "write");
  await patchRow(
    "WorkProject",
    projectId,
    userId,
    {
      name: patch.name?.trim(),
      outcome: patch.outcome === undefined ? undefined : patch.outcome?.trim() || null,
      status: patch.status,
      dueDate: patch.dueDate === undefined ? undefined : patch.dueDate || null,
      nextAction: patch.nextAction === undefined ? undefined : patch.nextAction?.trim() || null,
      notes: patch.notes === undefined ? undefined : patch.notes?.trim() || null,
      areaId: patch.areaId === undefined ? undefined : patch.areaId || null,
    },
    { timestamptzCols: ["dueDate"] },
  );
  await recordEvent({ userId, tool: "work", type: "work.project_updated", refId: projectId });
}

// ── People ────────────────────────────────────────────────────────────────

export interface WorkPersonInput {
  name: string;
  role?: string | null;
  relationship?: string | null;
  team?: string | null;
  notes?: string | null;
  oneOnOneNotes?: string | null;
  /** Canonical RolodexPerson this row links into the workspace. */
  rolodexPersonId?: string | null;
}

export async function createWorkPerson(
  userId: string,
  workspaceId: string,
  input: WorkPersonInput,
): Promise<string> {
  requireCan(userId, "work", "write");
  await ensureWorkTables();
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "WorkPerson"
       ("id", "userId", "workspaceId", "name", "role", "relationship", "team", "notes", "oneOnOneNotes", "rolodexPersonId")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    id,
    userId,
    workspaceId,
    input.name.trim(),
    input.role?.trim() || null,
    input.relationship || null,
    input.team?.trim() || null,
    input.notes?.trim() || null,
    input.oneOnOneNotes?.trim() || null,
    input.rolodexPersonId || null,
  );
  await recordEvent({ userId, tool: "work", type: "work.person_created", refId: id, meta: { name: input.name } });
  return id;
}

/** Remove a person from the workspace (their Rolodex record is kept). */
export async function deleteWorkPerson(
  userId: string,
  workPersonId: string,
): Promise<void> {
  requireCan(userId, "work", "write");
  await prisma.$executeRawUnsafe(
    `DELETE FROM "WorkPerson" WHERE "id" = $1 AND "userId" = $2`,
    workPersonId,
    userId,
  );
  await recordEvent({ userId, tool: "work", type: "work.person_removed", refId: workPersonId });
}

export async function updateWorkPerson(
  userId: string,
  personId: string,
  patch: Partial<WorkPersonInput>,
): Promise<void> {
  requireCan(userId, "work", "write");
  await patchRow("WorkPerson", personId, userId, {
    name: patch.name?.trim(),
    role: patch.role === undefined ? undefined : patch.role?.trim() || null,
    relationship: patch.relationship === undefined ? undefined : patch.relationship || null,
    team: patch.team === undefined ? undefined : patch.team?.trim() || null,
    notes: patch.notes === undefined ? undefined : patch.notes?.trim() || null,
    oneOnOneNotes: patch.oneOnOneNotes === undefined ? undefined : patch.oneOnOneNotes?.trim() || null,
  });
  await recordEvent({ userId, tool: "work", type: "work.person_updated", refId: personId });
}

// ── Meetings ──────────────────────────────────────────────────────────────

export interface WorkMeetingInput {
  title: string;
  scheduledAt?: string | null;
  durationMinutes?: number | null;
  recurrence?: string;
  personId?: string | null;
  projectId?: string | null;
  areaId?: string | null;
  agenda?: string | null;
  notes?: string | null;
  /** Canonical CalendarItem backing the scheduled occurrence. */
  calendarItemId?: string | null;
}

export async function createMeeting(
  userId: string,
  workspaceId: string,
  input: WorkMeetingInput,
): Promise<string> {
  requireCan(userId, "work", "write");
  await ensureWorkTables();
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "WorkMeeting"
       ("id", "userId", "workspaceId", "title", "scheduledAt", "durationMinutes",
        "recurrence", "personId", "projectId", "areaId", "agenda", "notes", "calendarItemId")
     VALUES ($1, $2, $3, $4, $5::timestamptz, $6, $7, $8, $9, $10, $11, $12, $13)`,
    id,
    userId,
    workspaceId,
    input.title.trim(),
    input.scheduledAt || null,
    input.durationMinutes ?? null,
    input.recurrence || "none",
    input.personId || null,
    input.projectId || null,
    input.areaId || null,
    input.agenda?.trim() || null,
    input.notes?.trim() || null,
    input.calendarItemId || null,
  );
  await recordEvent({ userId, tool: "work", type: "work.meeting_created", refId: id, meta: { title: input.title } });
  return id;
}

export async function updateMeeting(
  userId: string,
  meetingId: string,
  patch: Partial<WorkMeetingInput> & { status?: string },
): Promise<void> {
  requireCan(userId, "work", "write");
  await patchRow(
    "WorkMeeting",
    meetingId,
    userId,
    {
      title: patch.title?.trim(),
      scheduledAt: patch.scheduledAt === undefined ? undefined : patch.scheduledAt || null,
      durationMinutes: patch.durationMinutes === undefined ? undefined : patch.durationMinutes,
      recurrence: patch.recurrence,
      personId: patch.personId === undefined ? undefined : patch.personId || null,
      agenda: patch.agenda === undefined ? undefined : patch.agenda?.trim() || null,
      notes: patch.notes === undefined ? undefined : patch.notes?.trim() || null,
      status: patch.status,
      calendarItemId:
        patch.calendarItemId === undefined ? undefined : patch.calendarItemId || null,
    },
    { timestamptzCols: ["scheduledAt"] },
  );
  await recordEvent({ userId, tool: "work", type: "work.meeting_updated", refId: meetingId });
}

// ── Tasks ─────────────────────────────────────────────────────────────────

export interface WorkTaskInput {
  title: string;
  kind?: string;
  dueDate?: string | null;
  isImportant?: boolean;
  waitingOn?: string | null;
  notes?: string | null;
  areaId?: string | null;
  projectId?: string | null;
  personId?: string | null;
  meetingId?: string | null;
  /** Canonical DoItem backing this task. */
  doItemId?: string | null;
}

export async function createTask(
  userId: string,
  workspaceId: string,
  input: WorkTaskInput,
): Promise<string> {
  requireCan(userId, "work", "write");
  await ensureWorkTables();
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "WorkTask"
       ("id", "userId", "workspaceId", "title", "status", "kind", "dueDate", "isImportant",
        "waitingOn", "notes", "areaId", "projectId", "personId", "meetingId", "doItemId")
     VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8, $9, $10, $11, $12, $13, $14, $15)`,
    id,
    userId,
    workspaceId,
    input.title.trim(),
    input.waitingOn?.trim() ? "waiting" : "open",
    input.kind || "task",
    input.dueDate || null,
    input.isImportant ?? false,
    input.waitingOn?.trim() || null,
    input.notes?.trim() || null,
    input.areaId || null,
    input.projectId || null,
    input.personId || null,
    input.meetingId || null,
    input.doItemId || null,
  );
  await recordEvent({ userId, tool: "work", type: "work.task_created", refId: id, meta: { title: input.title } });
  return id;
}

export async function updateTask(
  userId: string,
  taskId: string,
  patch: Partial<WorkTaskInput> & { status?: string },
): Promise<void> {
  requireCan(userId, "work", "write");
  await patchRow(
    "WorkTask",
    taskId,
    userId,
    {
      title: patch.title?.trim(),
      status: patch.status,
      kind: patch.kind,
      dueDate: patch.dueDate === undefined ? undefined : patch.dueDate || null,
      isImportant: patch.isImportant,
      waitingOn: patch.waitingOn === undefined ? undefined : patch.waitingOn?.trim() || null,
      notes: patch.notes === undefined ? undefined : patch.notes?.trim() || null,
      areaId: patch.areaId === undefined ? undefined : patch.areaId || null,
      projectId: patch.projectId === undefined ? undefined : patch.projectId || null,
      personId: patch.personId === undefined ? undefined : patch.personId || null,
      meetingId: patch.meetingId === undefined ? undefined : patch.meetingId || null,
    },
    { timestamptzCols: ["dueDate"] },
  );
  await recordEvent({ userId, tool: "work", type: "work.task_updated", refId: taskId });
}

export async function setTaskDone(
  userId: string,
  taskId: string,
  done: boolean,
): Promise<void> {
  requireCan(userId, "work", "write");
  await prisma.$executeRawUnsafe(
    `UPDATE "WorkTask"
     SET "status" = $1,
         "completedAt" = ${done ? "NOW()" : "NULL"},
         "updatedAt" = NOW()
     WHERE "id" = $2 AND "userId" = $3`,
    done ? "done" : "open",
    taskId,
    userId,
  );
  await recordEvent({
    userId,
    tool: "work",
    type: done ? "work.task_completed" : "work.task_reopened",
    refId: taskId,
  });
}

export async function deleteTask(userId: string, taskId: string): Promise<void> {
  requireCan(userId, "work", "write");
  await prisma.$executeRawUnsafe(
    `DELETE FROM "WorkTask" WHERE "id" = $1 AND "userId" = $2`,
    taskId,
    userId,
  );
  await recordEvent({ userId, tool: "work", type: "work.task_deleted", refId: taskId });
}

// ── Notes / decisions ─────────────────────────────────────────────────────

export interface WorkNoteInput {
  kind?: string;
  title?: string | null;
  body: string;
  areaId?: string | null;
  projectId?: string | null;
  personId?: string | null;
  meetingId?: string | null;
}

export async function createNote(
  userId: string,
  workspaceId: string,
  input: WorkNoteInput,
): Promise<string> {
  requireCan(userId, "work", "write");
  await ensureWorkTables();
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "WorkNote"
       ("id", "userId", "workspaceId", "kind", "title", "body",
        "areaId", "projectId", "personId", "meetingId")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    id,
    userId,
    workspaceId,
    input.kind || "note",
    input.title?.trim() || null,
    input.body.trim(),
    input.areaId || null,
    input.projectId || null,
    input.personId || null,
    input.meetingId || null,
  );
  await recordEvent({
    userId,
    tool: "work",
    type: input.kind === "decision" ? "work.decision_logged" : "work.note_created",
    refId: id,
  });
  return id;
}

export async function setNoteResolved(
  userId: string,
  noteId: string,
  resolved: boolean,
): Promise<void> {
  requireCan(userId, "work", "write");
  await prisma.$executeRawUnsafe(
    `UPDATE "WorkNote" SET "resolved" = $1 WHERE "id" = $2 AND "userId" = $3`,
    resolved,
    noteId,
    userId,
  );
  await recordEvent({ userId, tool: "work", type: "work.decision_resolved", refId: noteId });
}

export async function deleteNote(userId: string, noteId: string): Promise<void> {
  requireCan(userId, "work", "write");
  await prisma.$executeRawUnsafe(
    `DELETE FROM "WorkNote" WHERE "id" = $1 AND "userId" = $2`,
    noteId,
    userId,
  );
  await recordEvent({ userId, tool: "work", type: "work.note_deleted", refId: noteId });
}

// ── Reviews (shutdown + weekly, upsert per period) ────────────────────────

export interface WorkReviewInput {
  looseEnds?: string | null;
  tomorrowFocus?: string | null;
  wins?: string | null;
  challenges?: string | null;
  nextPriorities?: string | null;
  energy?: number | null;
}

export async function saveReview(
  userId: string,
  workspaceId: string,
  kind: "shutdown" | "weekly",
  periodKey: string,
  input: WorkReviewInput,
): Promise<void> {
  requireCan(userId, "work", "write");
  await ensureWorkTables();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "WorkReview"
       ("userId", "workspaceId", "kind", "periodKey",
        "looseEnds", "tomorrowFocus", "wins", "challenges", "nextPriorities", "energy")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT ("userId", "workspaceId", "kind", "periodKey") DO UPDATE SET
       "looseEnds" = EXCLUDED."looseEnds",
       "tomorrowFocus" = EXCLUDED."tomorrowFocus",
       "wins" = EXCLUDED."wins",
       "challenges" = EXCLUDED."challenges",
       "nextPriorities" = EXCLUDED."nextPriorities",
       "energy" = EXCLUDED."energy",
       "updatedAt" = NOW()`,
    userId,
    workspaceId,
    kind,
    periodKey,
    input.looseEnds?.trim() || null,
    input.tomorrowFocus?.trim() || null,
    input.wins?.trim() || null,
    input.challenges?.trim() || null,
    input.nextPriorities?.trim() || null,
    input.energy ?? null,
  );
  await recordEvent({ userId, tool: "work", type: "work.review_saved", meta: { kind, periodKey } });
}
