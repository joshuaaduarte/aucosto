import "server-only";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requireCan } from "@/lib/auth/can";
import { normalizeDoStatus } from "@/lib/do";
import {
  countDoTasksByProject,
  deleteDoItemsByProject,
  listDoTasksForProject,
} from "@/lib/services/do";
import { recordEvent } from "@/lib/services/events";
import { listHabits } from "@/lib/services/habits";
import {
  computeMomentum,
  mergeProjectTasks,
  mergeTaskCounts,
  normalizeBoardStatus,
  normalizeEnergyType,
  normalizeProjectStatus,
  type BoardStatus,
  type EnergyType,
  type Momentum,
  type ProjectStatus,
  type ProjectTaskView,
} from "@/lib/projects";
import type { Project } from "@/generated/prisma/client";

export type ProjectLinkedTaskSummary = {
  id: string;
  title: string;
  lane: string;
  status: ReturnType<typeof normalizeDoStatus>;
  estimatedMinutes: number | null;
  trackedMinutes: number;
  scheduledMinutes: number;
  scheduledCount: number;
  lastWorkedAt: Date | null;
  updatedAt: Date;
};

export type ProjectBlockSummary = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  doItemId: string | null;
};

export type ProjectHealthFlag = {
  tone: "warning" | "muted";
  message: string;
};

export type ProjectSummary = Project & {
  status: ProjectStatus;
  openTaskCount: number;
  doneTaskCount: number;
  trackedMinutes: number;
  scheduledMinutes: number;
  scheduledThisWeekMinutes: number;
  todayTaskCount: number;
  waitingTaskCount: number;
  readyTaskCount: number;
  inProgressTaskCount: number;
  lastWorkedAt: Date | null;
  nextScheduledAt: Date | null;
  linkedTasks: ProjectLinkedTaskSummary[];
  upcomingBlocks: ProjectBlockSummary[];
  healthFlags: ProjectHealthFlag[];
};

export type SaveProjectInput = {
  name: string;
  status?: ProjectStatus;
  bucket?: string | null;
  summary?: string | null;
  nextMilestone?: string | null;
  targetDate?: Date | null;
  notes?: string | null;
};

type ProjectRow = Project & {
  doItems: Array<{
    id: string;
    title: string;
    lane: string;
    status: string;
    estimatedMinutes: number | null;
    lastWorkedAt: Date | null;
    updatedAt: Date;
    timeEntries: Array<{ startedAt: Date; endedAt: Date | null }>;
  }>;
};

function cleanString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

// Monday-based start of the week containing `value` (defaults to now, matching
// the no-arg signature the board queries below rely on).
function startOfWeek(value: Date = new Date()) {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  const day = next.getDay();
  const offset = (day + 6) % 7;
  next.setDate(next.getDate() - offset);
  return next;
}

function endOfWeek(value: Date) {
  const next = startOfWeek(value);
  next.setDate(next.getDate() + 7);
  return next;
}

function summarizeTrackedMinutes(entries: Array<{ startedAt: Date; endedAt: Date | null }>) {
  return entries.reduce((total, entry) => {
    if (!entry.endedAt) return total;
    return (
      total +
      Math.max(
        0,
        Math.round((entry.endedAt.getTime() - entry.startedAt.getTime()) / 60000),
      )
    );
  }, 0);
}

