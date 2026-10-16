import { describe, it, expect, vi, beforeEach } from "vitest";

const PERSON_ANA = {
  id: "person-ana",
  displayName: "Ana",
  firstName: "Ana",
  lastName: null,
  aliases: [],
  contactKind: "person",
  relationshipType: "spouse",
  organization: null,
  birthday: null,
  createdAt: "2026-01-01",
  lastInteractionAt: null,
};

function mockTimePeople(setEntryPeople = vi.fn()) {
  vi.doMock("@/lib/services/time-people", () => ({
    setEntryPeople,
    listEntryPeople: vi.fn(),
    personTimeSummary: vi.fn(),
  }));
  return setEntryPeople;
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

function mockTimeCalendar(setEntryCalendarLink = vi.fn()) {
  vi.doMock("@/lib/services/time-calendar", () => ({
    setEntryCalendarLink,
    resolveCalendarBlockByTitle: vi.fn().mockResolvedValue({
      eventId: null,
      title: null,
      warnings: ["Calendar title not resolved"],
    }),
    suggestCalendarLinkForRange: vi.fn().mockResolvedValue(null),
    suggestCalendarLinkForStart: vi.fn().mockResolvedValue(null),
  }));
  return setEntryCalendarLink;
}

function mockTimeService(impl?: (u: string, input: { label: string }) => unknown) {
  let counter = 0;
  const createPastEntry = vi.fn().mockImplementation((u: string, input: { label: string }) => {
    if (impl) return impl(u, input);
    counter += 1;
    return Promise.resolve({ id: `entry-${counter}`, label: input.label });
  });
  vi.doMock("@/lib/services/time", () => ({
    getRunningEntry: vi.fn().mockResolvedValue(null),
    startEntry: vi.fn().mockResolvedValue({ id: "entry-new", label: "New" }),
    stopRunning: vi.fn(),
    updateEntry: vi.fn(),
    createPastEntry,
    listRecentEntries: vi.fn().mockResolvedValue([]),
  }));
  return createPastEntry;
}

const entry = (title: string, start: string, end: string, extra = {}) => ({
  title,
  startedAt: start,
  endedAt: end,
  ...extra,
});

describe("log_time_entries validation", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("rejects an empty entries array with an actionable error", async () => {
    mockTimePeople();
    mockRolodex(() => []);
    mockTimeService();
    mockTimeCalendar();
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "log_time_entries", {
      entries: [],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/at least 1/);
  });

  it("rejects more than 50 entries with a message to split", async () => {
    mockTimePeople();
    mockRolodex(() => []);
    mockTimeService();
    mockTimeCalendar();
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const entries = Array.from({ length: 51 }, (_, i) =>
      entry(`Entry ${i}`, "2026-10-16T08:00:00.000Z", "2026-10-16T08:30:00.000Z"),
    );
    const result = await previewAction("user-1", "log_time_entries", {
      entries,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/split/i);
  });

  it("validates every entry before writing any (all-or-nothing)", async () => {
    mockTimePeople();
    mockRolodex(() => []);
    const createPastEntry = mockTimeService();
    mockTimeCalendar();
    const { executeAction } = await import("@/lib/assistant-action-executor");
    const result = await executeAction("user-1", "log_time_entries", {
      entries: [
        entry("Morning run", "2026-10-16T06:30:00.000Z", "2026-10-16T07:15:00.000Z"),
        // endedAt before startedAt — invalid
        entry("Bad entry", "2026-10-16T09:00:00.000Z", "2026-10-16T08:00:00.000Z"),
        entry("Lunch", "2026-10-16T12:00:00.000Z", "2026-10-16T12:45:00.000Z"),
      ],
    });
    expect(result.ok).toBe(false);
    expect(createPastEntry).not.toHaveBeenCalled();
  });

  it("indexes per-entry errors with index and title", async () => {
    mockTimePeople();
    mockRolodex(() => []);
    mockTimeService();
    mockTimeCalendar();
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "log_time_entries", {
      entries: [
        entry("Good entry", "2026-10-16T06:30:00.000Z", "2026-10-16T07:15:00.000Z"),
        // endedAt before startedAt
        entry("Bad timing", "2026-10-16T09:00:00.000Z", "2026-10-16T08:00:00.000Z"),
        // invalid startedAt
        { title: "Bad date", startedAt: "not-a-date", endedAt: "2026-10-16T12:45:00.000Z" },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('entries[1] "Bad timing"');
    expect(result.error).toContain('entries[2] "Bad date"');
    expect(result.error).toMatch(/No entries logged — 2 of 3 failed validation/);
  });
});

describe("log_time_entries preview", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("shows a compact table of all entries with totals", async () => {
    mockTimePeople();
    mockRolodex(() => [PERSON_ANA]);
    mockTimeService();
    mockTimeCalendar();
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "log_time_entries", {
      entries: [
        entry("Morning run", "2026-10-16T06:30:00.000Z", "2026-10-16T07:15:00.000Z", {
          categoryName: "run",
          personNames: ["Ana"],
        }),
        entry("Deep work", "2026-10-16T09:00:00.000Z", "2026-10-16T11:30:00.000Z", {
          categoryName: "work",
        }),
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.previewText).toContain("Log 2 time entries (3h 15m total)");
    expect(result.previewText).toContain('[0] "Morning run"');
    expect(result.previewText).toContain('[1] "Deep work"');
    expect(result.previewText).toContain("45m");
    expect(result.previewText).toContain("2h 30m");
    expect(result.previewText).toContain("with Ana");
    const input = result.normalizedInput as Record<string, unknown>;
    const entries = input.entries as Array<{ personIds: string[] }>;
    expect(entries).toHaveLength(2);
    expect(entries[0]!.personIds).toEqual(["person-ana"]);
    expect(entries[1]!.personIds).toEqual([]);
  });

  it("prefixes warnings with the entry index", async () => {
    mockTimePeople();
    mockRolodex(() => []); // unknown person
    mockTimeService();
    mockTimeCalendar();
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "log_time_entries", {
      entries: [
        entry("Tennis", "2026-10-16T18:00:00.000Z", "2026-10-16T19:00:00.000Z", {
          personNames: ["Nobody Here"],
        }),
        entry("Dinner", "2026-10-16T19:30:00.000Z", "2026-10-16T20:00:00.000Z"),
      ],
    });
    expect(result.ok).toBe(true);
    expect(
      result.warnings.some((w) =>
        w.startsWith('[0] No Rolodex person matched "Nobody Here"'),
      ),
    ).toBe(true);
  });

  it("reuses warn-and-skip calendar resolution per entry", async () => {
    mockTimePeople();
    mockRolodex(() => []);
    const setEntryCalendarLink = mockTimeCalendar();
    mockTimeService();
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "log_time_entries", {
      entries: [
        entry("Standup overlap", "2026-10-16T09:00:00.000Z", "2026-10-16T09:15:00.000Z", {
          calendarTitle: "Some block",
        }),
      ],
    });
    expect(result.ok).toBe(true);
    expect(
      result.warnings.some((w) => w.startsWith("[0]") && w.includes("Calendar title")),
    ).toBe(true);
    // The unresolved calendar title never linked anything on execute either
    const { executeAction } = await import("@/lib/assistant-action-executor");
    const exec = await executeAction("user-1", "log_time_entries", {
      entries: [
        entry("Standup overlap", "2026-10-16T09:00:00.000Z", "2026-10-16T09:15:00.000Z", {
          calendarTitle: "Some block",
        }),
      ],
    });
    expect(exec.ok).toBe(true);
    expect(setEntryCalendarLink).not.toHaveBeenCalled();
  });
});

describe("log_time_entries execute", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("writes all entries in order and returns per-entry ids", async () => {
    const setEntryPeople = mockTimePeople();
    mockRolodex(() => [PERSON_ANA]);
    const createPastEntry = mockTimeService();
    mockTimeCalendar();
    const { executeAction } = await import("@/lib/assistant-action-executor");
    const result = await executeAction("user-1", "log_time_entries", {
      entries: [
        entry("Morning run", "2026-10-16T06:30:00.000Z", "2026-10-16T07:15:00.000Z", {
          categoryName: "run",
          personNames: ["Ana"],
        }),
        entry("Deep work", "2026-10-16T09:00:00.000Z", "2026-10-16T11:30:00.000Z"),
        entry("Lunch", "2026-10-16T12:00:00.000Z", "2026-10-16T12:45:00.000Z"),
      ],
    });
    expect(result.ok).toBe(true);
    expect(createPastEntry).toHaveBeenCalledTimes(3);
    expect(createPastEntry).toHaveBeenNthCalledWith(
      1,
      "user-1",
      expect.objectContaining({ label: "Morning run" }),
    );
    expect(createPastEntry).toHaveBeenNthCalledWith(
      3,
      "user-1",
      expect.objectContaining({ label: "Lunch" }),
    );
    // People linked to the right entry (the one resolved in preview order)
    expect(setEntryPeople).toHaveBeenCalledWith("user-1", "entry-1", ["person-ana"]);
    expect(result.summary).toContain("Logged 3 time entries (4h total)");
    const entries = result.entries ?? [];
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.index)).toEqual([0, 1, 2]);
    expect(entries.map((e) => e.recordId)).toEqual([
      "entry-1",
      "entry-2",
      "entry-3",
    ]);
  });

  it("reports which entries failed mid-batch instead of dropping them", async () => {
    mockTimePeople();
    mockRolodex(() => []);
    const createPastEntry = mockTimeService((u, input) => {
      if (input.label === "Broken") {
        return Promise.reject(new Error("DB exploded"));
      }
      return Promise.resolve({ id: `ok-${input.label}`, label: input.label });
    });
    mockTimeCalendar();
    const { executeAction } = await import("@/lib/assistant-action-executor");
    const result = await executeAction("user-1", "log_time_entries", {
      entries: [
        entry("Morning run", "2026-10-16T06:30:00.000Z", "2026-10-16T07:15:00.000Z"),
        entry("Broken", "2026-10-16T08:00:00.000Z", "2026-10-16T08:30:00.000Z"),
        entry("Lunch", "2026-10-16T12:00:00.000Z", "2026-10-16T12:45:00.000Z"),
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Logged 2 of 3 time entries");
    expect(result.error).toContain('[1] "Broken": DB exploded');
    expect(createPastEntry).toHaveBeenCalledTimes(3);
    const entries = result.entries ?? [];
    expect(entries[0]!.recordId).toBe("ok-Morning run");
    expect(entries[1]!.recordId).toBeNull();
    expect(entries[1]!.error).toBe("DB exploded");
    expect(entries[2]!.recordId).toBe("ok-Lunch");
  });

  it("links resolved calendar events per entry", async () => {
    mockTimePeople();
    mockRolodex(() => []);
    const setEntryCalendarLink = vi.fn();
    vi.doMock("@/lib/services/time-calendar", () => ({
      setEntryCalendarLink,
      resolveCalendarBlockByTitle: vi.fn().mockResolvedValue({
        eventId: null,
        title: null,
        warnings: [],
      }),
      suggestCalendarLinkForRange: vi.fn().mockResolvedValue(null),
      suggestCalendarLinkForStart: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock("@/lib/services/calendar", () => ({
      createCalendarItem: vi.fn(),
      getCalendarItem: vi.fn().mockResolvedValue({ id: "cal-1", title: "Standup" }),
      updateCalendarItem: vi.fn(),
      deleteCalendarItem: vi.fn(),
    }));
    const createPastEntry = mockTimeService();
    const { executeAction } = await import("@/lib/assistant-action-executor");
    const result = await executeAction("user-1", "log_time_entries", {
      entries: [
        entry("Standup", "2026-10-16T09:00:00.000Z", "2026-10-16T09:15:00.000Z", {
          calendarEventId: "cal-1",
        }),
      ],
    });
    expect(result.ok).toBe(true);
    expect(createPastEntry).toHaveBeenCalledOnce();
    expect(setEntryCalendarLink).toHaveBeenCalledWith("user-1", "entry-1", "cal-1");
  });
});
