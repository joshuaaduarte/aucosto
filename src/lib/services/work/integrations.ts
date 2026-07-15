// Work ↔ rest-of-Aucosto orchestration. Work is a *context layer*: tasks are
// DoItems, meetings are CalendarItems, people are RolodexPersons, and projects
// are Aucosto Projects. The functions here compose ONLY service functions
// (plus raw SQL on Work's own tables) so the owning tools stay canonical:
// creating from Work writes through the owning service, and the Work-side row
// just carries the job context (workspace, area, kind, waiting-on, agenda…).

import "server-only";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { recordEvent } from "@/lib/services/events";
import {
  createDoItem,
  deleteDoItem,
  getDoItemSummary,
  updateDoItem,
} from "@/lib/services/do";
import {
  createCalendarItem,
  updateCalendarItem,
  deleteCalendarItem,
} from "@/lib/services/calendar";
import {
  createPerson as createRolodexPerson,
  getPerson,
  listPersons,
  type RolodexPersonSummary,
} from "@/lib/services/rolodex";
import {
  createProject as createAucostoProject,
  listProjectPickerOptions,
} from "@/lib/services/projects";
import {
  filterCoworkerCandidates,
  meetingCalendarWindow,
  workTaskLane,
  type WorkMeetingSummary,
  type WorkTaskSummary,
} from "@/lib/work";
import { ensureWorkTables } from "./shared";
import { getOrCreateDefaultWorkspace, getWorkTodaySnapshot } from "./reads";
import {
  createMeeting,
  createProject,
  createTask,
  createWorkPerson,
  deleteTask,
  setTaskDone,
  updateMeeting,
  updateTask,
  type WorkMeetingInput,
  type WorkPersonInput,
  type WorkProjectInput,
  type WorkTaskInput,
} from "./mutations";

// ── Internal link lookups (Work tables only) ──────────────────────────────

async function getTaskLink(
  userId: string,
  taskId: string,
): Promise<{ doItemId: string | null } | null> {
  const rows = await prisma.$queryRawUnsafe<Array<{ doItemId: string | null }>>(
    `SELECT "doItemId" FROM "WorkTask" WHERE "id" = $1 AND "userId" = $2 LIMIT 1`,
    taskId,
    userId,
  );
  return rows[0] ?? null;
}

async function getMeetingLink(
  userId: string,
  meetingId: string,
): Promise<{
  calendarItemId: string | null;
  scheduledAt: Date | null;
  durationMinutes: number | null;
} | null> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ calendarItemId: string | null; scheduledAt: Date | null; durationMinutes: number | null }>
  >(
    `SELECT "calendarItemId", "scheduledAt", "durationMinutes"
     FROM "WorkMeeting" WHERE "id" = $1 AND "userId" = $2 LIMIT 1`,
    meetingId,
    userId,
  );
  return rows[0] ?? null;
}

// ── Tasks: canonical row is a DoItem ──────────────────────────────────────

/**
 * Create a work task backed by a real Do List item. The DoItem lands in the
 * "today" lane when due/important (so it surfaces on /app/do and the main
 * Today hub) and carries the shared "work" bucket for its context chip.
 */
export async function createWorkTask(
  userId: string,
  workspaceId: string,
  input: WorkTaskInput,
): Promise<string> {
  requireCan(userId, "work", "write");
  const doItem = await createDoItem(userId, {
    title: input.title,
    bucket: "work",
    lane: workTaskLane(input.dueDate ?? null, input.isImportant ?? false, new Date()),
    status: input.waitingOn?.trim() ? "waiting" : undefined,
    notes: input.notes,
  });
  return createTask(userId, workspaceId, { ...input, doItemId: doItem.id });
}

