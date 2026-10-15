import { describe, expect, it, vi, beforeEach } from "vitest";
import { ACTION_REGISTRY } from "@/lib/assistant-actions";

describe("ACTION_REGISTRY", () => {
  it("create_task has low risk", () => {
    expect(ACTION_REGISTRY["create_task"]!.risk).toBe("low");
  });

  it("create_task does not require confirmation", () => {
    expect(ACTION_REGISTRY["create_task"]!.confirmationRequired).toBe(false);
  });

  it("create_task is supported", () => {
    expect(ACTION_REGISTRY["create_task"]!.supported).toBe(true);
  });

  it("log_habit has low risk", () => {
    expect(ACTION_REGISTRY["log_habit"]!.risk).toBe("low");
  });

  it("add_reflection has low risk", () => {
    expect(ACTION_REGISTRY["add_reflection"]!.risk).toBe("low");
  });

  it("stop_timer requires confirmation", () => {
    expect(ACTION_REGISTRY["stop_timer"]!.confirmationRequired).toBe(true);
  });

  it("stop_timer has medium risk", () => {
    expect(ACTION_REGISTRY["stop_timer"]!.risk).toBe("medium");
  });

  it("complete_task requires confirmation", () => {
    expect(ACTION_REGISTRY["complete_task"]!.confirmationRequired).toBe(true);
  });

  it("update_task has medium risk", () => {
    expect(ACTION_REGISTRY["update_task"]!.risk).toBe("medium");
  });

  it("finance_write is not supported", () => {
    expect(ACTION_REGISTRY["finance_write"]!.supported).toBe(false);
  });

  it("finance_write has high risk", () => {
    expect(ACTION_REGISTRY["finance_write"]!.risk).toBe("high");
  });

  it("all supported actions have descriptions", () => {
    for (const [key, def] of Object.entries(ACTION_REGISTRY)) {
      expect(def.description.length, `${key} missing description`).toBeGreaterThan(0);
    }
  });
});

describe("medium-risk confirmation gate logic", () => {
  // Pure gate logic: medium-risk actions with confirmed !== true must be rejected.
  // This mirrors the logic in execute/route.ts without importing the route.
  function wouldRequireConfirmation(
    action: string,
    confirmed: unknown,
  ): boolean {
    const def = ACTION_REGISTRY[action];
    if (!def) return false;
    return def.confirmationRequired && confirmed !== true;
  }

  function isHighRisk(action: string): boolean {
    return ACTION_REGISTRY[action]?.risk === "high";
  }

  function isLowRisk(action: string): boolean {
    return ACTION_REGISTRY[action]?.risk === "low";
  }

  it("stop_timer without confirmed:true requires confirmation", () => {
    expect(wouldRequireConfirmation("stop_timer", undefined)).toBe(true);
  });

  it("stop_timer with confirmed:true does NOT require confirmation", () => {
    expect(wouldRequireConfirmation("stop_timer", true)).toBe(false);
  });

  it("stop_timer with confirmed:false requires confirmation", () => {
    expect(wouldRequireConfirmation("stop_timer", false)).toBe(true);
  });

  it("create_task (low risk) never requires confirmation", () => {
    expect(wouldRequireConfirmation("create_task", undefined)).toBe(false);
  });

  it("log_habit (low risk) never requires confirmation", () => {
    expect(wouldRequireConfirmation("log_habit", undefined)).toBe(false);
  });

  it("complete_task without confirmed:true requires confirmation", () => {
    expect(wouldRequireConfirmation("complete_task", undefined)).toBe(true);
  });

  it("update_project without confirmed:true requires confirmation", () => {
    expect(wouldRequireConfirmation("update_project", undefined)).toBe(true);
  });

  it("medium-risk action without confirmed flag should be rejected", () => {
    // All medium-risk actions must gate on confirmation
    const mediumActions = Object.values(ACTION_REGISTRY).filter(
      (d) => d.risk === "medium" && d.supported,
    );
    for (const def of mediumActions) {
      expect(
        wouldRequireConfirmation(def.action, undefined),
        `${def.action} should require confirmation`,
      ).toBe(true);
    }
  });

  it("high-risk action is always high-risk (blocked at route level)", () => {
    expect(isHighRisk("finance_write")).toBe(true);
  });

  it("low-risk action executes without confirmation", () => {
    // Low-risk actions must NOT require confirmation
    const lowActions = Object.values(ACTION_REGISTRY).filter(
      (d) => d.risk === "low" && d.supported,
    );
    for (const def of lowActions) {
      expect(
        wouldRequireConfirmation(def.action, undefined),
        `${def.action} should not require confirmation`,
      ).toBe(false);
    }
    expect(isLowRisk("create_task")).toBe(true);
  });
});

