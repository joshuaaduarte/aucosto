import "server-only";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import {
  groupTasksForToday,
  meetingsOnDay,
  type WorkAreaSummary,
  type WorkMeetingSummary,
  type WorkNoteSummary,
  type WorkPersonSummary,
  type WorkProjectSummary,
  type WorkReviewSummary,
  type WorkTaskSummary,
  type WorkWorkspaceSummary,
} from "@/lib/work";
import {
  ensureWorkTables,
  rowToArea,
  rowToMeeting,
  rowToNote,
  rowToPerson,
  rowToProject,
  rowToReview,
  rowToTask,
  type AreaRow,
  type MeetingRow,
  type NoteRow,
  type PersonRow,
  type ProjectRow,
  type ReviewRow,
  type TaskRow,
  type WorkspaceRow,
} from "./shared";

// Reads power page/widget rendering — degrade to empty on failure so a
// missing table can never take down the hub (lessons #2–#4).

/**
 * The single Work workspace for now. Creates "Lucid" on first use so the
 * Work Hub is immediately usable without a seed script.
 */
export async function getOrCreateDefaultWorkspace(
  userId: string,
): Promise<WorkWorkspaceSummary | null> {
  requireCan(userId, "work", "read");
  try {
    await ensureWorkTables();
    const rows = await prisma.$queryRawUnsafe<WorkspaceRow[]>(
      `SELECT "id", "name", "description" FROM "WorkWorkspace"
       WHERE "userId" = $1 ORDER BY "createdAt" ASC LIMIT 1`,
      userId,
    );
    if (rows[0]) return rows[0];
    const created = await prisma.$queryRawUnsafe<WorkspaceRow[]>(
      `INSERT INTO "WorkWorkspace" ("userId", "name", "description")
       VALUES ($1, $2, $3)
       RETURNING "id", "name", "description"`,
      userId,
      "Lucid",
      "Job workspace — ongoing responsibilities, projects, people, and meetings at Lucid.",
    );
    return created[0] ?? null;
  } catch (error) {
    console.error("[work] getOrCreateDefaultWorkspace failed", error);
    return null;
  }
}

export async function listAreas(
  userId: string,
  workspaceId: string,
): Promise<WorkAreaSummary[]> {
  requireCan(userId, "work", "read");
  try {
    const rows = await prisma.$queryRawUnsafe<AreaRow[]>(
      `SELECT "id", "name", "description", "currentFocus", "status", "sortOrder"
       FROM "WorkArea"
       WHERE "userId" = $1 AND "workspaceId" = $2 AND "status" <> 'archived'
       ORDER BY "sortOrder" ASC, "name" ASC`,
      userId,
      workspaceId,
    );
    return rows.map(rowToArea);
  } catch (error) {
    console.error("[work] listAreas failed", error);
    return [];
  }
}

export async function listProjects(
  userId: string,
  workspaceId: string,
): Promise<WorkProjectSummary[]> {
  requireCan(userId, "work", "read");
  try {
    // Linked Aucosto Projects are canonical: name/target date flow in from the
    // Project row so edits on /app/projects show up here without duplication.
    const rows = await prisma.$queryRawUnsafe<ProjectRow[]>(
      `SELECT wp."id", wp."areaId",
              COALESCE(p."name", wp."name") AS "name",
              wp."outcome", wp."status",
              COALESCE(wp."dueDate", p."targetDate") AS "dueDate",
              COALESCE(wp."nextAction", p."nextAction") AS "nextAction",
              wp."notes", wp."updatedAt", wp."projectId",
              p."status" AS "linkedStatus"
       FROM "WorkProject" wp
       LEFT JOIN "Project" p ON p."id" = wp."projectId" AND p."userId" = wp."userId"
       WHERE wp."userId" = $1 AND wp."workspaceId" = $2
       ORDER BY CASE wp."status" WHEN 'active' THEN 0 WHEN 'waiting' THEN 1 WHEN 'paused' THEN 2 ELSE 3 END,
                "dueDate" ASC NULLS LAST, wp."updatedAt" DESC`,
      userId,
      workspaceId,
    );
    return rows.map(rowToProject);
  } catch (error) {
    console.error("[work] listProjects failed", error);
    return [];
  }
}

export async function listPeople(
  userId: string,
  workspaceId: string,
): Promise<WorkPersonSummary[]> {
  requireCan(userId, "work", "read");
  try {
    // Linked Rolodex people are canonical: the display name follows the
    // Rolodex row; the work-side role wins when set (job context can be more
    // specific than the general contact record).
    const rows = await prisma.$queryRawUnsafe<PersonRow[]>(
      `SELECT wp."id",
              COALESCE(r."displayName", wp."name") AS "name",
              COALESCE(wp."role", r."role") AS "role",
              wp."relationship", wp."team", wp."notes", wp."oneOnOneNotes",
              wp."rolodexPersonId"
       FROM "WorkPerson" wp
       LEFT JOIN "RolodexPerson" r ON r."id" = wp."rolodexPersonId" AND r."userId" = wp."userId"
       WHERE wp."userId" = $1 AND wp."workspaceId" = $2
       ORDER BY CASE wp."relationship" WHEN 'manager' THEN 0 ELSE 1 END, "name" ASC`,
      userId,
      workspaceId,
    );
    return rows.map(rowToPerson);
  } catch (error) {
    console.error("[work] listPeople failed", error);
    return [];
  }
}

