import "server-only";

import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { normalizeDoStatus } from "@/lib/do";
import { recordEvent } from "@/lib/services/events";
import { normalizeProjectStatus, type ProjectStatus } from "@/lib/projects";
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

function startOfWeek(value: Date) {
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
  requireCan(userId, "do", "read");
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

export async function createProject(
  userId: string,
  input: SaveProjectInput,
): Promise<ProjectSummary> {
  requireCan(userId, "do", "write");
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
    tool: "do",
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
  requireCan(userId, "do", "write");
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
    tool: "do",
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