/** Update a work task and mirror the shared fields onto its DoItem. */
export async function updateWorkTask(
  userId: string,
  taskId: string,
  patch: Partial<WorkTaskInput> & { status?: string },
): Promise<void> {
  requireCan(userId, "work", "write");
  const link = await getTaskLink(userId, taskId);
  await updateTask(userId, taskId, patch);
  if (!link?.doItemId) return;
  const laneRelevant = patch.dueDate !== undefined || patch.isImportant !== undefined;
  // Only touch the DoItem's status when waiting-ness actually changes — a
  // plain edit must not stomp an in_progress / scheduled state on the Do side.
  const doItem = await getDoItemSummary(userId, link.doItemId);
  const status =
    patch.status === "waiting" && doItem?.status !== "waiting"
      ? ("waiting" as const)
      : patch.status === "open" && doItem?.status === "waiting"
        ? ("ready" as const)
        : undefined;
  await updateDoItem(userId, link.doItemId, {
    title: patch.title,
    notes: patch.notes,
    lane: laneRelevant
      ? workTaskLane(patch.dueDate ?? null, patch.isImportant ?? false, new Date())
      : undefined,
    status,
  });
}

/** Complete/reopen a work task in both Work and the Do list. */
export async function setWorkTaskDone(
  userId: string,
  taskId: string,
  done: boolean,
): Promise<void> {
  requireCan(userId, "work", "write");
  const link = await getTaskLink(userId, taskId);
  await setTaskDone(userId, taskId, done);
  if (link?.doItemId) {
    await updateDoItem(userId, link.doItemId, { status: done ? "done" : "ready" });
  }
}

/** Delete a work task together with its backing DoItem. */
export async function deleteWorkTask(userId: string, taskId: string): Promise<void> {
  requireCan(userId, "work", "write");
  const link = await getTaskLink(userId, taskId);
  await deleteTask(userId, taskId);
  if (link?.doItemId) {
    await deleteDoItem(userId, link.doItemId);
  }
}

// ── Meetings: canonical row is a CalendarItem ─────────────────────────────

/**
 * Create a work meeting; when scheduled, the occurrence is saved as a real
 * CalendarItem (sourceTool "work") so it shows on /app/calendar. Recurrence
 * stays a Work-side concept — the calendar carries the next occurrence.
 */
export async function createWorkMeeting(
  userId: string,
  workspaceId: string,
  input: WorkMeetingInput,
): Promise<string> {
  requireCan(userId, "work", "write");
  const meetingId = await createMeeting(userId, workspaceId, input);
  if (input.scheduledAt) {
    const { startsAt, endsAt } = meetingCalendarWindow(
      input.scheduledAt,
      input.durationMinutes,
    );
    const item = await createCalendarItem(userId, {
      title: input.title,
      startsAt,
      endsAt,
      kind: "meeting",
      notes: input.agenda ?? null,
      sourceTool: "work",
      sourceRefId: meetingId,
    });
    await updateMeeting(userId, meetingId, { calendarItemId: item.id });
  }
  return meetingId;
}

/**
 * Update a work meeting and keep its CalendarItem in sync: reschedule moves
 * the block, clearing the time removes it, adding a time creates it.
 */
export async function updateWorkMeeting(
  userId: string,
  meetingId: string,
  patch: Partial<WorkMeetingInput> & { status?: string },
): Promise<void> {
  requireCan(userId, "work", "write");
  const link = await getMeetingLink(userId, meetingId);
  await updateMeeting(userId, meetingId, patch);
  if (!link) return;

  const scheduledAt =
    patch.scheduledAt !== undefined
      ? patch.scheduledAt
      : link.scheduledAt
        ? link.scheduledAt.toISOString()
        : null;

  if (link.calendarItemId && !scheduledAt) {
    await deleteCalendarItem(userId, link.calendarItemId);
    await updateMeeting(userId, meetingId, { calendarItemId: null });
    return;
  }
  if (!scheduledAt) return;

  const durationMinutes =
    patch.durationMinutes !== undefined ? patch.durationMinutes : link.durationMinutes;
  const { startsAt, endsAt } = meetingCalendarWindow(scheduledAt, durationMinutes);

  if (link.calendarItemId) {
    const updated = await updateCalendarItem(userId, link.calendarItemId, {
      title: patch.title,
      startsAt,
      endsAt,
      notes: patch.agenda,
    });
    if (updated) return;
    // The calendar item was deleted out-of-band — fall through and recreate.
  }
  const item = await createCalendarItem(userId, {
    title: patch.title ?? "Meeting",
    startsAt,
    endsAt,
    kind: "meeting",
    notes: patch.agenda ?? null,
    sourceTool: "work",
    sourceRefId: meetingId,
  });
  await updateMeeting(userId, meetingId, { calendarItemId: item.id });
}