// ── Preview richness tests (mock service reads) ────────────────────────────

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

describe("stop_timer preview with endedAtLocal", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("shows before/after duration when endedAtLocal is provided", async () => {
    const startedAt = new Date("2024-06-24T08:55:00.000Z");
    // endedAtLocal = "2024-06-24T09:15:00" — the server will parse as local but
    // for the test we just verify the preview contains the right structure.

    vi.doMock("@/lib/services/time", () => ({
      getRunningEntry: vi.fn().mockResolvedValue({
        id: "entry-1",
        label: "Commute",
        category: "commute",
        startedAt,
        endedAt: null,
      }),
      listRecentEntries: vi.fn().mockResolvedValue([]),
      startEntry: vi.fn(),
      stopRunning: vi.fn(),
      updateEntry: vi.fn(),
    }));

    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "stop_timer", {
      endedAtLocal: "2024-06-24T09:15:00",
    });

    expect(result.ok).toBe(true);
    expect(result.previewText).toContain("Stop timer: Commute");
    expect(result.previewText).toContain("Proposed end:");
    expect(result.previewText).toContain("Final duration:");
    expect(result.previewText).toContain("Started:");
  });

  it("shows running time with no endedAtLocal", async () => {
    const startedAt = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago

    vi.doMock("@/lib/services/time", () => ({
      getRunningEntry: vi.fn().mockResolvedValue({
        id: "entry-2",
        label: "Work",
        category: "work",
        startedAt,
        endedAt: null,
      }),
      listRecentEntries: vi.fn().mockResolvedValue([]),
      startEntry: vi.fn(),
      stopRunning: vi.fn(),
      updateEntry: vi.fn(),
    }));

    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "stop_timer", {});

    expect(result.ok).toBe(true);
    expect(result.previewText).toContain("Stop timer: Work");
    expect(result.previewText).toContain("Running for");
  });

  it("returns error when no timer running", async () => {
    vi.doMock("@/lib/services/time", () => ({
      getRunningEntry: vi.fn().mockResolvedValue(null),
      listRecentEntries: vi.fn().mockResolvedValue([]),
      startEntry: vi.fn(),
      stopRunning: vi.fn(),
      updateEntry: vi.fn(),
    }));

    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "stop_timer", {});

    expect(result.ok).toBe(false);
    expect(result.error).toContain("No timer is currently running");
  });
});

describe("edit_time_entry preview shows before and after", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("shows before/after when entry exists", async () => {
    const startedAt = new Date("2024-06-24T08:55:00.000Z");
    const endedAt = new Date("2024-06-24T17:52:00.000Z");

    vi.doMock("@/lib/services/time", () => ({
      getRunningEntry: vi.fn().mockResolvedValue(null),
      listRecentEntries: vi.fn().mockResolvedValue([
        {
          id: "entry-abc",
          label: "Commute",
          category: "commute",
          startedAt,
          endedAt,
        },
      ]),
      startEntry: vi.fn(),
      stopRunning: vi.fn(),
      updateEntry: vi.fn(),
    }));

    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "edit_time_entry", {
      entryId: "entry-abc",
      endedAt: "2024-06-24T09:15:00.000Z",
    });

    expect(result.ok).toBe(true);
    expect(result.previewText).toContain("Edit time entry: Commute");
    expect(result.previewText).toContain("Before:");
    expect(result.previewText).toContain("After:");
  });

  it("returns error when entry not found", async () => {
    vi.doMock("@/lib/services/time", () => ({
      getRunningEntry: vi.fn().mockResolvedValue(null),
      listRecentEntries: vi.fn().mockResolvedValue([]),
      startEntry: vi.fn(),
      stopRunning: vi.fn(),
      updateEntry: vi.fn(),
    }));

    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "edit_time_entry", {
      entryId: "missing-id",
      endedAt: "2024-06-24T09:15:00.000Z",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("not found");
  });
});

