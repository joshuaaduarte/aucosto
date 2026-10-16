import { describe, it, expect, vi, beforeEach } from "vitest";
import { ACTION_REGISTRY } from "@/lib/assistant-actions";

// ── Mocks ───────────────────────────────────────────────────────────────────

const setEntryCalendarLink = vi.fn();
const resolveCalendarBlockByTitle = vi.fn();
const suggestCalendarLinkForStart = vi.fn();
const suggestCalendarLinkForRange = vi.fn();

function mockTimeCalendar() {
  vi.doMock("@/lib/services/time-calendar", () => ({
    setEntryCalendarLink,
    resolveCalendarBlockByTitle,
    suggestCalendarLinkForStart,
    suggestCalendarLinkForRange,
  }));
}

const getCalendarItem = vi.fn();

function mockCalendar(getItemImpl?: (u: string, id: string) => unknown) {
  vi.doMock("@/lib/services/calendar", () => ({
    createCalendarItem: vi.fn(),
    getCalendarItem: getItemImpl ? vi.fn(getItemImpl) : getCalendarItem,
    updateCalendarItem: vi.fn(),
    deleteCalendarItem: vi.fn(),
  }));
}

function mockTimePeople(setEntryPeople = vi.fn()) {
  vi.doMock("@/lib/services/time-people", () => ({
    setEntryPeople,
    listEntryPeople: vi.fn(),
    personTimeSummary: vi.fn(),
  }));
}

function mockRolodex() {
  vi.doMock("@/lib/services/rolodex", () => ({
    findPersonByName: vi.fn().mockResolvedValue([]),
    createPerson: vi.fn(),
    updatePerson: vi.fn(),
    addInteraction: vi.fn(),
    getPerson: vi.fn(),
    listPersons: vi.fn(),
  }));
}

function mockTimeService() {
  const startEntry = vi.fn().mockResolvedValue({ id: "entry-new", label: "Gym" });
  const createPastEntry = vi
    .fn()
    .mockResolvedValue({ id: "entry-past", label: "Gym" });
  vi.doMock("@/lib/services/time", () => ({
    getRunningEntry: vi.fn().mockResolvedValue(null),
    startEntry,
    stopRunning: vi.fn(),
    updateEntry: vi.fn(),
    createPastEntry,
    listRecentEntries: vi.fn().mockResolvedValue([]),
  }));
  return { startEntry, createPastEntry };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mockTimeCalendar();
  mockTimePeople();
  mockRolodex();
  mockTimeService();
  suggestCalendarLinkForStart.mockResolvedValue(null);
  suggestCalendarLinkForRange.mockResolvedValue(null);
});

// ── Linking by explicit id ──────────────────────────────────────────────────