/** Archive a work meeting and remove its CalendarItem from the calendar. */
export async function archiveWorkMeeting(
  userId: string,
  meetingId: string,
): Promise<void> {
  requireCan(userId, "work", "write");
  const link = await getMeetingLink(userId, meetingId);
  await updateMeeting(userId, meetingId, { status: "archived", calendarItemId: null });
  if (link?.calendarItemId) {
    await deleteCalendarItem(userId, link.calendarItemId);
  }
}

// ── People: canonical row is a RolodexPerson ──────────────────────────────

/**
 * Add a new coworker from Work: creates the person in the Rolodex (as a
 * coworker at the workspace's organization) and links them into the workspace.
 */
export async function createCoworker(
  userId: string,
  workspaceId: string,
  workspaceName: string,
  input: WorkPersonInput,
): Promise<string> {
  requireCan(userId, "work", "write");
  const rolodexPersonId = await createRolodexPerson(userId, {
    displayName: input.name,
    relationshipType: "coworker",
    organization: workspaceName,
    role: input.role ?? null,
  });
  return createWorkPerson(userId, workspaceId, { ...input, rolodexPersonId });
}

/** Link an existing Rolodex person into the workspace (idempotent). */
export async function linkCoworker(
  userId: string,
  workspaceId: string,
  rolodexPersonId: string,
  extras: { relationship?: string | null } = {},
): Promise<string> {
  requireCan(userId, "work", "write");
  await ensureWorkTables();
  const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT "id" FROM "WorkPerson"
     WHERE "userId" = $1 AND "workspaceId" = $2 AND "rolodexPersonId" = $3 LIMIT 1`,
    userId,
    workspaceId,
    rolodexPersonId,
  );
  if (existing[0]) return existing[0].id;

  const person = await getPerson(userId, rolodexPersonId);
  if (!person) throw new Error("That Rolodex person could not be found.");
  const id = await createWorkPerson(userId, workspaceId, {
    name: person.displayName,
    relationship: extras.relationship ?? null,
    rolodexPersonId,
  });
  await recordEvent({
    userId,
    tool: "work",
    type: "work.person_linked",
    refId: id,
    meta: { rolodexPersonId, displayName: person.displayName },
  });
  return id;
}

// ── Projects: canonical row is an Aucosto Project ─────────────────────────

/**
 * Create a work project backed by a real Aucosto Project (bucket "work"), so
 * it shows on /app/projects with time tracking, tasks, and momentum intact.
 */
export async function createLinkedWorkProject(
  userId: string,
  workspaceId: string,
  input: WorkProjectInput,
): Promise<string> {
  requireCan(userId, "work", "write");
  const project = await createAucostoProject(userId, {
    name: input.name,
    summary: input.outcome ?? null,
    targetDate: input.dueDate ? new Date(input.dueDate) : null,
    notes: input.notes ?? null,
    bucket: "work",
  });
  return createProject(userId, workspaceId, { ...input, linkedProjectId: project.id });
}

/** Mark an existing Aucosto Project as part of the workspace (idempotent). */
export async function linkExistingProject(
  userId: string,
  workspaceId: string,
  projectId: string,
  extras: { areaId?: string | null } = {},
): Promise<string> {
  requireCan(userId, "work", "write");
  await ensureWorkTables();
  const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT "id" FROM "WorkProject"
     WHERE "userId" = $1 AND "workspaceId" = $2 AND "projectId" = $3 LIMIT 1`,
    userId,
    workspaceId,
    projectId,
  );
  if (existing[0]) return existing[0].id;

  // Ownership check goes through the projects service, not raw SQL.
  const options = await listProjectPickerOptions(userId);
  const match = options.find((option) => option.id === projectId);
  if (!match) throw new Error("That project could not be found.");

  const id = await createProject(userId, workspaceId, {
    name: match.name,
    linkedProjectId: projectId,
    areaId: extras.areaId ?? null,
  });
  await recordEvent({
    userId,
    tool: "work",
    type: "work.project_linked",
    refId: id,
    meta: { projectId, name: match.name },
  });
  return id;
}

