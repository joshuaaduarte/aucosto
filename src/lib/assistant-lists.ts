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
  backingCalendarItemId,
  type CalendarOccurrence,
} from "@/lib/services/calendar";
import {
  personTimeSummary,
  type PersonTimeSummary,
} from "@/lib/services/time-people";
import {
  listEntriesForCalendarEvents,
  localDayBounds,
} from "@/lib/services/time-calendar";
import {
  listReflectionsBetween,
  type DailyReflectionRecord,
} from "@/lib/services/reflect";
import { dayKey } from "@/lib/reflect";

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

const MAX_PEOPLE_TIME_RANGE_DAYS = 90;

export const peopleTimeQuerySchema = z
  .object({
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
  })
  .transform(({ from, to }) => {
    const now = new Date();
    const toDate = to ? new Date(to) : now;
    const fromDate = from
      ? new Date(from)
      : new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { from: fromDate, to: toDate };
  })
  .refine(({ from, to }) => to.getTime() > from.getTime(), {
    message: '"to" must be after "from"',
  })
  .refine(
    ({ from, to }) =>
      to.getTime() - from.getTime() <=
      MAX_PEOPLE_TIME_RANGE_DAYS * 24 * 60 * 60 * 1000,
    { message: `Date range cannot exceed ${MAX_PEOPLE_TIME_RANGE_DAYS} days` },
  );
export type PeopleTimeQuery = z.infer<typeof peopleTimeQuerySchema>;

export interface AssistantPersonTimeRow {
  personId: string;
  displayName: string;
  totalMinutes: number;
  entryCount: number;
  byCategory: { category: string; minutes: number }[];
}

function serializePersonTime(s: PersonTimeSummary): AssistantPersonTimeRow {
  return {
    personId: s.personId,
    displayName: s.displayName,
    totalMinutes: s.totalMinutes,
    entryCount: s.entryCount,
    byCategory: s.byCategory,
  };
}

export async function fetchAssistantPeopleTime(
  userId: string,
  query: PeopleTimeQuery,
): Promise<{ items: AssistantPersonTimeRow[]; count: number }> {
  const summaries = await personTimeSummary(userId, {
    from: query.from,
    to: query.to,
  });
  return { items: summaries.map(serializePersonTime), count: summaries.length };
}

// ── Planned vs actual ───────────────────────────────────────────────────────

export const plannedVsActualQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
    .optional(),
});
export type PlannedVsActualQuery = z.infer<typeof plannedVsActualQuerySchema>;

export interface PlannedVsActualActualEntry {
  entryId: string;
  title: string;
  actualStart: string;
  actualEnd: string | null;
}

export interface PlannedVsActualBlock {
  eventId: string;
  title: string;
  plannedStart: string;
  plannedEnd: string;
  plannedMinutes: number;
  actualEntries: PlannedVsActualActualEntry[];
  /** Sum of linked *completed* entry durations (running entries are listed but excluded). */
  actualMinutes: number;
  /** actualMinutes − plannedMinutes (negative = under plan). */
  deltaMinutes: number;
  /**
   * First linked entry's start minus the block's planned start, in minutes
   * (positive = started late). Null when no entries are linked.
   */
  startDriftMinutes: number | null;
}

function roundMinutes(ms: number): number {
  return Math.round(ms / 60000);
}

/**
 * Per-block planned-vs-actual for a calendar day. Blocks with no linked
 * entries still appear (with empty actuals) so gaps are visible. Entries link
 * via TimeEntry.calendarEventId (see time-calendar service); recurring
 * occurrences match on their parent row id.
 */