function buildHealthFlags(
  project: Project,
  taskSummaries: ProjectLinkedTaskSummary[],
  upcomingBlocks: ProjectBlockSummary[],
  scheduledThisWeekMinutes: number,
  lastWorkedAt: Date | null,
  now: Date,
): ProjectHealthFlag[] {
  const flags: ProjectHealthFlag[] = [];
  const activeTasks = taskSummaries.filter((task) => task.status !== "done");
  const executableTasks = activeTasks.filter((task) => task.status !== "waiting");
  const todayTasks = executableTasks.filter((task) => task.lane === "today");
  const waitingTasks = activeTasks.filter((task) => task.status === "waiting");

  if (project.status !== "done" && executableTasks.length === 0) {
    flags.push({ tone: "warning", message: "No next task is ready yet." });
  }

  if (project.status === "active" && todayTasks.length === 0) {
    flags.push({ tone: "muted", message: "Nothing is marked for today yet." });
  }

  if (waitingTasks.length >= 3) {
    flags.push({
      tone: "warning",
      message: `${waitingTasks.length} tasks are stuck waiting.`,
    });
  }

  if (project.status !== "done" && scheduledThisWeekMinutes === 0) {
    flags.push({ tone: "warning", message: "No calendar time is protected this week." });
  }

  if (project.targetDate && project.targetDate.getTime() < now.getTime() && project.status !== "done") {
    flags.push({ tone: "warning", message: "Target date has passed." });
  } else if (project.targetDate && project.status !== "done") {
    const hasBlockBeforeTarget = upcomingBlocks.some(
      (block) => block.startsAt.getTime() <= project.targetDate!.getTime(),
    );
    if (!hasBlockBeforeTarget) {
      flags.push({
        tone: "warning",
        message: "Target date is set, but no work is scheduled before it.",
      });
    }
  }

  if (project.status !== "done") {
    if (!lastWorkedAt) {
      flags.push({ tone: "muted", message: "No time has been tracked on this yet." });
    } else {
      const staleDays = Math.floor(
        (now.getTime() - lastWorkedAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (staleDays >= 7) {
        flags.push({
          tone: "warning",
          message: `No progress has been tracked for ${staleDays} days.`,
        });
      }
    }
  }

  return flags.slice(0, 4);
}

function summarize(
  project: ProjectRow,
  options: {
    scheduledByTask: Map<string, { scheduledMinutes: number; scheduledCount: number }>;
    blocksByProject: Map<string, ProjectBlockSummary[]>;
    now: Date;
  },
): ProjectSummary {
  const linkedTasks = project.doItems.map((item) => {
    const scheduled = options.scheduledByTask.get(item.id);
    return {
      id: item.id,
      title: item.title,
      lane: item.lane,
      status: normalizeDoStatus(item.status),
      estimatedMinutes: item.estimatedMinutes,
      trackedMinutes: summarizeTrackedMinutes(item.timeEntries),
      scheduledMinutes: scheduled?.scheduledMinutes ?? 0,
      scheduledCount: scheduled?.scheduledCount ?? 0,
      lastWorkedAt: item.lastWorkedAt,
      updatedAt: item.updatedAt,
    };
  });

  linkedTasks.sort((a, b) => {
    if (a.status === "done" && b.status !== "done") return 1;
    if (a.status !== "done" && b.status === "done") return -1;
    if (a.status === "waiting" && b.status !== "waiting") return 1;
    if (a.status !== "waiting" && b.status === "waiting") return -1;
    if (a.lane === "today" && b.lane !== "today") return -1;
    if (a.lane !== "today" && b.lane === "today") return 1;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  const upcomingBlocks = (options.blocksByProject.get(project.id) ?? [])
    .slice()
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const trackedMinutes = linkedTasks.reduce((total, task) => total + task.trackedMinutes, 0);
  const scheduledMinutes = linkedTasks.reduce((total, task) => total + task.scheduledMinutes, 0);
  const scheduledThisWeekMinutes = upcomingBlocks.reduce((total, block) => {
    const weekStart = startOfWeek(options.now);
    const weekEnd = endOfWeek(options.now);
    if (block.startsAt < weekStart || block.startsAt >= weekEnd) return total;
    return total + Math.max(0, Math.round((block.endsAt.getTime() - block.startsAt.getTime()) / 60000));
  }, 0);

  const openTaskCount = linkedTasks.filter((task) => task.status !== "done").length;
  const doneTaskCount = linkedTasks.length - openTaskCount;
  const todayTaskCount = linkedTasks.filter(
    (task) => task.status !== "done" && task.status !== "waiting" && task.lane === "today",
  ).length;
  const waitingTaskCount = linkedTasks.filter((task) => task.status === "waiting").length;
  const readyTaskCount = linkedTasks.filter(
    (task) => task.status === "ready" || task.status === "scheduled",
  ).length;
  const inProgressTaskCount = linkedTasks.filter((task) => task.status === "in_progress").length;
  const lastWorkedAt = linkedTasks.reduce<Date | null>((latest, task) => {
    if (!task.lastWorkedAt) return latest;
    if (!latest || task.lastWorkedAt.getTime() > latest.getTime()) {
      return task.lastWorkedAt;
    }
    return latest;
  }, null);
  const nextScheduledAt = upcomingBlocks[0]?.startsAt ?? null;

  return {
    ...project,
    status: normalizeProjectStatus(project.status),
    openTaskCount,
    doneTaskCount,
    trackedMinutes,
    scheduledMinutes,
    scheduledThisWeekMinutes,
    todayTaskCount,
    waitingTaskCount,
    readyTaskCount,
    inProgressTaskCount,
    lastWorkedAt,
    nextScheduledAt,
    linkedTasks,
    upcomingBlocks: upcomingBlocks.slice(0, 4),
    healthFlags: buildHealthFlags(
      project,
      linkedTasks,
      upcomingBlocks,
      scheduledThisWeekMinutes,
      lastWorkedAt,
      options.now,
    ),
  };
}

export async function listProjects(userId: string): Promise<ProjectSummary[]> {
  requireCan(userId, "projects", "read");
  const now = new Date();

  const projects = await prisma.project.findMany({
    where: { userId },
    include: {
      doItems: {
        select: {
          id: true,
          title: true,
          lane: true,
          status: true,
          estimatedMinutes: true,
          lastWorkedAt: true,
          updatedAt: true,
          timeEntries: {
            where: { endedAt: { not: null } },
            select: { startedAt: true, endedAt: true },
          },
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  const allDoItemIds = projects.flatMap((project) => project.doItems.map((item) => item.id));
  const scheduledByTask = new Map<string, { scheduledMinutes: number; scheduledCount: number }>();
  const blocksByProject = new Map<string, ProjectBlockSummary[]>();
  const projectByDoId = new Map<string, string>();

  for (const project of projects) {
    for (const task of project.doItems) {
      projectByDoId.set(task.id, project.id);
    }
  }

  if (allDoItemIds.length > 0) {
    const calendarItems = await prisma.calendarItem.findMany({
      where: {
        userId,
        sourceTool: "do",
        sourceRefId: { in: allDoItemIds },
        status: { not: "cancelled" },
        endsAt: { gte: now },
      },
      select: {
        id: true,
        title: true,
        startsAt: true,
        endsAt: true,
        sourceRefId: true,
      },
      orderBy: { startsAt: "asc" },
    });

    for (const block of calendarItems) {
      if (!block.sourceRefId) continue;
      const duration = Math.max(
        0,
        Math.round((block.endsAt.getTime() - block.startsAt.getTime()) / 60000),
      );
      const currentTask = scheduledByTask.get(block.sourceRefId) ?? {
        scheduledMinutes: 0,
        scheduledCount: 0,
      };
      currentTask.scheduledMinutes += duration;
      currentTask.scheduledCount += 1;
      scheduledByTask.set(block.sourceRefId, currentTask);

      const projectId = projectByDoId.get(block.sourceRefId);
      if (!projectId) continue;
      const blocks = blocksByProject.get(projectId) ?? [];
      blocks.push({
        id: block.id,
        title: block.title,
        startsAt: block.startsAt,
        endsAt: block.endsAt,
        doItemId: block.sourceRefId,
      });
      blocksByProject.set(projectId, blocks);
    }
  }

  return projects.map((project) =>
    summarize(project, {
      scheduledByTask,
      blocksByProject,
      now,
    }),
  );
}

export type ProjectTimeEntry = {
  id: string;
  label: string;
  taskTitle: string | null;
  startedAt: Date;
  endedAt: Date | null;
  minutes: number;
};

export type ProjectDetail = {
  project: ProjectSummary;
  timeEntries: ProjectTimeEntry[];
};

/** Single project (summary + recent linked time entries) for the detail page. */
export async function getProjectDetail(
  userId: string,
  id: string,
): Promise<ProjectDetail | null> {
  requireCan(userId, "projects", "read");
  const now = new Date();

  const project = await prisma.project.findFirst({
    where: { userId, id },
    include: {
      doItems: {
        select: {
          id: true,
          title: true,
          lane: true,
          status: true,
          estimatedMinutes: true,
          lastWorkedAt: true,
          updatedAt: true,
          timeEntries: {
            where: { endedAt: { not: null } },
            select: { startedAt: true, endedAt: true },
          },
        },
      },
    },
  });
  if (!project) return null;

  const taskIds = project.doItems.map((item) => item.id);
  const scheduledByTask = new Map<
    string,
    { scheduledMinutes: number; scheduledCount: number }
  >();
  const blocksByProject = new Map<string, ProjectBlockSummary[]>();

  if (taskIds.length > 0) {
    const blocks = await prisma.calendarItem.findMany({
      where: {
        userId,
        sourceTool: "do",
        sourceRefId: { in: taskIds },
        status: { not: "cancelled" },
        endsAt: { gte: now },
      },
      select: {
        id: true,
        title: true,
        startsAt: true,
        endsAt: true,
        sourceRefId: true,
      },
      orderBy: { startsAt: "asc" },
    });

    for (const block of blocks) {
      if (!block.sourceRefId) continue;
      const duration = Math.max(
        0,
        Math.round((block.endsAt.getTime() - block.startsAt.getTime()) / 60000),
      );
      const current = scheduledByTask.get(block.sourceRefId) ?? {
        scheduledMinutes: 0,
        scheduledCount: 0,
      };
      current.scheduledMinutes += duration;
      current.scheduledCount += 1;
      scheduledByTask.set(block.sourceRefId, current);

      const list = blocksByProject.get(project.id) ?? [];
      list.push({
        id: block.id,
        title: block.title,
        startsAt: block.startsAt,
        endsAt: block.endsAt,
        doItemId: block.sourceRefId,
      });
      blocksByProject.set(project.id, list);
    }
  }

  const summary = summarize(project, { scheduledByTask, blocksByProject, now });

  let timeEntries: ProjectTimeEntry[] = [];
  if (taskIds.length > 0) {
    const entries = await prisma.timeEntry.findMany({
      where: { userId, doItemId: { in: taskIds } },
      select: {
        id: true,
        label: true,
        startedAt: true,
        endedAt: true,
        doItem: { select: { title: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 25,
    });
    timeEntries = entries.map((entry) => ({
      id: entry.id,
      label: entry.label,
      taskTitle: entry.doItem?.title ?? null,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
      minutes: entry.endedAt
        ? Math.max(
            0,
            Math.round((entry.endedAt.getTime() - entry.startedAt.getTime()) / 60000),
          )
        : 0,
    }));
  }

  return { project: summary, timeEntries };
}

/** Archive (or restore) a project. Stored as the "archived" status value. */
export async function setProjectArchived(
  userId: string,
  id: string,
  archived: boolean,
): Promise<ProjectSummary | null> {
  return updateProject(userId, id, { status: archived ? "archived" : "active" });
}

export async function createProject(
  userId: string,
  input: SaveProjectInput,
): Promise<ProjectSummary> {
  requireCan(userId, "projects", "write");
  const name = input.name.trim();
  if (!name) throw new Error("Project name is required.");

  const project = await prisma.project.create({
    data: {
      userId,
      name,
      status: normalizeProjectStatus(input.status),
      bucket: cleanString(input.bucket),
      summary: cleanString(input.summary),
      nextMilestone: cleanString(input.nextMilestone),
      targetDate: input.targetDate ?? null,
      notes: cleanString(input.notes),
    },
    include: {
      doItems: {
        select: {
          id: true,
          title: true,
          lane: true,
          status: true,
          estimatedMinutes: true,
          lastWorkedAt: true,
          updatedAt: true,
          timeEntries: {
            where: { endedAt: { not: null } },
            select: { startedAt: true, endedAt: true },
          },
        },
      },
    },
  });

  await recordEvent({
    userId,
    tool: "projects",
    type: "project.created",
    refId: project.id,
    meta: { name: project.name, status: project.status },
  });

  return summarize(project, {
    scheduledByTask: new Map(),
    blocksByProject: new Map(),
    now: new Date(),
  });
}

export async function updateProject(
  userId: string,
  id: string,
  input: Partial<SaveProjectInput>,
): Promise<ProjectSummary | null> {
  requireCan(userId, "projects", "write");
  const existing = await prisma.project.findFirst({ where: { userId, id } });
  if (!existing) return null;

  const project = await prisma.project.update({
    where: { id },
    data: {
      name: input.name === undefined ? undefined : input.name.trim(),
      status: input.status === undefined ? undefined : normalizeProjectStatus(input.status),
      bucket: input.bucket === undefined ? undefined : cleanString(input.bucket),
      summary: input.summary === undefined ? undefined : cleanString(input.summary),
      nextMilestone:
        input.nextMilestone === undefined ? undefined : cleanString(input.nextMilestone),
      targetDate: input.targetDate === undefined ? undefined : input.targetDate,
      notes: input.notes === undefined ? undefined : cleanString(input.notes),
    },
    include: {
      doItems: {
        select: {
          id: true,
          title: true,
          lane: true,
          status: true,
          estimatedMinutes: true,
          lastWorkedAt: true,
          updatedAt: true,
          timeEntries: {
            where: { endedAt: { not: null } },
            select: { startedAt: true, endedAt: true },
          },
        },
      },
    },
  });

  await recordEvent({
    userId,
    tool: "projects",
    type: "project.updated",
    refId: project.id,
    meta: { name: project.name, status: project.status },
  });

  const now = new Date();
  const linkedTaskIds = project.doItems.map((item) => item.id);
  const scheduledByTask = new Map<string, { scheduledMinutes: number; scheduledCount: number }>();
  const blocksByProject = new Map<string, ProjectBlockSummary[]>();

  if (linkedTaskIds.length > 0) {
    const schedule = await prisma.calendarItem.findMany({
      where: {
        userId,
        sourceTool: "do",
        sourceRefId: { in: linkedTaskIds },
        status: { not: "cancelled" },
        endsAt: { gte: now },
      },
      select: {
        id: true,
        title: true,
        startsAt: true,
        endsAt: true,
        sourceRefId: true,
      },
      orderBy: { startsAt: "asc" },
    });

    for (const block of schedule) {
      if (!block.sourceRefId) continue;
      const duration = Math.max(
        0,
        Math.round((block.endsAt.getTime() - block.startsAt.getTime()) / 60000),
      );
      const currentTask = scheduledByTask.get(block.sourceRefId) ?? {
        scheduledMinutes: 0,
        scheduledCount: 0,
      };
      currentTask.scheduledMinutes += duration;
      currentTask.scheduledCount += 1;
      scheduledByTask.set(block.sourceRefId, currentTask);

      const blocks = blocksByProject.get(project.id) ?? [];
      blocks.push({
        id: block.id,
        title: block.title,
        startsAt: block.startsAt,
        endsAt: block.endsAt,
        doItemId: block.sourceRefId,
      });
      blocksByProject.set(project.id, blocks);
    }
  }

  return summarize(project, { scheduledByTask, blocksByProject, now });
}

/**
 * Delete a project. By default linked tasks survive as standalone Do items
 * (DoItem.projectId is SetNull); with deleteTasks they're removed too —
 * project tasks (ProjectTask rows) are ALWAYS cascade-deleted with the project,
 * and time entries survive but are unlinked (TimeEntry.projectId is SetNull).
 */
export async function deleteProject(
  userId: string,
  id: string,
  options: { deleteTasks?: boolean } = {},
): Promise<void> {
  requireCan(userId, "projects", "write");
  let deletedTaskCount = 0;
  if (options.deleteTasks) {
    deletedTaskCount = await deleteDoItemsByProject(userId, id);
  }
  const { count } = await prisma.project.deleteMany({ where: { id, userId } });
  if (count > 0) {
    await recordEvent({
      userId,
      tool: "projects",
      type: "project.deleted",
      refId: id,
      meta: { deletedTaskCount },
    });
  }
}

export interface ProjectDeleteImpact {
  /** ProjectTask rows — cascade-deleted with the project, always. */
  projectTaskCount: number;
  /** Do items — deleted only when deleteTasks is set, otherwise unlinked. */
  doItemCount: number;
  /** Time entries — kept, but unlinked from the project. */
  timeEntryCount: number;
}

/**
 * Counts what a project deletion will destroy or unlink. Read-only; used by
 * the assistant delete_project preview so the blast radius is explicit.
 */
export async function getProjectDeleteImpact(
  userId: string,
  id: string,
): Promise<ProjectDeleteImpact> {
  requireCan(userId, "projects", "read");
  try {
    const rows = await prisma.$queryRaw<
      Array<{ project_task_count: bigint; do_item_count: bigint; time_entry_count: bigint }>
    >(Prisma.sql`
      SELECT
        (SELECT COUNT(*) FROM "ProjectTask" WHERE "userId" = ${userId} AND "projectId" = ${id}) AS project_task_count,
        (SELECT COUNT(*) FROM "DoItem" WHERE "userId" = ${userId} AND "projectId" = ${id}) AS do_item_count,
        (SELECT COUNT(*) FROM "TimeEntry" WHERE "userId" = ${userId} AND "projectId" = ${id}) AS time_entry_count
    `);
    const row = rows[0];
    return {
      projectTaskCount: Number(row?.project_task_count ?? 0),
      doItemCount: Number(row?.do_item_count ?? 0),
      timeEntryCount: Number(row?.time_entry_count ?? 0),
    };
  } catch (error) {
    console.error("[projects] getProjectDeleteImpact failed", error);
    return { projectTaskCount: 0, doItemCount: 0, timeEntryCount: 0 };
  }
}

// ===========================================================================
// Rebuilt Projects board (raw SQL).
//
// The richer board model (Area, ProjectTask, Project.intent/energyType/…,
// TimeEntry.projectId) is applied to the live DB via
// scripts/consolidate-runtime-ddl.sql — not `prisma migrate` — so all access here goes through raw SQL, mirroring
// the reflect.ts pattern. Reads degrade to empty so a page never 500s before
// the tables exist; writes surface a clear "not migrated yet" error.
// ===========================================================================

/**
 * True when the board tables/columns are missing (e.g. a fresh DB that hasn't
 * had scripts/consolidate-runtime-ddl.sql applied). Match on error CODES first — the pg adapter rewrites
 * messages (see reflect.ts for the full war story).
 *   P2021 / 42P01 = missing table; 42703 = missing column.
 */
function isMissingBoardSchema(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021") return true;
    if (error.code === "P2010") {
      const meta = JSON.stringify(error.meta ?? {});
      return meta.includes("42P01") || meta.includes("42703");
    }
  }
  return (
    error instanceof Error &&
    (error.message.includes("42P01") ||
      error.message.includes("42703") ||
      ((error.message.includes("ProjectTask") || error.message.includes("Area")) &&
        error.message.includes("does not exist")))
  );
}

function notMigrated(): never {
  throw new Error(
    "The Projects tables aren't ready yet — reload the Projects page and try again.",
  );
}

export type AreaRecord = { id: string; name: string; color: string };

export type BoardProjectCard = {
  id: string;
  name: string;
  intent: string | null;
  status: BoardStatus;
  energyType: EnergyType;
  timeBudgetMinutes: number | null;
  targetDate: Date | null;
  nextAction: string | null;
  area: AreaRecord | null;
  updatedAt: Date;
  weekMinutes: number;
  totalMinutes: number;
  lastWorkedAt: Date | null;
  openTaskCount: number;
  doneTaskCount: number;
  daysUntilTarget: number | null;
  momentum: Momentum;
};

/** A row on the project task tab: a board task or a linked Do List task. */
export type ProjectTaskRecord = ProjectTaskView;

export type ProjectTimeRow = {
  id: string;
  label: string;
  category: string | null;
  notes: string | null;
  startedAt: Date;
  endedAt: Date | null;
  minutes: number;
};

export type LinkedHabitInfo = { id: string; title: string; streak: number };

export type BoardProjectDetail = {
  project: BoardProjectCard;
  tasks: ProjectTaskRecord[];
  timeEntries: ProjectTimeRow[];
  health: {
    weekMinutes: number;
    totalMinutes: number;
    timeBudgetMinutes: number | null;
    budgetPct: number | null;
    calendarBlocksThisWeek: number;
    linkedHabit: LinkedHabitInfo | null;
    lastDeepWork: { label: string; minutes: number; at: Date } | null;
  };
};

export type WeekAllocationSegment = {
  projectId: string | null;
  name: string;
  color: string;
  minutes: number;
};

export type WeekAllocation = {
  totalMinutes: number;
  segments: WeekAllocationSegment[];
};

export type EntryProjectTag = {
  entryId: string;
  projectId: string;
  name: string;
  color: string;
};

export type ProjectPickerOption = { id: string; name: string; color: string };

const BOARD_STATUS_RANK: Record<BoardStatus, number> = {
  active: 0,
  exploring: 1,
  final_push: 2,
  paused: 3,
  done: 4,
};

function startOfDayLocal(value: Date): Date {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function daysUntil(target: Date | null, now: Date): number | null {
  if (!target) return null;
  return Math.round(
    (startOfDayLocal(target).getTime() - startOfDayLocal(now).getTime()) / 86_400_000,
  );
}

type ProjectRowRaw = {
  id: string;
  name: string;
  intent: string | null;
  status: string | null;
  energyType: string | null;
  timeBudgetMinutes: number | null;
  targetDate: Date | null;
  nextAction: string | null;
  updatedAt: Date;
  areaId: string | null;
  areaName: string | null;
  areaColor: string | null;
};

type TimeAggRow = {
  projectId: string;
  weekMinutes: number;
  rolling7Minutes: number;
  rolling14Minutes: number;
  totalMinutes: number;
  lastWorkedAt: Date | null;
};

const PROJECT_SELECT = Prisma.sql`
  p."id", p."name", p."intent", p."status", p."energyType",
  p."timeBudgetMinutes", p."targetDate", p."nextAction", p."updatedAt",
  p."areaId", a."name" AS "areaName", a."color" AS "areaColor"
`;

function buildCard(row: ProjectRowRaw, time: TimeAggRow | undefined, tasks: { open: number; done: number } | undefined, now: Date): BoardProjectCard {
  const status = normalizeBoardStatus(row.status);
  const totalMinutes = time?.totalMinutes ?? 0;
  const timeBudgetMinutes = row.timeBudgetMinutes ?? null;
  const days = daysUntil(row.targetDate, now);
  const momentum = computeMomentum({
    status,
    weekMinutes: time?.rolling7Minutes ?? 0,
    twoWeekMinutes: time?.rolling14Minutes ?? 0,
    daysUntilTarget: days,
    budgetUsedFraction:
      timeBudgetMinutes && timeBudgetMinutes > 0 ? totalMinutes / timeBudgetMinutes : null,
  });
  return {
    id: row.id,
    name: row.name,
    intent: row.intent,
    status,
    energyType: normalizeEnergyType(row.energyType),
    timeBudgetMinutes,
    targetDate: row.targetDate,
    nextAction: row.nextAction,
    area: row.areaId
      ? { id: row.areaId, name: row.areaName ?? "Area", color: row.areaColor ?? "#6366f1" }
      : null,
    updatedAt: row.updatedAt,
    weekMinutes: time?.weekMinutes ?? 0,
    totalMinutes,
    lastWorkedAt: time?.lastWorkedAt ?? null,
    openTaskCount: tasks?.open ?? 0,
    doneTaskCount: tasks?.done ?? 0,
    daysUntilTarget: days,
    momentum,
  };
}

async function loadTimeAggregates(userId: string, now: Date): Promise<Map<string, TimeAggRow>> {
  const weekStart = startOfWeek();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86_400_000);
  const rows = await prisma.$queryRaw<TimeAggRow[]>(Prisma.sql`
    SELECT "projectId",
      COALESCE(ROUND(SUM(CASE WHEN "endedAt" IS NOT NULL AND "startedAt" >= ${weekStart} THEN EXTRACT(EPOCH FROM ("endedAt" - "startedAt")) / 60 ELSE 0 END)), 0)::int AS "weekMinutes",
      COALESCE(ROUND(SUM(CASE WHEN "endedAt" IS NOT NULL AND "startedAt" >= ${sevenDaysAgo} THEN EXTRACT(EPOCH FROM ("endedAt" - "startedAt")) / 60 ELSE 0 END)), 0)::int AS "rolling7Minutes",
      COALESCE(ROUND(SUM(CASE WHEN "endedAt" IS NOT NULL AND "startedAt" >= ${fourteenDaysAgo} THEN EXTRACT(EPOCH FROM ("endedAt" - "startedAt")) / 60 ELSE 0 END)), 0)::int AS "rolling14Minutes",
      COALESCE(ROUND(SUM(CASE WHEN "endedAt" IS NOT NULL THEN EXTRACT(EPOCH FROM ("endedAt" - "startedAt")) / 60 ELSE 0 END)), 0)::int AS "totalMinutes",
      MAX("startedAt") AS "lastWorkedAt"
    FROM "TimeEntry"
    WHERE "userId" = ${userId} AND "projectId" IS NOT NULL
    GROUP BY "projectId"
  `);
  const map = new Map<string, TimeAggRow>();
  for (const row of rows) map.set(row.projectId, row);
  return map;
}

async function loadTaskCounts(userId: string): Promise<Map<string, { open: number; done: number }>> {
  const rows = await prisma.$queryRaw<Array<{ projectId: string; openCount: number; doneCount: number }>>(Prisma.sql`
    SELECT "projectId",
      COUNT(*) FILTER (WHERE "done" = false)::int AS "openCount",
      COUNT(*) FILTER (WHERE "done" = true)::int AS "doneCount"
    FROM "ProjectTask"
    WHERE "userId" = ${userId}
    GROUP BY "projectId"
  `);
  const map = new Map<string, { open: number; done: number }>();
  for (const row of rows) map.set(row.projectId, { open: row.openCount, done: row.doneCount });
  // Do List tasks linked to a project count too — otherwise a project with
  // five linked tasks reads "0 open tasks" on the board and in the snapshot.
  return mergeTaskCounts(map, await loadLinkedDoCounts(userId));
}

/** Linked Do List counts; an unexpected failure must not take the board down. */
async function loadLinkedDoCounts(userId: string): Promise<Map<string, { open: number; done: number }>> {
  try {
    return await countDoTasksByProject(userId);
  } catch (error) {
    console.error("[projects] linked Do List task counts failed", error);
    return new Map();
  }
}

export async function listBoardProjects(userId: string): Promise<BoardProjectCard[]> {
  requireCan(userId, "projects", "read");
  const now = new Date();
  try {
    const [projects, timeAgg, taskCounts] = await Promise.all([
      prisma.$queryRaw<ProjectRowRaw[]>(Prisma.sql`
        SELECT ${PROJECT_SELECT}
        FROM "Project" p
        LEFT JOIN "Area" a ON a."id" = p."areaId"
        WHERE p."userId" = ${userId}
        ORDER BY p."updatedAt" DESC
      `),
      loadTimeAggregates(userId, now),
      loadTaskCounts(userId),
    ]);
    const cards = projects.map((row) =>
      buildCard(row, timeAgg.get(row.id), taskCounts.get(row.id), now),
    );
    cards.sort((a, b) => {
      const rank = BOARD_STATUS_RANK[a.status] - BOARD_STATUS_RANK[b.status];
      if (rank !== 0) return rank;
      const aWorked = a.lastWorkedAt?.getTime() ?? 0;
      const bWorked = b.lastWorkedAt?.getTime() ?? 0;
      if (aWorked !== bWorked) return bWorked - aWorked;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
    return cards;
  } catch (error) {
    if (!isMissingBoardSchema(error)) {
      console.error("[projects] listBoardProjects failed", error);
    }
    return [];
  }
}

export async function listAreas(userId: string): Promise<AreaRecord[]> {
  requireCan(userId, "projects", "read");
  try {
    return await prisma.$queryRaw<AreaRecord[]>(Prisma.sql`
      SELECT "id", "name", "color" FROM "Area"
      WHERE "userId" = ${userId}
      ORDER BY "createdAt" ASC
    `);
  } catch (error) {
    if (!isMissingBoardSchema(error)) {
      console.error("[projects] listAreas failed", error);
    }
    return [];
  }
}

export async function createArea(
  userId: string,
  input: { name: string; color: string },
): Promise<AreaRecord> {
  requireCan(userId, "projects", "write");
  const name = input.name.trim();
  if (!name) throw new Error("Area name is required.");
  const id = randomUUID();
  try {
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "Area" ("id", "userId", "name", "color", "createdAt")
      VALUES (${id}, ${userId}, ${name}, ${input.color}, now())
    `);
  } catch (error) {
    if (isMissingBoardSchema(error)) notMigrated();
    throw error;
  }
  await recordEvent({ userId, tool: "projects", type: "project.area_created", refId: id, meta: { name } });
  return { id, name, color: input.color };
}

export type SaveBoardProjectInput = {
  name: string;
  areaId?: string | null;
  intent?: string | null;
  // Free-form: normalized to a BoardStatus / EnergyType inside the service.
  status?: string | null;
  energyType?: string | null;
  timeBudgetMinutes?: number | null;
  targetDate?: Date | null;
};

export async function createBoardProject(
  userId: string,
  input: SaveBoardProjectInput,
): Promise<string> {
  requireCan(userId, "projects", "write");
  const name = input.name.trim();
  if (!name) throw new Error("Project name is required.");
  const id = randomUUID();
  const status = normalizeBoardStatus(input.status);
  const energyType = normalizeEnergyType(input.energyType);
  try {
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "Project" (
        "id", "userId", "areaId", "name", "intent", "status", "energyType",
        "timeBudgetMinutes", "targetDate", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${userId}, ${input.areaId ?? null}, ${name},
        ${input.intent?.trim() || null}, ${status}, ${energyType},
        ${input.timeBudgetMinutes ?? null}::int, ${input.targetDate ?? null}::timestamptz,
        now(), now()
      )
    `);
  } catch (error) {
    if (isMissingBoardSchema(error)) notMigrated();
    throw error;
  }
  await recordEvent({ userId, tool: "projects", type: "project.created", refId: id, meta: { name, status } });
  return id;
}

export async function updateBoardProject(
  userId: string,
  id: string,
  input: SaveBoardProjectInput,
): Promise<void> {
  requireCan(userId, "projects", "write");
  const name = input.name.trim();
  if (!name) throw new Error("Project name is required.");
  const status = normalizeBoardStatus(input.status);
  const energyType = normalizeEnergyType(input.energyType);
  try {
    const affected = await prisma.$executeRaw(Prisma.sql`
      UPDATE "Project" SET
        "name" = ${name},
        "areaId" = ${input.areaId ?? null},
        "intent" = ${input.intent?.trim() || null},
        "status" = ${status},
        "energyType" = ${energyType},
        "timeBudgetMinutes" = ${input.timeBudgetMinutes ?? null}::int,
        "targetDate" = ${input.targetDate ?? null}::timestamptz,
        "updatedAt" = now()
      WHERE "id" = ${id} AND "userId" = ${userId}
    `);
    if (affected === 0) return;
  } catch (error) {
    if (isMissingBoardSchema(error)) notMigrated();
    throw error;
  }
  await recordEvent({ userId, tool: "projects", type: "project.updated", refId: id, meta: { name, status } });
}

export async function archiveBoardProject(userId: string, id: string): Promise<void> {
  requireCan(userId, "projects", "write");
  try {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "Project" SET "status" = 'done', "updatedAt" = now()
      WHERE "id" = ${id} AND "userId" = ${userId}
    `);
  } catch (error) {
    if (isMissingBoardSchema(error)) notMigrated();
    throw error;
  }
  await recordEvent({ userId, tool: "projects", type: "project.updated", refId: id, meta: { status: "done" } });
}

/** Recompute Project.nextAction from the top open task. */
async function syncNextAction(userId: string, projectId: string): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ title: string }>>(Prisma.sql`
    SELECT "title" FROM "ProjectTask"
    WHERE "userId" = ${userId} AND "projectId" = ${projectId} AND "done" = false
    ORDER BY "isToday" DESC, "sortOrder" ASC, "createdAt" ASC
    LIMIT 1
  `);
  const next = rows[0]?.title ?? null;
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "Project" SET "nextAction" = ${next}, "updatedAt" = now()
    WHERE "id" = ${projectId} AND "userId" = ${userId}
  `);
}

/** The task tab's rows: board tasks plus Do List tasks linked to the project. */
async function loadProjectTasks(userId: string, projectId: string): Promise<ProjectTaskRecord[]> {
  const [boardTasks, doTasks] = await Promise.all([
    prisma.$queryRaw<Omit<ProjectTaskRecord, "source">[]>(Prisma.sql`
      SELECT "id", "title", "done", "isToday", "sortOrder", "createdAt"
      FROM "ProjectTask"
      WHERE "userId" = ${userId} AND "projectId" = ${projectId}
      ORDER BY "done" ASC, "isToday" DESC, "sortOrder" ASC, "createdAt" ASC
    `),
    listDoTasksForProject(userId, projectId).catch((error) => {
      console.error("[projects] linked Do List tasks failed", error);
      return [];
    }),
  ]);
  return mergeProjectTasks(boardTasks, doTasks);
}

export async function createProjectTask(
  userId: string,
  projectId: string,
  title: string,
  options: { isToday?: boolean } = {},
): Promise<void> {
  requireCan(userId, "projects", "write");
  const clean = title.trim();
  if (!clean) throw new Error("Task title is required.");
  const id = randomUUID();
  try {
    const next = await prisma.$queryRaw<Array<{ next: number }>>(Prisma.sql`
      SELECT COALESCE(MAX("sortOrder"), 0) + 1 AS "next" FROM "ProjectTask"
      WHERE "userId" = ${userId} AND "projectId" = ${projectId}
    `);
    const sortOrder = next[0]?.next ?? 1;
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "ProjectTask" ("id", "projectId", "userId", "title", "isToday", "sortOrder", "createdAt")
      VALUES (${id}, ${projectId}, ${userId}, ${clean}, ${options.isToday ?? false}, ${sortOrder}, now())
    `);
    await syncNextAction(userId, projectId);
  } catch (error) {
    if (isMissingBoardSchema(error)) notMigrated();
    throw error;
  }
  await recordEvent({ userId, tool: "projects", type: "project.task_created", refId: projectId, meta: { title: clean } });
}

export async function updateProjectTask(
  userId: string,
  id: string,
  patch: { title?: string; done?: boolean; isToday?: boolean },
): Promise<void> {
  requireCan(userId, "projects", "write");
  try {
    const rows = await prisma.$queryRaw<Array<{ projectId: string }>>(Prisma.sql`
      SELECT "projectId" FROM "ProjectTask" WHERE "id" = ${id} AND "userId" = ${userId} LIMIT 1
    `);
    const projectId = rows[0]?.projectId;
    if (!projectId) return;
    const title = patch.title?.trim();
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "ProjectTask" SET
        "title" = COALESCE(${title ?? null}, "title"),
        "done" = COALESCE(${patch.done ?? null}, "done"),
        "isToday" = COALESCE(${patch.isToday ?? null}, "isToday")
      WHERE "id" = ${id} AND "userId" = ${userId}
    `);
    await syncNextAction(userId, projectId);
    if (patch.done === true) {
      await recordEvent({ userId, tool: "projects", type: "project.task_completed", refId: projectId });
    }
  } catch (error) {
    if (isMissingBoardSchema(error)) notMigrated();
    throw error;
  }
}

export async function completeProjectTask(userId: string, id: string): Promise<void> {
  return updateProjectTask(userId, id, { done: true });
}

/** Complete the current top open task (the one surfaced as nextAction). */
export async function completeTopOpenTask(userId: string, projectId: string): Promise<void> {
  requireCan(userId, "projects", "write");
  let taskId: string | undefined;
  try {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "ProjectTask"
      WHERE "userId" = ${userId} AND "projectId" = ${projectId} AND "done" = false
      ORDER BY "isToday" DESC, "sortOrder" ASC, "createdAt" ASC
      LIMIT 1
    `);
    taskId = rows[0]?.id;
  } catch (error) {
    if (isMissingBoardSchema(error)) notMigrated();
    throw error;
  }
  if (taskId) await updateProjectTask(userId, taskId, { done: true });
}

export async function reorderProjectTasks(
  userId: string,
  projectId: string,
  orderedIds: string[],
): Promise<void> {
  requireCan(userId, "projects", "write");
  try {
    for (let index = 0; index < orderedIds.length; index += 1) {
      const taskId = orderedIds[index];
      if (!taskId) continue;
      await prisma.$executeRaw(Prisma.sql`
        UPDATE "ProjectTask" SET "sortOrder" = ${index}
        WHERE "id" = ${taskId} AND "userId" = ${userId} AND "projectId" = ${projectId}
      `);
    }
    await syncNextAction(userId, projectId);
  } catch (error) {
    if (isMissingBoardSchema(error)) notMigrated();
    throw error;
  }
}

export async function tagTimeEntry(
  userId: string,
  entryId: string,
  projectId: string | null,
): Promise<void> {
  requireCan(userId, "projects", "write");
  try {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "TimeEntry" SET "projectId" = ${projectId}
      WHERE "id" = ${entryId} AND "userId" = ${userId}
    `);
  } catch (error) {
    if (isMissingBoardSchema(error)) notMigrated();
    throw error;
  }
  await recordEvent({ userId, tool: "projects", type: "project.entry_tagged", refId: projectId ?? undefined, meta: { entryId } });
}

export async function startTimerForProject(userId: string, projectId: string): Promise<void> {
  requireCan(userId, "projects", "write");
  try {
    const rows = await prisma.$queryRaw<Array<{ name: string }>>(Prisma.sql`
      SELECT "name" FROM "Project" WHERE "id" = ${projectId} AND "userId" = ${userId} LIMIT 1
    `);
    const name = rows[0]?.name;
    if (!name) throw new Error("Project not found.");
    // Stop any running timer, then open a new one tagged to this project.
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "TimeEntry" SET "endedAt" = now() WHERE "userId" = ${userId} AND "endedAt" IS NULL
    `);
    const id = randomUUID();
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "TimeEntry" ("id", "userId", "projectId", "label", "startedAt", "createdAt")
      VALUES (${id}, ${userId}, ${projectId}, ${name}, now(), now())
    `);
    await recordEvent({ userId, tool: "projects", type: "project.timer_started", refId: projectId, meta: { label: name } });
  } catch (error) {
    if (isMissingBoardSchema(error)) notMigrated();
    throw error;
  }
}

export async function getBoardProject(
  userId: string,
  id: string,
): Promise<BoardProjectDetail | null> {
  requireCan(userId, "projects", "read");
  const now = new Date();
  try {
    const rows = await prisma.$queryRaw<ProjectRowRaw[]>(Prisma.sql`
      SELECT ${PROJECT_SELECT}
      FROM "Project" p
      LEFT JOIN "Area" a ON a."id" = p."areaId"
      WHERE p."userId" = ${userId} AND p."id" = ${id}
      LIMIT 1
    `);
    const row = rows[0];
    if (!row) return null;

    const [timeAgg, taskCounts] = await Promise.all([
      loadTimeAggregates(userId, now),
      loadTaskCounts(userId),
    ]);
    const project = buildCard(row, timeAgg.get(id), taskCounts.get(id), now);

    const [tasks, timeRows, lastDeep, habitAgg, calendarBlocksThisWeek] = await Promise.all([
      loadProjectTasks(userId, id),
      prisma.$queryRaw<ProjectTimeRow[]>(Prisma.sql`
        SELECT "id", "label", "category", "notes", "startedAt", "endedAt",
          CASE WHEN "endedAt" IS NOT NULL
            THEN ROUND(EXTRACT(EPOCH FROM ("endedAt" - "startedAt")) / 60)::int
            ELSE 0 END AS "minutes"
        FROM "TimeEntry"
        WHERE "userId" = ${userId} AND "projectId" = ${id}
        ORDER BY "startedAt" DESC
        LIMIT 30
      `),
      prisma.$queryRaw<Array<{ label: string; minutes: number; at: Date }>>(Prisma.sql`
        SELECT "label",
          ROUND(EXTRACT(EPOCH FROM ("endedAt" - "startedAt")) / 60)::int AS "minutes",
          "endedAt" AS "at"
        FROM "TimeEntry"
        WHERE "userId" = ${userId} AND "projectId" = ${id} AND "endedAt" IS NOT NULL
        ORDER BY "endedAt" DESC
        LIMIT 1
      `),
      prisma.$queryRaw<Array<{ habitId: string; minutes: number }>>(Prisma.sql`
        SELECT "habitId",
          COALESCE(ROUND(SUM(CASE WHEN "endedAt" IS NOT NULL THEN EXTRACT(EPOCH FROM ("endedAt" - "startedAt")) / 60 ELSE 0 END)), 0)::int AS "minutes"
        FROM "TimeEntry"
        WHERE "userId" = ${userId} AND "projectId" = ${id} AND "habitId" IS NOT NULL
        GROUP BY "habitId"
        ORDER BY "minutes" DESC
        LIMIT 1
      `),
      prisma.calendarItem.count({
        where: {
          userId,
          sourceTool: "project",
          sourceRefId: id,
          status: { not: "cancelled" },
          startsAt: { gte: startOfWeek() },
        },
      }),
    ]);

    let linkedHabit: LinkedHabitInfo | null = null;
    const topHabitId = habitAgg[0]?.habitId;
    if (topHabitId) {
      const habits = await listHabits(userId, { includeArchived: true });
      const match = habits.find((habit) => habit.id === topHabitId);
      if (match) {
        linkedHabit = {
          id: match.id,
          title: match.title,
          streak: match.keptAliveStreak ?? 0,
        };
      }
    }

    const lastDeepRow = lastDeep[0];
    const timeBudgetMinutes = project.timeBudgetMinutes;
    const budgetPct =
      timeBudgetMinutes && timeBudgetMinutes > 0
        ? Math.round((project.totalMinutes / timeBudgetMinutes) * 100)
        : null;

    return {
      project,
      tasks,
      timeEntries: timeRows,
      health: {
        weekMinutes: project.weekMinutes,
        totalMinutes: project.totalMinutes,
        timeBudgetMinutes,
        budgetPct,
        calendarBlocksThisWeek,
        linkedHabit,
        lastDeepWork: lastDeepRow
          ? { label: lastDeepRow.label, minutes: lastDeepRow.minutes, at: lastDeepRow.at }
          : null,
      },
    };
  } catch (error) {
    if (!isMissingBoardSchema(error)) {
      console.error("[projects] getBoardProject failed", error);
    }
    return null;
  }
}

export async function getWeekAllocation(userId: string): Promise<WeekAllocation> {
  requireCan(userId, "projects", "read");
  const weekStart = startOfWeek();
  try {
    const rows = await prisma.$queryRaw<Array<{ projectId: string | null; name: string | null; color: string | null; minutes: number }>>(Prisma.sql`
      SELECT te."projectId",
        p."name", a."color",
        COALESCE(ROUND(SUM(EXTRACT(EPOCH FROM (COALESCE(te."endedAt", now()) - te."startedAt")) / 60)), 0)::int AS "minutes"
      FROM "TimeEntry" te
      LEFT JOIN "Project" p ON p."id" = te."projectId"
      LEFT JOIN "Area" a ON a."id" = p."areaId"
      WHERE te."userId" = ${userId}
        AND te."startedAt" >= ${weekStart}
        AND (te."endedAt" IS NULL OR te."endedAt" > te."startedAt")
      GROUP BY te."projectId", p."name", a."color"
    `);
    const segments: WeekAllocationSegment[] = rows
      .filter((row) => row.minutes > 0)
      .map((row) => ({
        projectId: row.projectId,
        name: row.projectId ? row.name ?? "Project" : "Untagged",
        color: row.projectId ? row.color ?? "#94a3b8" : "#cbd5e1",
        minutes: row.minutes,
      }))
      .sort((a, b) => {
        if (a.projectId === null) return 1;
        if (b.projectId === null) return -1;
        return b.minutes - a.minutes;
      });
    const totalMinutes = segments.reduce((sum, seg) => sum + seg.minutes, 0);
    return { totalMinutes, segments };
  } catch (error) {
    if (!isMissingBoardSchema(error)) {
      console.error("[projects] getWeekAllocation failed", error);
    }
    return { totalMinutes: 0, segments: [] };
  }
}

/** Project tags for a batch of time-entry ids (time tracker chips). */
export async function listEntryProjectTags(
  userId: string,
  entryIds: string[],
): Promise<EntryProjectTag[]> {
  requireCan(userId, "projects", "read");
  if (entryIds.length === 0) return [];
  try {
    return await prisma.$queryRaw<EntryProjectTag[]>(Prisma.sql`
      SELECT te."id" AS "entryId", te."projectId", p."name", COALESCE(a."color", '#94a3b8') AS "color"
      FROM "TimeEntry" te
      JOIN "Project" p ON p."id" = te."projectId"
      LEFT JOIN "Area" a ON a."id" = p."areaId"
      WHERE te."userId" = ${userId}
        AND te."projectId" IS NOT NULL
        AND te."id" IN (${Prisma.join(entryIds)})
    `);
  } catch (error) {
    if (!isMissingBoardSchema(error)) {
      console.error("[projects] listEntryProjectTags failed", error);
    }
    return [];
  }
}

/** Lightweight {id,name,color} list for the time tracker's project picker. */
export async function listProjectPickerOptions(userId: string): Promise<ProjectPickerOption[]> {
  requireCan(userId, "projects", "read");
  try {
    return await prisma.$queryRaw<ProjectPickerOption[]>(Prisma.sql`
      SELECT p."id", p."name", COALESCE(a."color", '#94a3b8') AS "color"
      FROM "Project" p
      LEFT JOIN "Area" a ON a."id" = p."areaId"
      WHERE p."userId" = ${userId} AND p."status" <> 'done'
      ORDER BY p."updatedAt" DESC
    `);
  } catch (error) {
    if (!isMissingBoardSchema(error)) {
      console.error("[projects] listProjectPickerOptions failed", error);
    }
    return [];
  }
}