/**
 * Rolodex people who look like coworkers at the workspace (organization match
 * or relationshipType "coworker") and aren't linked into it yet.
 */
export async function listCoworkerCandidates(
  userId: string,
  workspaceId: string,
  workspaceName: string,
): Promise<RolodexPersonSummary[]> {
  requireCan(userId, "work", "read");
  try {
    await ensureWorkTables();
    const [persons, linked] = await Promise.all([
      listPersons(userId),
      prisma.$queryRawUnsafe<Array<{ rolodexPersonId: string | null }>>(
        `SELECT "rolodexPersonId" FROM "WorkPerson"
         WHERE "userId" = $1 AND "workspaceId" = $2`,
        userId,
        workspaceId,
      ),
    ]);
    return filterCoworkerCandidates(
      persons,
      linked.map((row) => row.rolodexPersonId),
      workspaceName,
    );
  } catch (error) {
    console.error("[work] listCoworkerCandidates failed", error);
    return [];
  }
}

/** Aucosto Projects that could still be linked into the workspace. */
export async function listUnlinkedProjectOptions(
  userId: string,
  workspaceId: string,
): Promise<Array<{ id: string; name: string }>> {
  requireCan(userId, "work", "read");
  try {
    await ensureWorkTables();
    const [options, linked] = await Promise.all([
      listProjectPickerOptions(userId),
      prisma.$queryRawUnsafe<Array<{ projectId: string | null }>>(
        `SELECT "projectId" FROM "WorkProject"
         WHERE "userId" = $1 AND "workspaceId" = $2`,
        userId,
        workspaceId,
      ),
    ]);
    const linkedIds = new Set(linked.map((row) => row.projectId).filter(Boolean));
    return options
      .filter((option) => !linkedIds.has(option.id))
      .map((option) => ({ id: option.id, name: option.name }));
  } catch (error) {
    console.error("[work] listUnlinkedProjectOptions failed", error);
    return [];
  }
}

// ── Cross-surface reads (degrade to empty — they decorate other tools) ────

export interface DoItemWorkContext {
  workTaskId: string;
  workspaceId: string;
  workspaceName: string;
}

/** Map of DoItem id → work context, for chips/filters on /app/do. */
export async function getWorkContextForDoItems(
  userId: string,
): Promise<Map<string, DoItemWorkContext>> {
  requireCan(userId, "work", "read");
  const map = new Map<string, DoItemWorkContext>();
  try {
    await ensureWorkTables();
    const rows = await prisma.$queryRawUnsafe<
      Array<{ doItemId: string; id: string; workspaceId: string; name: string }>
    >(
      `SELECT t."doItemId", t."id", w."id" AS "workspaceId", w."name"
       FROM "WorkTask" t
       JOIN "WorkWorkspace" w ON w."id" = t."workspaceId"
       WHERE t."userId" = $1 AND t."doItemId" IS NOT NULL`,
      userId,
    );
    for (const row of rows) {
      map.set(row.doItemId, {
        workTaskId: row.id,
        workspaceId: row.workspaceId,
        workspaceName: row.name,
      });
    }
  } catch (error) {
    console.error("[work] getWorkContextForDoItems failed", error);
  }
  return map;
}

export interface RolodexWorkContext {
  workPersonId: string;
  workspaceName: string;
  relationship: string | null;
  team: string | null;
  role: string | null;
}