export async function fetchAssistantPlannedVsActual(
  userId: string,
  query: PlannedVsActualQuery,
): Promise<{
  date: string;
  blocks: PlannedVsActualBlock[];
  count: number;
}> {
  const dayParam = query.date ?? localDatePartFor(new Date());
  const [y, m, d] = dayParam.split("-").map(Number);
  const { from, to } = localDayBounds(new Date(y!, m! - 1, d!));
  const blocks = await listCalendarItems(userId, { from, to });

  const backingIds = [...new Set(blocks.map((b) => backingCalendarItemId(b.id)))];
  const linked = await listEntriesForCalendarEvents(userId, backingIds);
  const byEvent = new Map<string, typeof linked>();
  for (const row of linked) {
    const key = row.calendarEventId ?? "";
    const list = byEvent.get(key) ?? [];
    list.push(row);
    byEvent.set(key, list);
  }

  const out: PlannedVsActualBlock[] = blocks.map((block) => {
    const entries = (byEvent.get(backingCalendarItemId(block.id)) ?? []).map(
      (e) => ({
        entryId: e.id,
        title: e.label,
        actualStart: e.startedAt.toISOString(),
        actualEnd: e.endedAt ? e.endedAt.toISOString() : null,
      }),
    );
    const actualMinutes = entries.reduce(
      (sum, e) =>
        e.actualEnd
          ? sum +
            roundMinutes(
              new Date(e.actualEnd).getTime() - new Date(e.actualStart).getTime(),
            )
          : sum,
      0,
    );
    const plannedMinutes = roundMinutes(
      block.endsAt.getTime() - block.startsAt.getTime(),
    );
    const first = entries[0];
    const startDriftMinutes = first
      ? roundMinutes(
          new Date(first.actualStart).getTime() - block.startsAt.getTime(),
        )
      : null;
    return {
      eventId: block.id,
      title: block.title,
      plannedStart: block.startsAt.toISOString(),
      plannedEnd: block.endsAt.toISOString(),
      plannedMinutes,
      actualEntries: entries,
      actualMinutes,
      deltaMinutes: actualMinutes - plannedMinutes,
      startDriftMinutes,
    };
  });

  return { date: dayParam, blocks: out, count: out.length };
}

function localDatePartFor(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

// ── Reflections trend ───────────────────────────────────────────────────────

const MAX_REFLECTIONS_RANGE_DAYS = 90;
const DEFAULT_REFLECTIONS_RANGE_DAYS = 30;

function isValidDateKey(value: string): boolean {
  const parts = value.split("-").map(Number);
  if (parts.length !== 3) return false;
  const [year, month, day] = parts;
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return false;
  }
  // Round-trip through a real calendar: rejects 2026-13-40, 2026-02-30, …
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

/** Shift a YYYY-MM-DD key by whole days, staying on UTC midnight. */
function shiftDateKey(key: string, days: number): string {
  const dt = new Date(`${key}T00:00:00.000Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Whole days between two YYYY-MM-DD keys (to − from). */
function daysBetweenKeys(from: string, to: string): number {
  const fromMs = Date.parse(`${from}T00:00:00.000Z`);
  const toMs = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((toMs - fromMs) / (24 * 60 * 60 * 1000));
}

const dateKeyString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")
  .refine(isValidDateKey, "not a real calendar date");

export const reflectionsQuerySchema = z
  .object({
    from: dateKeyString.optional(),
    to: dateKeyString.optional(),
  })
  .transform(({ from, to }) => {
    // dayKey uses the server's pinned (owner) timezone, matching the
    // date-key semantics of the DailyReflection rows.
    const toKey = to ?? dayKey(new Date());
    const fromKey = from ?? shiftDateKey(toKey, -DEFAULT_REFLECTIONS_RANGE_DAYS);
    return { from: fromKey, to: toKey };
  })
  .refine(({ from, to }) => to >= from, {
    message: '"to" must be on or after "from"',
  })
  .refine(
    ({ from, to }) =>
      daysBetweenKeys(from, to) <= MAX_REFLECTIONS_RANGE_DAYS,
    { message: `Date range cannot exceed ${MAX_REFLECTIONS_RANGE_DAYS} days` },
  );
export type ReflectionsQuery = z.infer<typeof reflectionsQuerySchema>;

export interface AssistantReflectionRow {
  date: string;
  mood: number | null;
  note: string | null;
}

export function serializeReflection(
  record: DailyReflectionRecord,
): AssistantReflectionRow {
  const parts: string[] = [];
  if (record.wentWell?.trim()) {
    parts.push(`Went well: ${record.wentWell.trim()}`);
  }
  if (record.carryForward?.trim()) {
    parts.push(`Carry forward: ${record.carryForward.trim()}`);
  }
  if (record.freeNotes?.trim()) {
    parts.push(record.freeNotes.trim());
  }
  return {
    date: record.dateKey,
    mood: record.mood ?? null,
    note: parts.length > 0 ? parts.join("\n") : null,
  };
}

export async function fetchAssistantReflections(
  userId: string,
  query: ReflectionsQuery,
): Promise<{ items: AssistantReflectionRow[]; count: number }> {
  const records = await listReflectionsBetween(userId, {
    fromKey: query.from,
    toKey: query.to,
  });
  return { items: records.map(serializeReflection), count: records.length };
}