describe("log_habit ambiguity", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns candidates when habitName matches 2+ habits", async () => {
    // Neither "Read Books" nor "Read Bible" is an exact match for "read",
    // but both contain it → partial match returns 2 → ambiguity.
    vi.doMock("@/lib/services/habits", () => ({
      listHabits: vi.fn().mockResolvedValue([
        { id: "h1", title: "Read Books", bucket: "reading" },
        { id: "h2", title: "Read Bible", bucket: "spiritual" },
      ]),
      logHabitProgress: vi.fn(),
    }));

    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "log_habit", { habitName: "read" });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Ambiguous");
    expect(result.candidates).toBeDefined();
    expect(result.candidates!.length).toBe(2);
  });

  it("returns empty candidates when habitName matches nothing", async () => {
    vi.doMock("@/lib/services/habits", () => ({
      listHabits: vi.fn().mockResolvedValue([
        { id: "h1", title: "Meditate", bucket: "mindfulness" },
      ]),
      logHabitProgress: vi.fn(),
    }));

    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "log_habit", { habitName: "Nonexistent" });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("No habit found");
    expect(result.candidates).toBeDefined();
    expect(result.candidates!.length).toBe(0);
  });

  it("succeeds when habitName has exactly one match", async () => {
    vi.doMock("@/lib/services/habits", () => ({
      listHabits: vi.fn().mockResolvedValue([
        { id: "h1", title: "Meditate", bucket: "mindfulness" },
        { id: "h2", title: "Read", bucket: "reading" },
      ]),
      logHabitProgress: vi.fn(),
    }));

    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "log_habit", { habitName: "Meditate" });

    expect(result.ok).toBe(true);
    expect(result.previewText).toContain("Meditate");
  });
});

describe("new write actions: registry", () => {
  it("create_project has low risk and needs no confirmation", () => {
    expect(ACTION_REGISTRY["create_project"]!.risk).toBe("low");
    expect(ACTION_REGISTRY["create_project"]!.confirmationRequired).toBe(false);
    expect(ACTION_REGISTRY["create_project"]!.supported).toBe(true);
  });

  it("create_habit has low risk and needs no confirmation", () => {
    expect(ACTION_REGISTRY["create_habit"]!.risk).toBe("low");
    expect(ACTION_REGISTRY["create_habit"]!.confirmationRequired).toBe(false);
    expect(ACTION_REGISTRY["create_habit"]!.supported).toBe(true);
  });

  it("update_calendar_event has medium risk and requires confirmation", () => {
    expect(ACTION_REGISTRY["update_calendar_event"]!.risk).toBe("medium");
    expect(ACTION_REGISTRY["update_calendar_event"]!.confirmationRequired).toBe(true);
    expect(ACTION_REGISTRY["update_calendar_event"]!.supported).toBe(true);
  });
});

describe("create_project preview", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  function mockProjects(existing: { id: string; name: string }[] = []) {
    vi.doMock("@/lib/services/projects", () => ({
      listBoardProjects: vi.fn().mockResolvedValue(existing),
      createBoardProject: vi.fn().mockResolvedValue("proj-new"),
      updateProject: vi.fn(),
    }));
  }

  it("previews a new project with its fields", async () => {
    mockProjects([]);
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "create_project", {
      name: "Split-Flap Display",
      intent: "Build a working split-flap display",
      timeBudgetMinutes: 180,
    });

    expect(result.ok).toBe(true);
    expect(result.previewText).toContain("Split-Flap Display");
    expect(result.previewText).toContain("3h/week");
    expect(result.normalizedInput.name).toBe("Split-Flap Display");
    expect(result.warnings).toHaveLength(0);
  });

  it("warns when a project with the same name exists", async () => {
    mockProjects([{ id: "p1", name: "Split-Flap Display" }]);
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "create_project", {
      name: "split-flap display",
    });

    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("already exists");
  });

  it("rejects an empty name", async () => {
    mockProjects([]);
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "create_project", { name: "" });

    expect(result.ok).toBe(false);
  });
});

