// Read-gap list endpoints for the assistant (external agent) API surface.
// The snapshot covers today/yesterday/week only; agents need full lists with
// IDs (e.g. complete_task/update_task require a taskId). Each fetcher is a
// thin wrapper over the existing service reads — no new data-access logic.
// Serializers are pure and shape rows for JSON output.

import "server-only";

import { z } from "zod";

import { listDoItems, type DoItemSummary } from "@/lib/services/do";
import { listHabits, type HabitSummary } from "@/lib/services/habits";
import { listBoardProjects, type BoardProjectCard } from "@/lib/services/projects";
import {
  listCalendarItems,
  type CalendarOccurrence,
} from "@/lib/services/calendar";

// ── Query schemas ───────────────────────────────────────────────────────────

const booleanQuery = z.preprocess(
  (v) => v === "true" || v === true,
  z.boolean(),
);

export const tasksQuerySchema = z.object({
  includeDone: booleanQuery.default(false),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export type TasksQuery = z.infer<typeof tasksQuerySchema>;

export const habitsQuerySchema = z.object({
  includeArchived: booleanQuery.default(false),
});
export type HabitsQuery = z.infer<typeof habitsQuerySchema>;

export const projectsQuerySchema = z.object({});
export type ProjectsQuery = z.infer<typeof projectsQuerySchema>;

const MAX_CALENDAR_RANGE_DAYS = 90;

export const calendarQuerySchema = z
  .object({
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
  })
  .transform(({ from, to }) => {
    const now = new Date();
    const fromDate = from ? new Date(from) : now;
    const toDate = to
      ? new Date(to)
      : new Date(fromDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { from: fromDate, to: toDate };
  })
  .refine(({ from, to }) => to.getTime() > from.getTime(), {
    message: '"to" must be after "from"',
  })
  .refine(
    ({ from, to }) =>
      to.getTime() - from.getTime() <=
      MAX_CALENDAR_RANGE_DAYS * 24 * 60 * 60 * 1000,
    { message: `Date range cannot exceed ${MAX_CALENDAR_RANGE_DAYS} days` },
  );
export type CalendarQuery = z.infer<typeof calendarQuerySchema>;

// ── Row shapes ──────────────────────────────────────────────────────────────

export interface AssistantTaskRow {
  id: string;
  title: string;
  lane: string;
  status: string;
  bucket: string | null;
  projectId: string | null;
  projectName: string | null;
  habitId: string | null;
  habitTitle: string | null;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantHabitRow {
  id: string;
  title: string;
  bucket: string;
  currentStreak: number;
  longestStreak: number;
  completedToday: boolean;
  dueToday: boolean;
  needsSaveToday: boolean;
  targetLabel: string;
  dayPartLabel: string;
}

export interface AssistantProjectRow {
  id: string;
  name: string;
  status: string;
  openTaskCount: number;
  doneTaskCount: number;
  nextAction: string | null;
  lastWorkedAt: string | null;
  daysUntilTarget: number | null;
}

export interface AssistantCalendarRow {
  id: string;
  title: string;
  kind: string;
  status: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location: string | null;
  notes: string | null;
  sourceTool: string | null;
}

// ── Serializers (pure) ──────────────────────────────────────────────────────

const iso = (d: Date | null | undefined): string | null =>
  d ? d.toISOString() : null;

export function serializeTask(item: DoItemSummary): AssistantTaskRow {
  return {
    id: item.id,
    title: item.title,
    lane: item.lane,
    status: item.status,
    bucket: item.bucket ?? null,
    projectId: item.projectId ?? null,
    projectName: item.projectName ?? null,
    habitId: item.habitId ?? null,
    habitTitle: item.habitTitle ?? null,
    estimatedMinutes: item.estimatedMinutes ?? null,
    actualMinutes: item.actualMinutes ?? null,
    notes: item.notes ?? null,
    completedAt: iso(item.completedAt),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export function serializeHabit(habit: HabitSummary): AssistantHabitRow {
  return {
    id: habit.id,
    title: habit.title,
    bucket: habit.bucket ?? "general",
    currentStreak: habit.currentStreak,
    longestStreak: habit.longestStreak,
    completedToday: habit.completedToday,
    dueToday: habit.dueToday,
    needsSaveToday: habit.needsSaveToday,
    targetLabel: habit.targetLabel,
    dayPartLabel: habit.dayPartLabel,
  };
}

export function serializeProject(project: BoardProjectCard): AssistantProjectRow {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    openTaskCount: project.openTaskCount,
    doneTaskCount: project.doneTaskCount,
    nextAction: project.nextAction ?? null,
    lastWorkedAt: iso(project.lastWorkedAt),
    daysUntilTarget: project.daysUntilTarget ?? null,
  };
}

export function serializeCalendarItem(
  item: CalendarOccurrence,
): AssistantCalendarRow {
  return {
    id: item.id,
    title: item.title,
    kind: item.kind,
    status: item.status,
    startsAt: item.startsAt.toISOString(),
    endsAt: item.endsAt.toISOString(),
    allDay: item.allDay,
    location: item.location ?? null,
    notes: item.notes ?? null,
    sourceTool: item.sourceTool ?? null,
  };
}

// ── Fetchers ────────────────────────────────────────────────────────────────

export async function fetchAssistantTasks(
  userId: string,
  query: TasksQuery,
): Promise<{ items: AssistantTaskRow[]; count: number }> {
  const items = await listDoItems(userId, {
    includeDone: query.includeDone,
    limit: query.limit,
  });
  return { items: items.map(serializeTask), count: items.length };
}

export async function fetchAssistantHabits(
  userId: string,
  query: HabitsQuery,
): Promise<{ items: AssistantHabitRow[]; count: number }> {
  const habits = await listHabits(userId, {
    includeArchived: query.includeArchived,
  });
  return { items: habits.map(serializeHabit), count: habits.length };
}

export async function fetchAssistantProjects(
  userId: string,
): Promise<{ items: AssistantProjectRow[]; count: number }> {
  const projects = await listBoardProjects(userId);
  return { items: projects.map(serializeProject), count: projects.length };
}

export async function fetchAssistantCalendar(
  userId: string,
  query: CalendarQuery,
): Promise<{ items: AssistantCalendarRow[]; count: number }> {
  const items = await listCalendarItems(userId, {
    from: query.from,
    to: query.to,
  });
  return { items: items.map(serializeCalendarItem), count: items.length };
}