/** Workspaces a Rolodex person is linked into, for their detail page. */
export async function getWorkContextForRolodexPerson(
  userId: string,
  rolodexPersonId: string,
): Promise<RolodexWorkContext[]> {
  requireCan(userId, "work", "read");
  try {
    await ensureWorkTables();
    return await prisma.$queryRawUnsafe<RolodexWorkContext[]>(
      `SELECT p."id" AS "workPersonId", w."name" AS "workspaceName",
              p."relationship", p."team", p."role"
       FROM "WorkPerson" p
       JOIN "WorkWorkspace" w ON w."id" = p."workspaceId"
       WHERE p."userId" = $1 AND p."rolodexPersonId" = $2`,
      userId,
      rolodexPersonId,
    );
  } catch (error) {
    console.error("[work] getWorkContextForRolodexPerson failed", error);
    return [];
  }
}

/** Map of Aucosto Project id → workspace name, for chips on /app/projects. */
export async function getWorkspaceNamesByProjectId(
  userId: string,
): Promise<Map<string, string>> {
  requireCan(userId, "work", "read");
  const map = new Map<string, string>();
  try {
    await ensureWorkTables();
    const rows = await prisma.$queryRawUnsafe<
      Array<{ projectId: string; name: string }>
    >(
      `SELECT p."projectId", w."name"
       FROM "WorkProject" p
       JOIN "WorkWorkspace" w ON w."id" = p."workspaceId"
       WHERE p."userId" = $1 AND p."projectId" IS NOT NULL`,
      userId,
    );
    for (const row of rows) map.set(row.projectId, row.name);
  } catch (error) {
    console.error("[work] getWorkspaceNamesByProjectId failed", error);
  }
  return map;
}

// ── Assistant snapshot summary ─────────────────────────────────────────────

export interface WorkAssistantSummary {
  workspaceName: string;
  meetingsToday: Array<Pick<WorkMeetingSummary, "title" | "scheduledAt">>;
  mustDo: Array<Pick<WorkTaskSummary, "title" | "dueDate" | "isImportant">>;
  waitingCount: number;
  unresolvedDecisionCount: number;
  activeProjectCount: number;
}

/**
 * Compact Work rollup for the assistant snapshot: today's meetings, must-do
 * tasks, waiting-on count, open decisions, and active linked projects.
 */
export async function getWorkAssistantSummary(
  userId: string,
): Promise<WorkAssistantSummary | null> {
  requireCan(userId, "work", "read");
  try {
    const workspace = await getOrCreateDefaultWorkspace(userId);
    if (!workspace) return null;
    const snapshot = await getWorkTodaySnapshot(userId);
    if (!snapshot) return null;
    const counts = await prisma.$queryRawUnsafe<
      Array<{ decisions: bigint; projects: bigint }>
    >(
      `SELECT
         (SELECT COUNT(*) FROM "WorkNote"
           WHERE "userId" = $1 AND "workspaceId" = $2
             AND "kind" = 'decision' AND "resolved" = false) AS "decisions",
         (SELECT COUNT(*) FROM "WorkProject" wp
           LEFT JOIN "Project" p ON p."id" = wp."projectId" AND p."userId" = wp."userId"
           WHERE wp."userId" = $1 AND wp."workspaceId" = $2
             AND COALESCE(p."status", wp."status") NOT IN ('done', 'paused')) AS "projects"`,
      userId,
      workspace.id,
    );
    return {
      workspaceName: snapshot.workspaceName,
      meetingsToday: snapshot.meetingsToday.map((m) => ({
        title: m.title,
        scheduledAt: m.scheduledAt,
      })),
      mustDo: snapshot.mustDo.map((t) => ({
        title: t.title,
        dueDate: t.dueDate,
        isImportant: t.isImportant,
      })),
      waitingCount: snapshot.waitingCount,
      unresolvedDecisionCount: Number(counts[0]?.decisions ?? 0),
      activeProjectCount: Number(counts[0]?.projects ?? 0),
    };
  } catch (error) {
    console.error("[work] getWorkAssistantSummary failed", error);
    return null;
  }
}