describe("calendar linking by id", () => {
  it("start_timer links the resolved calendar event", async () => {
    mockCalendar(() => ({ id: "event-1", title: "Standup" }));
    const { executeAction } = await import("@/lib/assistant-action-executor");
    const result = await executeAction("user-1", "start_timer", {
      title: "Gym",
      calendarEventId: "event-1",
    });
    expect(result.ok).toBe(true);
    expect(setEntryCalendarLink).toHaveBeenCalledWith("user-1", "entry-new", "event-1");
  });

  it("log_time_entry links the resolved calendar event", async () => {
    mockCalendar(() => ({ id: "event-9", title: "Deep work" }));
    const { executeAction } = await import("@/lib/assistant-action-executor");
    const result = await executeAction("user-1", "log_time_entry", {
      title: "Gym",
      startedAt: "2026-10-15T13:00:00.000Z",
      endedAt: "2026-10-15T14:00:00.000Z",
      calendarEventId: "event-9",
    });
    expect(result.ok).toBe(true);
    expect(setEntryCalendarLink).toHaveBeenCalledWith("user-1", "entry-past", "event-9");
  });

  it("preview text names the linked block", async () => {
    mockCalendar(() => ({ id: "event-1", title: "Standup" }));
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "start_timer", {
      title: "Gym",
      calendarEventId: "event-1",
    });
    expect(result.ok).toBe(true);
    expect(result.previewText).toContain('for "Standup"');
    expect((result.normalizedInput as Record<string, unknown>).calendarEventId).toBe("event-1");
  });

  it("unknown calendarEventId warns and skips instead of failing", async () => {
    mockCalendar(() => null);
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "log_time_entry", {
      title: "Gym",
      startedAt: "2026-10-15T13:00:00.000Z",
      endedAt: "2026-10-15T14:00:00.000Z",
      calendarEventId: "nope",
    });
    expect(result.ok).toBe(true);
    expect(
      result.warnings.some((w) => w.includes('Calendar event "nope" not found')),
    ).toBe(true);
    expect((result.normalizedInput as Record<string, unknown>).calendarEventId).toBeNull();
    expect(setEntryCalendarLink).not.toHaveBeenCalled();
  });

  it("explicit calendarEventId wins over calendarTitle", async () => {
    mockCalendar(() => ({ id: "event-1", title: "Standup" }));
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "start_timer", {
      title: "Gym",
      calendarEventId: "event-1",
      calendarTitle: "Gym",
    });
    expect(result.ok).toBe(true);
    expect(
      result.warnings.some((w) => w.includes("calendarTitle ignored")),
    ).toBe(true);
    expect(resolveCalendarBlockByTitle).not.toHaveBeenCalled();
    expect((result.normalizedInput as Record<string, unknown>).calendarEventId).toBe("event-1");
  });
});

// ── Linking by fuzzy title ──────────────────────────────────────────────────

describe("calendar linking by fuzzy title", () => {
  it("links an exact title match", async () => {
    mockCalendar();
    resolveCalendarBlockByTitle.mockResolvedValue({
      eventId: "event-2",
      title: "Gym",
      warnings: [],
    });
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "start_timer", {
      title: "Workout",
      calendarTitle: "gym",
    });
    expect(result.ok).toBe(true);
    expect(result.previewText).toContain('for "Gym"');
    expect(result.warnings).toHaveLength(0);
    expect((result.normalizedInput as Record<string, unknown>).calendarEventId).toBe("event-2");
  });

  it("links a single fuzzy title match", async () => {
    mockCalendar();
    resolveCalendarBlockByTitle.mockResolvedValue({
      eventId: "event-3",
      title: "Morning gym session",
      warnings: [],
    });
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "log_time_entry", {
      title: "Workout",
      startedAt: "2026-10-15T07:00:00.000Z",
      endedAt: "2026-10-15T08:00:00.000Z",
      calendarTitle: "gym",
    });
    expect(result.ok).toBe(true);
    expect((result.normalizedInput as Record<string, unknown>).calendarEventId).toBe("event-3");
  });

  it("warns and skips unknown titles", async () => {
    mockCalendar();
    resolveCalendarBlockByTitle.mockResolvedValue({
      eventId: null,
      title: null,
      warnings: ['No calendar block matched "Zumba" — no calendar link added'],
    });
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "start_timer", {
      title: "Workout",
      calendarTitle: "Zumba",
    });
    expect(result.ok).toBe(true);
    expect(
      result.warnings.some((w) => w.includes('No calendar block matched "Zumba"')),
    ).toBe(true);
    expect((result.normalizedInput as Record<string, unknown>).calendarEventId).toBeNull();
  });

  it("warns and skips ambiguous titles", async () => {
    mockCalendar();
    resolveCalendarBlockByTitle.mockResolvedValue({
      eventId: null,
      title: null,
      warnings: [
        'Multiple calendar blocks matched "gym" (Gym, Gym with Cecil) — skipping to avoid a wrong link',
      ],
    });
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "start_timer", {
      title: "Workout",
      calendarTitle: "gym",
    });
    expect(result.ok).toBe(true);
    expect(
      result.warnings.some((w) => w.includes("Multiple calendar blocks matched")),
    ).toBe(true);
    expect((result.normalizedInput as Record<string, unknown>).calendarEventId).toBeNull();
  });
});

