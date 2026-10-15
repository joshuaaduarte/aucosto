import { describe, expect, it } from "vitest";
import {
  calendarQuerySchema,
  habitsQuerySchema,
  serializeCalendarItem,
  serializeHabit,
  serializeProject,
  serializeTask,
  tasksQuerySchema,
  type AssistantCalendarRow,
} from "@/lib/assistant-lists";
import type { DoItemSummary } from "@/lib/services/do";
import type { HabitSummary } from "@/lib/services/habits";
import type { BoardProjectCard } from "@/lib/services/projects";
import type { CalendarOccurrence } from "@/lib/services/calendar";

// ── query schemas ───────────────────────────────────────────────────────────

describe("tasksQuerySchema", () => {
  it("applies defaults", () => {
    expect(tasksQuerySchema.parse({})).toEqual({
      includeDone: false,
      limit: 100,
    });
  });

  it("coerces string query params", () => {
    expect(
      tasksQuerySchema.parse({ includeDone: "true", limit: "25" }),
    ).toEqual({ includeDone: true, limit: 25 });
  });

  it('treats "false" as false', () => {
    expect(tasksQuerySchema.parse({ includeDone: "false" }).includeDone).toBe(
      false,
    );
  });

  it("rejects out-of-range limits", () => {
    expect(() => tasksQuerySchema.parse({ limit: "0" })).toThrow();
    expect(() => tasksQuerySchema.parse({ limit: "201" })).toThrow();
    expect(() => tasksQuerySchema.parse({ limit: "abc" })).toThrow();
  });
});

describe("habitsQuerySchema", () => {
  it("applies defaults and coerces", () => {
    expect(habitsQuerySchema.parse({})).toEqual({ includeArchived: false });
    expect(habitsQuerySchema.parse({ includeArchived: "true" })).toEqual({
      includeArchived: true,
    });
  });
});

describe("calendarQuerySchema", () => {
  it("defaults to now through +7 days", () => {
    const before = Date.now();
    const parsed = calendarQuerySchema.parse({});
    const after = Date.now();
    expect(parsed.from.getTime()).toBeGreaterThanOrEqual(before);
    expect(parsed.from.getTime()).toBeLessThanOrEqual(after);
    expect(parsed.to.getTime() - parsed.from.getTime()).toBe(
      7 * 24 * 60 * 60 * 1000,
    );
  });

  it("accepts explicit from/to", () => {
    const parsed = calendarQuerySchema.parse({
      from: "2026-10-14T00:00:00-07:00",
      to: "2026-10-21T00:00:00-07:00",
    });
    expect(parsed.from.toISOString()).toBe("2026-10-14T07:00:00.000Z");
    expect(parsed.to.toISOString()).toBe("2026-10-21T07:00:00.000Z");
  });

  it("rejects to before from", () => {
    expect(() =>
      calendarQuerySchema.parse({
        from: "2026-10-21T00:00:00-07:00",
        to: "2026-10-14T00:00:00-07:00",
      }),
    ).toThrow(/must be after/);
  });

  it("rejects ranges over 90 days", () => {
    expect(() =>
      calendarQuerySchema.parse({
        from: "2026-01-01T00:00:00-08:00",
        to: "2026-06-01T00:00:00-07:00",
      }),
    ).toThrow(/cannot exceed 90 days/);
  });

  it("rejects non-datetime strings", () => {
    expect(() =>
      calendarQuerySchema.parse({ from: "not-a-date" }),
    ).toThrow();
  });
});

// ── serializers ─────────────────────────────────────────────────────────────

const baseTask = {
  id: "task_1",
  userId: "u1",
  projectId: "p1",
  habitId: null,
  title: "Write the report",
  bucket: "today",
  lane: "next",
  status: "open",
  estimatedMinutes: 30,
  actualMinutes: null,
  notes: "draft first",
  completedAt: null,
  lastWorkedAt: null,
  createdAt: new Date("2026-10-13T10:00:00.000Z"),
  updatedAt: new Date("2026-10-14T10:00:00.000Z"),
  trackedMinutes: 0,
  effectiveActualMinutes: null,
  scheduledMinutes: 0,
  scheduledCount: 0,
  projectName: "Aucosto",
  habitTitle: null,
} as unknown as DoItemSummary;

describe("serializeTask", () => {
  it("maps the stable row shape with ISO dates", () => {
    const row = serializeTask(baseTask);
    expect(row).toEqual({
      id: "task_1",
      title: "Write the report",
      lane: "next",
      status: "open",
      bucket: "today",
      projectId: "p1",
      projectName: "Aucosto",
      habitId: null,
      habitTitle: null,
      estimatedMinutes: 30,
      actualMinutes: null,
      notes: "draft first",
      completedAt: null,
      createdAt: "2026-10-13T10:00:00.000Z",
      updatedAt: "2026-10-14T10:00:00.000Z",
    });
  });
});

describe("serializeHabit", () => {
  it("maps the stable row shape", () => {
    const habit = {
      id: "h1",
      title: "Read",
      bucket: "evening",
      currentStreak: 5,
      longestStreak: 12,
      completedToday: true,
      dueToday: true,
      needsSaveToday: false,
      targetLabel: "daily",
      dayPartLabel: "Evening",
    } as unknown as HabitSummary;
    expect(serializeHabit(habit)).toEqual({
      id: "h1",
      title: "Read",
      bucket: "evening",
      currentStreak: 5,
      longestStreak: 12,
      completedToday: true,
      dueToday: true,
      needsSaveToday: false,
      targetLabel: "daily",
      dayPartLabel: "Evening",
    });
  });

  it("defaults a missing bucket to general", () => {
    const habit = { bucket: null } as unknown as HabitSummary;
    expect(serializeHabit(habit).bucket).toBe("general");
  });
});

describe("serializeProject", () => {
  it("maps the stable row shape", () => {
    const project = {
      id: "p1",
      name: "Aucosto",
      status: "active",
      openTaskCount: 3,
      doneTaskCount: 7,
      nextAction: "Ship the API",
      lastWorkedAt: new Date("2026-10-14T08:00:00.000Z"),
      daysUntilTarget: 10,
    } as unknown as BoardProjectCard;
    expect(serializeProject(project)).toEqual({
      id: "p1",
      name: "Aucosto",
      status: "active",
      openTaskCount: 3,
      doneTaskCount: 7,
      nextAction: "Ship the API",
      lastWorkedAt: "2026-10-14T08:00:00.000Z",
      daysUntilTarget: 10,
    });
  });
});

describe("serializeCalendarItem", () => {
  it("maps the stable row shape", () => {
    const item = {
      id: "c1",
      title: "Deep work",
      kind: "block",
      status: "confirmed",
      startsAt: new Date("2026-10-15T16:00:00.000Z"),
      endsAt: new Date("2026-10-15T18:00:00.000Z"),
      allDay: false,
      location: "Home office",
      notes: null,
      sourceTool: "do",
    } as unknown as CalendarOccurrence;
    const row: AssistantCalendarRow = serializeCalendarItem(item);
    expect(row).toEqual({
      id: "c1",
      title: "Deep work",
      kind: "block",
      status: "confirmed",
      startsAt: "2026-10-15T16:00:00.000Z",
      endsAt: "2026-10-15T18:00:00.000Z",
      allDay: false,
      location: "Home office",
      notes: null,
      sourceTool: "do",
    });
  });
});
