import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Audit tests for the 15 assistant actions (tasks, calendar, time, habits,
 * reflections): actionable validation errors, clear confirmation previews,
 * risk/confirmation gates, and consistent never-guess fuzzy matching.
 *
 * Every test mocks the service layer with vi.doMock and exercises
 * previewAction / executeAction from @/lib/assistant-action-executor.
 */

const USER = "user-1";

function mockDo(overrides: Record<string, unknown> = {}) {
  vi.doMock("@/lib/services/do", () => ({
    createDoItem: vi.fn(),
    updateDoItem: vi.fn(),
    getDoItemSummary: vi.fn(),
    ...overrides,
  }));
}

function mockTime(overrides: Record<string, unknown> = {}) {
  vi.doMock("@/lib/services/time", () => ({
    getRunningEntry: vi.fn().mockResolvedValue(null),
    startEntry: vi.fn(),
    stopRunning: vi.fn(),
    updateEntry: vi.fn(),
    createPastEntry: vi.fn(),
    getTimeEntry: vi.fn().mockResolvedValue(null),
    ...overrides,
  }));
}

function mockTimePeople() {
  vi.doMock("@/lib/services/time-people", () => ({
    setEntryPeople: vi.fn().mockResolvedValue(undefined),
  }));
}

function mockTimeCategories(names: string[] = []) {
  vi.doMock("@/lib/services/time-categories", () => ({
    listTimeCategories: vi
      .fn()
      .mockResolvedValue(names.map((name) => ({ name }))),
  }));
}

function mockTimeCalendar(overrides: Record<string, unknown> = {}) {
  vi.doMock("@/lib/services/time-calendar", () => ({
    setEntryCalendarLink: vi.fn().mockResolvedValue(undefined),
    resolveCalendarBlockByTitle: vi.fn().mockResolvedValue({
      eventId: null,
      title: null,
      warnings: [],
    }),
    suggestCalendarLinkForStart: vi.fn().mockResolvedValue(null),
    suggestCalendarLinkForRange: vi.fn().mockResolvedValue(null),
    ...overrides,
  }));
}

function mockHabits(habits: unknown[] = []) {
  vi.doMock("@/lib/services/habits", () => ({
    listHabits: vi.fn().mockResolvedValue(habits),
    logHabitProgress: vi.fn(),
    createHabit: vi.fn(),
  }));
}

function mockProjects(projects: unknown[] = []) {
  vi.doMock("@/lib/services/projects", () => ({
    listBoardProjects: vi.fn().mockResolvedValue(projects),
    updateProject: vi.fn(),
    createBoardProject: vi.fn(),
    deleteProject: vi.fn(),
  }));
}

function mockCalendar(overrides: Record<string, unknown> = {}) {
  vi.doMock("@/lib/services/calendar", () => ({
    createCalendarItem: vi.fn(),
    getCalendarItem: vi.fn().mockResolvedValue(null),
    updateCalendarItem: vi.fn(),
    deleteCalendarItem: vi.fn(),
    ...overrides,
  }));
}

function mockRolodex(findPersonByName: (u: string, n: string) => unknown) {
  vi.doMock("@/lib/services/rolodex", () => ({
    findPersonByName: vi.fn(findPersonByName),
    createPerson: vi.fn(),
    updatePerson: vi.fn(),
    addInteraction: vi.fn(),
    getPerson: vi.fn(),
    listPersons: vi.fn(),
  }));
}

beforeEach(() => {
  vi.resetModules();
});

// ── 1. Actionable validation errors ─────────────────────────────────────────