// ── Auto-suggestions (never auto-applied) ───────────────────────────────────

describe("calendar link suggestions", () => {
  it("suggests a block when start_timer fires within 15 min of a block start", async () => {
    mockCalendar();
    suggestCalendarLinkForStart.mockResolvedValue({
      eventId: "event-near",
      title: "Gym",
    });
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "start_timer", { title: "Workout" });
    expect(result.ok).toBe(true);
    expect(result.suggestedCalendarLink).toEqual({
      eventId: "event-near",
      title: "Gym",
    });
    // Suggested, NOT applied: no link written, nothing in normalized input.
    expect(setEntryCalendarLink).not.toHaveBeenCalled();
    expect((result.normalizedInput as Record<string, unknown>).calendarEventId).toBeNull();
    expect((result.normalizedInput as Record<string, unknown>).suggestedCalendarLink).toEqual({
      eventId: "event-near",
      title: "Gym",
    });
  });

  it("suggests a block when a logged entry overlaps a block", async () => {
    mockCalendar();
    suggestCalendarLinkForRange.mockResolvedValue({
      eventId: "event-overlap",
      title: "Deep work",
    });
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "log_time_entry", {
      title: "Coding",
      startedAt: "2026-10-15T09:00:00.000Z",
      endedAt: "2026-10-15T10:00:00.000Z",
    });
    expect(result.ok).toBe(true);
    expect(result.suggestedCalendarLink).toEqual({
      eventId: "event-overlap",
      title: "Deep work",
    });
    expect(setEntryCalendarLink).not.toHaveBeenCalled();
  });

  it("execute passes the suggestion through without applying it", async () => {
    mockCalendar();
    suggestCalendarLinkForStart.mockResolvedValue({
      eventId: "event-near",
      title: "Gym",
    });
    const { executeAction } = await import("@/lib/assistant-action-executor");
    const result = await executeAction("user-1", "start_timer", { title: "Workout" });
    expect(result.ok).toBe(true);
    expect(result.suggestedCalendarLink).toEqual({
      eventId: "event-near",
      title: "Gym",
    });
    expect(setEntryCalendarLink).not.toHaveBeenCalled();
  });

  it("returns null when far from any block", async () => {
    mockCalendar();
    suggestCalendarLinkForStart.mockResolvedValue(null);
    suggestCalendarLinkForRange.mockResolvedValue(null);
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const start = await previewAction("user-1", "start_timer", { title: "Workout" });
    expect(start.ok).toBe(true);
    expect(start.suggestedCalendarLink).toBeNull();
    const log = await previewAction("user-1", "log_time_entry", {
      title: "Coding",
      startedAt: "2026-10-15T09:00:00.000Z",
      endedAt: "2026-10-15T10:00:00.000Z",
    });
    expect(log.ok).toBe(true);
    expect(log.suggestedCalendarLink).toBeNull();
  });

  it("skips the suggestion when a link was explicitly provided", async () => {
    mockCalendar(() => ({ id: "event-1", title: "Standup" }));
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "start_timer", {
      title: "Standup notes",
      calendarEventId: "event-1",
    });
    expect(result.ok).toBe(true);
    expect(suggestCalendarLinkForStart).not.toHaveBeenCalled();
    expect(result.suggestedCalendarLink).toBeNull();
  });
});

// ── Confirmation gating unchanged ───────────────────────────────────────────

describe("risk and confirmation gating", () => {
  it("start_timer stays medium risk with confirmation required", () => {
    expect(ACTION_REGISTRY["start_timer"]!.risk).toBe("medium");
    expect(ACTION_REGISTRY["start_timer"]!.confirmationRequired).toBe(true);
  });

  it("log_time_entry stays medium risk with confirmation required", () => {
    expect(ACTION_REGISTRY["log_time_entry"]!.risk).toBe("medium");
    expect(ACTION_REGISTRY["log_time_entry"]!.confirmationRequired).toBe(true);
  });
});
