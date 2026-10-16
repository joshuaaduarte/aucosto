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
const PERSON_ANABEL = { ...PERSON_ANA, id: "person-anabel", displayName: "Anabel" };

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

function mockTimeService() {
  const startEntry = vi.fn().mockResolvedValue({ id: "entry-new", label: "Tennis" });
  const createPastEntry = vi
    .fn()
    .mockResolvedValue({ id: "entry-past", label: "Dinner" });
  const updateEntry = vi
    .fn()
    .mockResolvedValue({ id: "entry-1", label: "Deep work" });
  vi.doMock("@/lib/services/time", () => ({
    getRunningEntry: vi.fn().mockResolvedValue(null),
    startEntry,
    stopRunning: vi.fn(),
    updateEntry,
    createPastEntry,
    getTimeEntry: vi.fn().mockResolvedValue({
      id: "entry-1",
      label: "Deep work",
      category: "work",
      startedAt: new Date("2026-10-15T13:00:00.000Z"),
      endedAt: new Date("2026-10-15T14:00:00.000Z"),
    }),
  }));
  return { startEntry, createPastEntry, updateEntry };
}

describe("resolvePeopleByNames", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("links an exact display-name match", async () => {
    mockTimePeople();
    mockRolodex(() => [PERSON_ANA]);
    mockTimeService();
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "log_time_entry", {
      title: "Tennis",
      startedAt: "2026-10-15T13:00:00.000Z",
      endedAt: "2026-10-15T14:00:00.000Z",
      personNames: ["Ana"],
    });
    expect(result.ok).toBe(true);
    expect(result.previewText).toContain("with Ana");
    expect(result.warnings).toHaveLength(0);
    const input = result.normalizedInput as Record<string, unknown>;
    expect(input.personIds).toEqual(["person-ana"]);
  });

  it("warns and skips unknown names instead of failing", async () => {
    mockTimePeople();
    mockRolodex(() => []);
    mockTimeService();
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "log_time_entry", {
      title: "Coffee",
      startedAt: "2026-10-15T13:00:00.000Z",
      endedAt: "2026-10-15T13:30:00.000Z",
      personNames: ["Nobody Here"],
    });
    expect(result.ok).toBe(true);
    expect(
      result.warnings.some((w) => w.includes('No Rolodex person matched "Nobody Here"')),
    ).toBe(true);
    const input = result.normalizedInput as Record<string, unknown>;
    expect(input.personIds).toEqual([]);
  });

  it("warns and skips ambiguous names instead of guessing", async () => {
    mockTimePeople();
    // "An" matches both Ana and Anabel with no exact match -> ambiguous
    mockRolodex(() => [PERSON_ANA, PERSON_ANABEL]);
    mockTimeService();
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "log_time_entry", {
      title: "Lunch",
      startedAt: "2026-10-15T13:00:00.000Z",
      endedAt: "2026-10-15T13:30:00.000Z",
      personNames: ["An"],
    });
    expect(result.ok).toBe(true);
    expect(
      result.warnings.some((w) => w.includes("Multiple people matched")),
    ).toBe(true);
    const input = result.normalizedInput as Record<string, unknown>;
    expect(input.personIds).toEqual([]);
  });
});

describe("person linking on execute", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("start_timer links resolved people", async () => {
    const setEntryPeople = mockTimePeople();
    mockRolodex(() => [PERSON_ANA]);
    mockTimeService();
    const { executeAction } = await import("@/lib/assistant-action-executor");
    const result = await executeAction("user-1", "start_timer", {
      title: "Tennis",
      personNames: ["Ana"],
    });
    expect(result.ok).toBe(true);
    expect(setEntryPeople).toHaveBeenCalledOnce();
    expect(setEntryPeople).toHaveBeenCalledWith("user-1", "entry-new", [
      "person-ana",
    ]);
  });

  it("log_time_entry links resolved people", async () => {
    const setEntryPeople = mockTimePeople();
    mockRolodex(() => [PERSON_ANA]);
    mockTimeService();
    const { executeAction } = await import("@/lib/assistant-action-executor");
    const result = await executeAction("user-1", "log_time_entry", {
      title: "Dinner",
      startedAt: "2026-10-15T18:00:00.000Z",
      endedAt: "2026-10-15T19:00:00.000Z",
      personNames: ["ana"], // case-insensitive
    });
    expect(result.ok).toBe(true);
    expect(setEntryPeople).toHaveBeenCalledWith("user-1", "entry-past", [
      "person-ana",
    ]);
  });

  it("edit_time_entry replaces the link set", async () => {
    const setEntryPeople = mockTimePeople();
    mockRolodex(() => [PERSON_ANA]);
    mockTimeService();
    const { executeAction } = await import("@/lib/assistant-action-executor");
    const result = await executeAction("user-1", "edit_time_entry", {
      entryId: "entry-1",
      personNames: ["Ana"],
    });
    expect(result.ok).toBe(true);
    expect(setEntryPeople).toHaveBeenCalledWith("user-1", "entry-1", [
      "person-ana",
    ]);
  });

  it("edit_time_entry with empty personNames clears links", async () => {
    const setEntryPeople = mockTimePeople();
    mockRolodex(() => []);
    mockTimeService();
    const { executeAction } = await import("@/lib/assistant-action-executor");
    const result = await executeAction("user-1", "edit_time_entry", {
      entryId: "entry-1",
      personNames: [],
    });
    expect(result.ok).toBe(true);
    expect(setEntryPeople).toHaveBeenCalledWith("user-1", "entry-1", []);
  });

  it("omitting personNames leaves links untouched on edit", async () => {
    const setEntryPeople = mockTimePeople();
    mockRolodex(() => [PERSON_ANA]);
    mockTimeService();
    const { executeAction } = await import("@/lib/assistant-action-executor");
    const result = await executeAction("user-1", "edit_time_entry", {
      entryId: "entry-1",
      title: "Deep work!!",
    });
    expect(result.ok).toBe(true);
    expect(setEntryPeople).not.toHaveBeenCalled();
  });
});

