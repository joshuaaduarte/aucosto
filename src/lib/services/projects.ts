import "server-only";

import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { recordEvent } from "@/lib/services/events";
import { normalizeProjectStatus, type ProjectStatus } from "@/lib/projects";
import type { Project } from "@/generated/prisma/client";

export type ProjectSummary = Project & {
  status: ProjectStatus;
  openTaskCount: number;
  doneTaskCount: number;
  trackedMinutes: number;
  scheduledMinutes: number;
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

function summarize(
  project: Project & {
    doItems: Array<{
      status: string;
      timeEntries: Array<{ startedAt: Date; endedAt: Date | null }>;
    }>;
  },
  scheduledMinutes: number,
): ProjectSummary {
  const openTaskCount = project.doItems.filter((item) => item.status !== "done").length;
  const doneTaskCount = project.doItems.length - openTaskCount;
  const trackedMinutes = project.doItems.reduce((total, item) => {
    return (
      total +
      item.timeEntries.reduce((entryTotal, entry) => {
        if (!entry.endedAt) return entryTotal;
        return (
          entryTotal +
          Math.max(
            0,
            Math.round((entry.endedAt.getTime() - entry.startedAt.getTime()) / 60000),
          )
        );
      }, 0)
    );
  }, 0);

  return {
    ...project,
    status: normalizeProjectStatus(project.status),
    openTaskCount,
    doneTaskCount,
    trackedMinutes,
    scheduledMinutes,
  };
}

function cleanString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function listProjects(userId: string): Promise<ProjectSummary[]> {
  requireCan(userId, "do", "read");

  const projects = await prisma.project.findMany({
    where: { userId },
    include: {
      doItems: {
        select: {
          status: true,
          timeEntries: {
            where: { endedAt: { not: null } },
            select: { startedAt: true, endedAt: true },
          },
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  const projectIds = projects.map((project) => project.id);
  const scheduledMinutesByProject = new Map<string, number>();

  if (projectIds.length > 0) {
    const scheduled = await prisma.calendarItem.findMany({
      where: {
        userId,
        sourceTool: "do",
        status: { not: "cancelled" },
        sourceRefId: {
          in: (
            await prisma.doItem.findMany({
              where: { userId, projectId: { in: projectIds } },
              select: { id: true, projectId: true },
            })
          ).map((item) => item.id),
        },
      },
      select: {
        startsAt: true,
        endsAt: true,
        sourceRefId: true,
      },
    });

    const doItems = await prisma.doItem.findMany({
      where: { userId, projectId: { in: projectIds } },
      select: { id: true, projectId: true },
    });
    const projectByDoId = new Map(doItems.map((item) => [item.id, item.projectId]));

    for (const block of scheduled) {
      const projectId = block.sourceRefId ? projectByDoId.get(block.sourceRefId) : null;
      if (!projectId) continue;
      const duration = Math.max(
        0,
        Math.round((block.endsAt.getTime() - block.startsAt.getTime()) / 60000),
      );
      scheduledMinutesByProject.set(
        projectId,
        (scheduledMinutesByProject.get(projectId) ?? 0) + duration,
      );
    }
  }

  return projects.map((project) =>
    summarize(project, scheduledMinutesByProject.get(project.id) ?? 0),
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
          status: true,
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

  return summarize(project, 0);
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
          status: true,
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

  const linkedDoItems = await prisma.doItem.findMany({
    where: { userId, projectId: project.id },
    select: { id: true },
  });
  const schedule = linkedDoItems.length
    ? await prisma.calendarItem.findMany({
        where: {
          userId,
          sourceTool: "do",
          sourceRefId: { in: linkedDoItems.map((item) => item.id) },
          status: { not: "cancelled" },
        },
        select: { startsAt: true, endsAt: true },
      })
    : [];
  const scheduledMinutes = schedule.reduce((total, item) => {
    return (
      total +
      Math.max(0, Math.round((item.endsAt.getTime() - item.startsAt.getTime()) / 60000))
    );
  }, 0);

  return summarize(project, scheduledMinutes);
}