export async function listMeetings(
  userId: string,
  workspaceId: string,
): Promise<WorkMeetingSummary[]> {
  requireCan(userId, "work", "read");
  try {
    // Linked CalendarItems are canonical: title/time/duration flow in from the
    // calendar so rescheduling on /app/calendar moves the work meeting too.
    const rows = await prisma.$queryRawUnsafe<MeetingRow[]>(
      `SELECT m."id",
              COALESCE(c."title", m."title") AS "title",
              COALESCE(c."startsAt", m."scheduledAt") AS "scheduledAt",
              COALESCE(
                (EXTRACT(EPOCH FROM (c."endsAt" - c."startsAt")) / 60)::int,
                m."durationMinutes"
              ) AS "durationMinutes",
              m."recurrence", m."personId", m."projectId", m."areaId",
              m."agenda", m."notes", m."status", m."calendarItemId"
       FROM "WorkMeeting" m
       LEFT JOIN "CalendarItem" c
         ON c."id" = m."calendarItemId" AND c."userId" = m."userId"
        AND c."status" <> 'cancelled'
       WHERE m."userId" = $1 AND m."workspaceId" = $2 AND m."status" <> 'archived'
       ORDER BY "scheduledAt" ASC NULLS LAST`,
      userId,
      workspaceId,
    );
    return rows.map(rowToMeeting);
  } catch (error) {
    console.error("[work] listMeetings failed", error);
    return [];
  }
}

export async function listTasks(
  userId: string,
  workspaceId: string,
  opts: { includeDoneSince?: Date } = {},
): Promise<WorkTaskSummary[]> {
  requireCan(userId, "work", "read");
  try {
    // Linked DoItems are canonical: title and completion state flow in from
    // the Do list, so checking a task off on /app/do closes it here too.
    const rows = await prisma.$queryRawUnsafe<TaskRow[]>(
      `SELECT t."id",
              COALESCE(d."title", t."title") AS "title",
              t."status", t."kind", t."dueDate", t."isImportant", t."waitingOn",
              t."notes", t."areaId", t."projectId", t."personId", t."meetingId",
              COALESCE(t."completedAt", d."completedAt") AS "completedAt",
              t."createdAt", t."doItemId",
              d."status" AS "doStatus"
       FROM "WorkTask" t
       LEFT JOIN "DoItem" d ON d."id" = t."doItemId" AND d."userId" = t."userId"
       WHERE t."userId" = $1 AND t."workspaceId" = $2
         AND (
           (t."status" <> 'done' AND COALESCE(d."status", '') <> 'done')
           OR COALESCE(t."completedAt", d."completedAt") >= $3::timestamptz
         )
       ORDER BY t."status" ASC, t."dueDate" ASC NULLS LAST, t."createdAt" ASC`,
      userId,
      workspaceId,
      (opts.includeDoneSince ?? new Date(Date.now() - 7 * 86_400_000)).toISOString(),
    );
    return rows.map(rowToTask);
  } catch (error) {
    console.error("[work] listTasks failed", error);
    return [];
  }
}

export async function listNotes(
  userId: string,
  workspaceId: string,
  opts: { limit?: number } = {},
): Promise<WorkNoteSummary[]> {
  requireCan(userId, "work", "read");
  try {
    const rows = await prisma.$queryRawUnsafe<NoteRow[]>(
      `SELECT "id", "kind", "title", "body", "resolved",
              "areaId", "projectId", "personId", "meetingId", "occurredAt"
       FROM "WorkNote"
       WHERE "userId" = $1 AND "workspaceId" = $2
       ORDER BY "occurredAt" DESC
       LIMIT $3`,
      userId,
      workspaceId,
      opts.limit ?? 100,
    );
    return rows.map(rowToNote);
  } catch (error) {
    console.error("[work] listNotes failed", error);
    return [];
  }
}

export interface WorkTodaySnapshot {
  workspaceName: string;
  meetingsToday: WorkMeetingSummary[];
  mustDo: WorkTaskSummary[];
  waitingCount: number;
}

/**
 * Composite read for the hub widget / daily planning: today's meetings plus
 * open tasks that are due, overdue, or flagged important. Null when the Work
 * domain has no workspace yet (or reads degrade).
 */
export async function getWorkTodaySnapshot(
  userId: string,
): Promise<WorkTodaySnapshot | null> {
  requireCan(userId, "work", "read");
  try {
    await ensureWorkTables();
    const rows = await prisma.$queryRawUnsafe<WorkspaceRow[]>(
      `SELECT "id", "name", "description" FROM "WorkWorkspace"
       WHERE "userId" = $1 ORDER BY "createdAt" ASC LIMIT 1`,
      userId,
    );
    const workspace = rows[0];
    if (!workspace) return null;
    const [meetings, tasks] = await Promise.all([
      listMeetings(userId, workspace.id),
      listTasks(userId, workspace.id),
    ]);
    const today = new Date();
    const grouped = groupTasksForToday(tasks, today);
    return {
      workspaceName: workspace.name,
      meetingsToday: meetingsOnDay(meetings, today),
      mustDo: grouped.mustDo,
      waitingCount: grouped.waiting.length,
    };
  } catch (error) {
    console.error("[work] getWorkTodaySnapshot failed", error);
    return null;
  }
}

export async function getReview(
  userId: string,
  workspaceId: string,
  kind: "shutdown" | "weekly",
  periodKey: string,
): Promise<WorkReviewSummary | null> {
  requireCan(userId, "work", "read");
  try {
    const rows = await prisma.$queryRawUnsafe<ReviewRow[]>(
      `SELECT "id", "kind", "periodKey", "looseEnds", "tomorrowFocus", "wins",
              "challenges", "nextPriorities", "energy", "updatedAt"
       FROM "WorkReview"
       WHERE "userId" = $1 AND "workspaceId" = $2 AND "kind" = $3 AND "periodKey" = $4
       LIMIT 1`,
      userId,
      workspaceId,
      kind,
      periodKey,
    );
    return rows[0] ? rowToReview(rows[0]) : null;
  } catch (error) {
    console.error("[work] getReview failed", error);
    return null;
  }
}