describe("actionable validation errors", () => {
  it("create_task: missing title says what is required", async () => {
    mockDo();
    mockProjects([]);
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction(USER, "create_task", {});
    expect(result.ok).toBe(false);
    expect(result.error).toContain("title");
    expect(result.error).toContain("required");
  });

  it("create_task: invalid bucket lists the valid values", async () => {
    mockDo();
    mockProjects([]);
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction(USER, "create_task", {
      title: "x",
      bucket: "never",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("today");
    expect(result.error).toContain("someday");
  });

  it("create_calendar_block: reports every invalid field at once", async () => {
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction(USER, "create_calendar_block", {
      title: "x",
      date: "10-16-2026",
      startTime: "9am",
      endTime: "10:00",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("date");
    expect(result.error).toContain("YYYY-MM-DD");
    expect(result.error).toContain("startTime");
    expect(result.error).toContain("HH:MM");
  });

  it("create_calendar_block: rejects impossible times like 24:00", async () => {
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction(USER, "create_calendar_block", {
      title: "x",
      date: "2026-10-16",
      startTime: "24:00",
      endTime: "25:00",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("00:00 to 23:59");
  });

  it("create_calendar_block: rejects impossible dates like Feb 30", async () => {
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction(USER, "create_calendar_block", {
      title: "x",
      date: "2026-02-30",
      startTime: "09:00",
      endTime: "10:00",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("not a real calendar date");
  });

  it("create_calendar_block: end before start names the window", async () => {
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction(USER, "create_calendar_block", {
      title: "x",
      date: "2026-10-16",
      startTime: "10:00",
      endTime: "09:00",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("End time must be after start time");
    expect(result.error).toContain("10:00");
  });

  it("log_time_entry: invalid datetimes echo the bad value with an example", async () => {
    mockTime();
    mockTimePeople();
    mockTimeCategories();
    mockTimeCalendar();
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction(USER, "log_time_entry", {
      title: "x",
      startedAt: "yesterday-ish",
      endedAt: "2026-10-16T10:00:00",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("yesterday-ish");
    expect(result.error).toContain("ISO datetime");
  });

  it("complete_task: unknown id points at the task list", async () => {
    mockDo({
      getDoItemSummary: vi.fn().mockResolvedValue(null),
    });
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction(USER, "complete_task", {
      taskId: "nope",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Task "nope" not found');
    expect(result.error).toContain("GET /api/assistant/tasks");
  });

  it("update_calendar_event: unknown id points at the calendar list", async () => {
    mockCalendar();
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction(USER, "update_calendar_event", {
      eventId: "nope",
      title: "x",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Calendar event "nope" not found');
    expect(result.error).toContain("GET /api/assistant/calendar");
  });

  it("delete_calendar_event: unknown id points at the calendar list", async () => {
    mockCalendar();
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction(USER, "delete_calendar_event", {
      eventId: "nope",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Calendar event "nope" not found');
    expect(result.error).toContain("GET /api/assistant/calendar");
  });

  it("edit_time_entry: end before start is rejected in preview", async () => {
    const startedAt = new Date("2024-06-24T08:55:00.000Z");
    const endedAt = new Date("2024-06-24T17:52:00.000Z");
    mockTime({
      getTimeEntry: vi
        .fn()
        .mockResolvedValue({ id: "e1", label: "Commute", startedAt, endedAt }),
    });
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction(USER, "edit_time_entry", {
      entryId: "e1",
      startedAt: "2024-06-24T18:00:00.000Z",
      endedAt: "2024-06-24T09:00:00.000Z",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("End time must be after start time");
  });

  it("edit_time_entry: no changes is an error, not a silent no-op", async () => {
    const startedAt = new Date("2024-06-24T08:55:00.000Z");
    const endedAt = new Date("2024-06-24T17:52:00.000Z");
    mockTime({
      getTimeEntry: vi
        .fn()
        .mockResolvedValue({ id: "e1", label: "Commute", startedAt, endedAt }),
    });
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction(USER, "edit_time_entry", {
      entryId: "e1",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("No changes specified");
  });

  it("update_task: no changes is an error", async () => {
    mockDo({
      getDoItemSummary: vi.fn().mockResolvedValue({
        id: "t1",
        title: "Buy milk",
        lane: "today",
        projectId: null,
      }),
    });
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction(USER, "update_task", { taskId: "t1" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("No changes specified");
  });

  it("update_calendar_event: no changes is an error", async () => {
    mockCalendar({
      getCalendarItem: vi.fn().mockResolvedValue({
        id: "evt-1",
        title: "Standup",
        startsAt: new Date("2026-10-16T09:00:00"),
        endsAt: new Date("2026-10-16T09:15:00"),
      }),
    });
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction(USER, "update_calendar_event", {
      eventId: "evt-1",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("No changes specified");
  });

  it("stop_timer: entryId must match the running timer", async () => {
    mockTime({
      getRunningEntry: vi.fn().mockResolvedValue({
        id: "entry-running",
        label: "Deep work",
        startedAt: new Date(Date.now() - 30 * 60 * 1000),
      }),
    });
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction(USER, "stop_timer", {
      entryId: "entry-other",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('entryId "entry-other" does not match');
    expect(result.error).toContain('"Deep work"');
    expect(result.error).toContain("entry-running");
  });

  it("stop_timer: matching entryId is accepted", async () => {
    mockTime({
      getRunningEntry: vi.fn().mockResolvedValue({
        id: "entry-running",
        label: "Deep work",
        startedAt: new Date(Date.now() - 30 * 60 * 1000),
      }),
    });
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction(USER, "stop_timer", {
      entryId: "entry-running",
    });
    expect(result.ok).toBe(true);
  });
});

// ── 2. Clear confirmation previews ──────────────────────────────────────────

describe("clear confirmation previews", () => {
  it("delete_calendar_event: preview shows what will be destroyed", async () => {
    mockCalendar({
      getCalendarItem: vi.fn().mockResolvedValue({
        id: "evt-1",
        title: "Dentist",
        startsAt: new Date("2026-10-16T14:00:00"),
        endsAt: new Date("2026-10-16T15:00:00"),
      }),
    });
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction(USER, "delete_calendar_event", {
      eventId: "evt-1",
    });
    expect(result.ok).toBe(true);
    expect(result.previewText).toContain('Delete calendar event "Dentist"');
    expect(result.previewText).toContain("2026-10-16");
    expect(result.previewText).toContain("cannot be undone");
  });

  it("complete_task: preview shows the resolved title and lane", async () => {
    mockDo({
      getDoItemSummary: vi.fn().mockResolvedValue({
        id: "t1",
        title: "Buy milk",
        lane: "today",
        status: "open",
      }),
    });
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction(USER, "complete_task", {
      taskId: "t1",
    });
    expect(result.ok).toBe(true);
    expect(result.previewText).toContain('Complete task "Buy milk"');
    expect(result.previewText).toContain("[today]");
  });

  it("update_task: preview shows the resolved project name, not the id", async () => {
    mockDo({
      getDoItemSummary: vi.fn().mockResolvedValue({
        id: "t1",
        title: "Buy milk",
        lane: "today",
        projectId: null,
      }),
    });
    mockProjects([{ id: "p1", name: "Health & Fitness" }]);
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction(USER, "update_task", {
      taskId: "t1",
      projectName: "Health & Fitness",
    });
    expect(result.ok).toBe(true);
    expect(result.previewText).toContain('project → "Health & Fitness"');
    expect(result.previewText).not.toContain("p1");
  });

  it("stop_timer: preview shows the note when provided", async () => {
    mockTime({
      getRunningEntry: vi.fn().mockResolvedValue({
        id: "entry-running",
        label: "Deep work",
        startedAt: new Date(Date.now() - 30 * 60 * 1000),
      }),
    });
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction(USER, "stop_timer", {
      note: "wrapped the report",
    });
    expect(result.ok).toBe(true);
    expect(result.previewText).toContain("Stop timer: Deep work");
    expect(result.previewText).toContain('Note: "wrapped the report"');
  });

  it("log_time_entry: preview shows window, duration, and canonical category", async () => {
    mockTime();
    mockTimePeople();
    mockTimeCategories(["Deep Work"]);
    mockTimeCalendar();
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction(USER, "log_time_entry", {
      title: "Spec writing",
      startedAt: "2026-10-16T09:00:00.000Z",
      endedAt: "2026-10-16T10:30:00.000Z",
      categoryName: "deep work",
    });
    expect(result.ok).toBe(true);
    expect(result.previewText).toContain('Log time entry "Spec writing"');
    expect(result.previewText).toContain("1h 30m");
    expect(result.previewText).toContain("Category: Deep Work");
  });
});

// ── 3. Risk/confirmation gates: execute re-validates ────────────────────────

describe("execute re-validates input", () => {
  it("executeAction fails invalid input without touching the service", async () => {
    const createDoItem = vi.fn();
    mockDo({ createDoItem });
    mockProjects([]);
    const { executeAction } = await import("@/lib/assistant-action-executor");
    const result = await executeAction(USER, "create_task", {});
    expect(result.ok).toBe(false);
    expect(result.error).toContain("title");
    expect(createDoItem).not.toHaveBeenCalled();
  });

  it("executeAction fails a bad calendar block without creating it", async () => {
    const createCalendarItem = vi.fn();
    mockCalendar({ createCalendarItem });
    const { executeAction } = await import("@/lib/assistant-action-executor");
    const result = await executeAction(USER, "create_calendar_block", {
      title: "x",
      date: "2026-10-16",
      startTime: "24:00",
      endTime: "25:00",
    });
    expect(result.ok).toBe(false);
    expect(createCalendarItem).not.toHaveBeenCalled();
  });

  it("executeAction surfaces preview-time ambiguity instead of guessing", async () => {
    mockHabits([
      { id: "h1", title: "Read Books", bucket: "reading" },
      { id: "h2", title: "Read Bible", bucket: "spiritual" },
    ]);
    const { executeAction } = await import("@/lib/assistant-action-executor");
    const result = await executeAction(USER, "log_habit", {
      habitName: "read",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Ambiguous");
  });
});

// ── 4. Consistent fuzzy matching that never guesses ─────────────────────────

describe("fuzzy matching never guesses", () => {
  it("log_habit: single close match asks with did-you-mean (never picks)", async () => {
    mockHabits([{ id: "h1", title: "Morning Run", bucket: "fitness" }]);
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction(USER, "log_habit", {
      habitName: "morn",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('did you mean "Morning Run"');
    expect(result.candidates).toEqual([
      { id: "h1", name: "Morning Run", bucket: "fitness" },
    ]);
  });

  it("log_habit: no match lists the known habits", async () => {
    mockHabits([
      { id: "h1", title: "Morning Run", bucket: "fitness" },
      { id: "h2", title: "Read", bucket: "mind" },
    ]);
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction(USER, "log_habit", {
      habitName: "zzz",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('No habit found matching "zzz"');
    expect(result.error).toContain('"Morning Run"');
    expect(result.error).toContain('"Read"');
  });

  it("start_timer: close habitName warns and skips with a suggestion", async () => {
    mockTime({
      startEntry: vi.fn(),
      getRunningEntry: vi.fn().mockResolvedValue(null),
    });
    mockHabits([{ id: "h1", title: "Morning Run", bucket: "fitness" }]);
    mockTimePeople();
    mockTimeCategories();
    mockTimeCalendar();
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction(USER, "start_timer", {
      title: "Jog",
      habitName: "morn",
    });
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => w.includes('"morn" is close to "Morning Run"'))).toBe(true);
    expect((result.normalizedInput as Record<string, unknown>).habitId).toBeNull();
  });

  it("start_timer: exact person name links; close name warns and skips", async () => {
    mockTime({
      startEntry: vi.fn(),
      getRunningEntry: vi.fn().mockResolvedValue(null),
    });
    mockHabits([]);
    mockTimeCategories();
    mockTimeCalendar();
    mockTimePeople();
    mockRolodex((_u, n) =>
      n.toLowerCase() === "ana"
        ? [
            {
              id: "person-ana",
              displayName: "Ana",
              firstName: "Ana",
              lastName: null,
              aliases: [],
            },
          ]
        : [],
    );
    // Exact first: control — "Ana" links.
    {
      const { previewAction } = await import("@/lib/assistant-action-executor");
      const result = await previewAction(USER, "start_timer", {
        title: "Dinner",
        personNames: ["Ana"],
      });
      expect(result.ok).toBe(true);
      expect((result.normalizedInput as Record<string, unknown>).personIds).toEqual([
        "person-ana",
      ]);
    }
  });

  it("start_timer: close person name is not linked (warn-and-skip)", async () => {
    mockTime({
      startEntry: vi.fn(),
      getRunningEntry: vi.fn().mockResolvedValue(null),
    });
    mockHabits([]);
    mockTimeCategories();
    mockTimeCalendar();
    mockTimePeople();
    mockRolodex(() => [
      {
        id: "person-ana",
        displayName: "Ana",
        firstName: "Ana",
        lastName: null,
        aliases: [],
      },
    ]);
    const { previewAction } = await import("@/lib/assistant-action-executor");
    // "an" is a substring of "Ana" but not exact → must not link.
    const result = await previewAction(USER, "start_timer", {
      title: "Dinner",
      personNames: ["an"],
    });
    expect(result.ok).toBe(true);
    expect((result.normalizedInput as Record<string, unknown>).personIds).toEqual([]);
    expect(
      result.warnings.some((w) => w.includes('close to "Ana"') && w.includes("not linked")),
    ).toBe(true);
  });

  it("log_time_entry: ambiguous person names warn and skip", async () => {
    mockTime();
    mockTimePeople();
    mockTimeCategories();
    mockTimeCalendar();
    mockRolodex(() => [
      { id: "p1", displayName: "Annie", firstName: "Annie", lastName: null, aliases: [] },
      { id: "p2", displayName: "Anna", firstName: "Anna", lastName: null, aliases: [] },
    ]);
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction(USER, "log_time_entry", {
      title: "Call",
      startedAt: "2026-10-16T09:00:00.000Z",
      endedAt: "2026-10-16T09:30:00.000Z",
      personNames: ["ann"],
    });
    expect(result.ok).toBe(true);
    expect((result.normalizedInput as Record<string, unknown>).personIds).toEqual([]);
    expect(
      result.warnings.some((w) => w.includes("Multiple people matched")),
    ).toBe(true);
  });

  it("start_timer: category exact match normalizes; close match is not set", async () => {
    mockTime({
      startEntry: vi.fn(),
      getRunningEntry: vi.fn().mockResolvedValue(null),
    });
    mockHabits([]);
    mockTimePeople();
    mockTimeCategories(["Deep Work", "Exercise"]);
    mockTimeCalendar();
    const { previewAction } = await import("@/lib/assistant-action-executor");

    const exact = await previewAction(USER, "start_timer", {
      title: "Specs",
      categoryName: "deep work",
    });
    expect(exact.ok).toBe(true);
    expect((exact.normalizedInput as Record<string, unknown>).category).toBe("Deep Work");
    expect(exact.warnings).toHaveLength(0);

    const close = await previewAction(USER, "start_timer", {
      title: "Specs",
      categoryName: "deep",
    });
    expect(close.ok).toBe(true);
    expect((close.normalizedInput as Record<string, unknown>).category).toBeNull();
    expect(
      close.warnings.some((w) => w.includes('close to "Deep Work"') && w.includes("not set")),
    ).toBe(true);
  });

  it("start_timer: unknown category warns and is saved as a new category", async () => {
    mockTime({
      startEntry: vi.fn(),
      getRunningEntry: vi.fn().mockResolvedValue(null),
    });
    mockHabits([]);
    mockTimePeople();
    mockTimeCategories(["Deep Work"]);
    mockTimeCalendar();
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction(USER, "start_timer", {
      title: "Specs",
      categoryName: "Woodworking",
    });
    expect(result.ok).toBe(true);
    expect((result.normalizedInput as Record<string, unknown>).category).toBe("Woodworking");
    expect(
      result.warnings.some((w) => w.includes("saved as a new category")),
    ).toBe(true);
  });

  it("start_timer: close calendarTitle warns and does not link", async () => {
    mockTime({
      startEntry: vi.fn(),
      getRunningEntry: vi.fn().mockResolvedValue(null),
    });
    mockHabits([]);
    mockTimePeople();
    mockTimeCategories();
    mockTimeCalendar({
      resolveCalendarBlockByTitle: vi.fn().mockResolvedValue({
        eventId: null,
        title: null,
        warnings: [
          '"gym" is close to "Morning gym session" but not an exact match — no calendar link added. Pass the exact block title to link it.',
        ],
      }),
    });
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction(USER, "start_timer", {
      title: "Workout",
      calendarTitle: "gym",
    });
    expect(result.ok).toBe(true);
    expect((result.normalizedInput as Record<string, unknown>).calendarEventId).toBeNull();
    expect(result.warnings.some((w) => w.includes("not an exact match"))).toBe(true);
  });

  it("create_task: close projectName warns and creates without a project", async () => {
    const createDoItem = vi.fn().mockResolvedValue({ id: "t1", title: "Run", lane: "someday" });
    mockDo({ createDoItem });
    mockProjects([{ id: "p1", name: "Health & Fitness" }]);
    const { executeAction } = await import("@/lib/assistant-action-executor");
    // Preview first: close match must not link.
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const preview = await previewAction(USER, "create_task", {
      title: "Run",
      projectName: "health",
    });
    expect(preview.ok).toBe(true);
    expect(preview.warnings.some((w) => w.includes('close to "Health & Fitness"'))).toBe(true);
    expect((preview.normalizedInput as Record<string, unknown>).projectId).toBeNull();

    const result = await executeAction(USER, "create_task", {
      title: "Run",
      projectName: "health",
    });
    expect(result.ok).toBe(true);
    expect(createDoItem).toHaveBeenCalledOnce();
    expect(createDoItem.mock.calls[0]![1].projectId).toBeNull();
  });

  it("update_task: ambiguous projectName warns and leaves the project unchanged", async () => {
    mockDo({
      getDoItemSummary: vi.fn().mockResolvedValue({
        id: "t1",
        title: "Buy milk",
        lane: "today",
        projectId: null,
      }),
    });
    mockProjects([
      { id: "p1", name: "Healthy Habits" },
      { id: "p2", name: "Health Insurance" },
    ]);
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction(USER, "update_task", {
      taskId: "t1",
      title: "Buy oat milk",
      projectName: "health",
    });
    expect(result.ok).toBe(true);
    expect(
      result.warnings.some((w) => w.includes("Multiple projects matched")),
    ).toBe(true);
    expect((result.normalizedInput as Record<string, unknown>).projectId).toBeUndefined();
    expect(result.previewText).toContain('title → "Buy oat milk"');
  });
});