describe("create_habit preview", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  function mockHabits(existing: { id: string; title: string }[] = []) {
    vi.doMock("@/lib/services/habits", () => ({
      listHabits: vi.fn().mockResolvedValue(existing),
      logHabitProgress: vi.fn(),
      createHabit: vi.fn().mockResolvedValue({ id: "habit-new", title: "Weigh-in" }),
    }));
  }

  it("previews a new habit with cadence and goal", async () => {
    mockHabits([]);
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "create_habit", {
      title: "Weigh-in",
      cadence: "daily",
      dayPart: "morning",
    });

    expect(result.ok).toBe(true);
    expect(result.previewText).toContain("Weigh-in");
    expect(result.previewText).toContain("daily");
    expect(result.normalizedInput.title).toBe("Weigh-in");
  });

  it("warns on duplicate habit title", async () => {
    mockHabits([{ id: "h1", title: "Weigh-in" }]);
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "create_habit", { title: "weigh-in" });

    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("rejects an invalid cadence", async () => {
    mockHabits([]);
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "create_habit", {
      title: "Weigh-in",
      cadence: "hourly",
    });

    expect(result.ok).toBe(false);
  });
});

describe("update_calendar_event preview", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  const existing = {
    id: "evt-1",
    title: "Dentist",
    startsAt: new Date("2026-10-20T14:00:00"),
    endsAt: new Date("2026-10-20T15:00:00"),
  };

  function mockCalendar(item: typeof existing | null) {
    vi.doMock("@/lib/services/calendar", () => ({
      createCalendarItem: vi.fn(),
      getCalendarItem: vi.fn().mockResolvedValue(item),
      updateCalendarItem: vi.fn().mockResolvedValue(item && { ...item, id: "evt-1" }),
    }));
  }

  it("errors when the event does not exist", async () => {
    mockCalendar(null);
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "update_calendar_event", {
      eventId: "nope",
      title: "New title",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("previews a title change", async () => {
    mockCalendar(existing);
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "update_calendar_event", {
      eventId: "evt-1",
      title: "Dentist appointment",
    });

    expect(result.ok).toBe(true);
    expect(result.previewText).toContain("Dentist");
    expect(result.previewText).toContain("Dentist appointment");
    expect(result.normalizedInput.title).toBe("Dentist appointment");
    expect(result.normalizedInput.timeChanged).toBe(false);
  });

  it("previews a reschedule with partial time input", async () => {
    mockCalendar(existing);
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "update_calendar_event", {
      eventId: "evt-1",
      startTime: "16:00",
      endTime: "17:00",
    });

    expect(result.ok).toBe(true);
    expect(result.previewText).toContain("16:00–17:00");
    expect(result.normalizedInput.timeChanged).toBe(true);
  });

  it("errors when no changes are specified", async () => {
    mockCalendar(existing);
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "update_calendar_event", {
      eventId: "evt-1",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("No changes");
  });

  it("errors when end time is before start time", async () => {
    mockCalendar(existing);
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "update_calendar_event", {
      eventId: "evt-1",
      startTime: "16:00",
      endTime: "15:00",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("after start time");
  });
});

describe("new write actions: execute", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("executeCreateProject calls the board project service", async () => {
    const createBoardProject = vi.fn().mockResolvedValue("proj-new");
    vi.doMock("@/lib/services/projects", () => ({
      listBoardProjects: vi.fn().mockResolvedValue([]),
      createBoardProject,
      updateProject: vi.fn(),
    }));

    const { executeAction } = await import("@/lib/assistant-action-executor");
    const result = await executeAction("user-1", "create_project", { name: "Health" });

    expect(result.ok).toBe(true);
    expect(result.recordId).toBe("proj-new");
    expect(result.recordType).toBe("Project");
    expect(createBoardProject).toHaveBeenCalledOnce();
  });

  it("executeCreateHabit calls the habit service", async () => {
    const createHabit = vi.fn().mockResolvedValue({ id: "habit-new", title: "Weigh-in" });
    vi.doMock("@/lib/services/habits", () => ({
      listHabits: vi.fn().mockResolvedValue([]),
      logHabitProgress: vi.fn(),
      createHabit,
    }));

    const { executeAction } = await import("@/lib/assistant-action-executor");
    const result = await executeAction("user-1", "create_habit", { title: "Weigh-in" });

    expect(result.ok).toBe(true);
    expect(result.recordId).toBe("habit-new");
    expect(result.recordType).toBe("Habit");
    expect(createHabit).toHaveBeenCalledOnce();
  });

  it("executeUpdateCalendarEvent patches only changed fields", async () => {
    const item = {
      id: "evt-1",
      title: "Dentist",
      startsAt: new Date("2026-10-20T14:00:00"),
      endsAt: new Date("2026-10-20T15:00:00"),
    };
    const updateCalendarItem = vi.fn().mockResolvedValue({ ...item, title: "Dentist!!" });
    vi.doMock("@/lib/services/calendar", () => ({
      createCalendarItem: vi.fn(),
      getCalendarItem: vi.fn().mockResolvedValue(item),
      updateCalendarItem,
    }));

    const { executeAction } = await import("@/lib/assistant-action-executor");
    const result = await executeAction("user-1", "update_calendar_event", {
      eventId: "evt-1",
      title: "Dentist!!",
    });

    expect(result.ok).toBe(true);
    expect(result.recordType).toBe("CalendarItem");
    expect(updateCalendarItem).toHaveBeenCalledOnce();
    const patch = updateCalendarItem.mock.calls[0]![2];
    expect(patch.title).toBe("Dentist!!");
    expect(patch.startsAt).toBeUndefined();
  });
});

describe("delete_calendar_event", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  const existing = {
    id: "evt-1",
    title: "Dentist",
    startsAt: new Date("2026-10-20T14:00:00"),
    endsAt: new Date("2026-10-20T15:00:00"),
  };

  function mockCalendar(item: typeof existing | null) {
    return {
      createCalendarItem: vi.fn(),
      getCalendarItem: vi.fn().mockResolvedValue(item),
      updateCalendarItem: vi.fn(),
      deleteCalendarItem: vi.fn().mockResolvedValue(undefined),
    };
  }

  it("is registered as medium risk with confirmation required", () => {
    expect(ACTION_REGISTRY["delete_calendar_event"]!.risk).toBe("medium");
    expect(ACTION_REGISTRY["delete_calendar_event"]!.confirmationRequired).toBe(true);
    expect(ACTION_REGISTRY["delete_calendar_event"]!.supported).toBe(true);
  });

  it("previews the event to be deleted", async () => {
    vi.doMock("@/lib/services/calendar", () => mockCalendar(existing));
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "delete_calendar_event", {
      eventId: "evt-1",
    });

    expect(result.ok).toBe(true);
    expect(result.previewText).toContain("Delete calendar event");
    expect(result.previewText).toContain("Dentist");
  });

  it("errors when the event does not exist", async () => {
    vi.doMock("@/lib/services/calendar", () => mockCalendar(null));
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "delete_calendar_event", {
      eventId: "nope",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("executes the delete through the service", async () => {
    const services = mockCalendar(existing);
    vi.doMock("@/lib/services/calendar", () => services);
    const { executeAction } = await import("@/lib/assistant-action-executor");
    const result = await executeAction("user-1", "delete_calendar_event", {
      eventId: "evt-1",
    });

    expect(result.ok).toBe(true);
    expect(result.recordType).toBe("CalendarItem");
    expect(services.deleteCalendarItem).toHaveBeenCalledOnce();
    expect(services.deleteCalendarItem).toHaveBeenCalledWith("user-1", "evt-1");
  });
});
