import { describe, it, expect, vi, beforeEach } from "vitest";
import { ACTION_REGISTRY } from "@/lib/assistant-actions";

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

const RUNNING_ENTRY = {
  id: "entry-1",
  label: "Commute",
  category: "commute",
  startedAt: new Date(Date.now() - 42 * 60 * 1000), // 42 min ago
  endedAt: null,
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

function mockTimeCategories() {
  vi.doMock("@/lib/services/time-categories", () => ({
    listTimeCategories: vi.fn().mockResolvedValue([{ name: "Exercise" }]),
  }));
}

function mockTimeService(running: unknown) {
  const stopRunning = vi.fn().mockResolvedValue(undefined);
  const updateEntry = vi.fn().mockResolvedValue({ id: "entry-1", label: "Commute" });
  const startEntry = vi
    .fn()
    .mockImplementation((_userId: string, input: { label: string }) =>
      Promise.resolve({ id: "entry-new", label: input.label }),
    );
  vi.doMock("@/lib/services/time", () => ({
    getRunningEntry: vi.fn().mockResolvedValue(running),
    startEntry,
    stopRunning,
    updateEntry,
    createPastEntry: vi.fn(),
    listRecentEntries: vi.fn().mockResolvedValue([]),
  }));
  return { startEntry, stopRunning, updateEntry };
}

describe("swap_timer: registry", () => {
  it("has medium risk and requires confirmation", () => {
    const def = ACTION_REGISTRY["swap_timer"]!;
    expect(def.risk).toBe("medium");
    expect(def.confirmationRequired).toBe(true);
    expect(def.supported).toBe(true);
    expect(def.description.length).toBeGreaterThan(0);
  });
});

describe("swap_timer preview", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("describes both halves when a timer is running", async () => {
    mockTimePeople();
    mockRolodex(() => []);
    mockTimeService(RUNNING_ENTRY);
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "swap_timer", {
      title: "Deep work",
    });

    expect(result.ok).toBe(true);
    expect(result.previewText).toContain(
      'Stop "Commute" (running 42m) and start "Deep work"',
    );
    const n = result.normalizedInput as Record<string, unknown>;
    expect(n.title).toBe("Deep work");
    expect(n.stoppedEntryId).toBe("entry-1");
    expect(n.stoppedLabel).toBe("Commute");
    expect(n.note).toBeNull();
  });

  it("includes the note line when a note is provided", async () => {
    mockTimePeople();
    mockRolodex(() => []);
    mockTimeService(RUNNING_ENTRY);
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "swap_timer", {
      title: "Deep work",
      note: "Finished the repair dashboard",
    });

    expect(result.ok).toBe(true);
    expect(result.previewText).toContain(
      'Note saved on stopped entry: "Finished the repair dashboard"',
    );
    const n = result.normalizedInput as Record<string, unknown>;
    expect(n.note).toBe("Finished the repair dashboard");
  });

  it("shows just the start when no timer is running and warns the note is ignored", async () => {
    mockTimePeople();
    mockRolodex(() => []);
    mockTimeService(null);
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "swap_timer", {
      title: "Deep work",
      note: "nowhere to save this",
    });

    expect(result.ok).toBe(true);
    expect(result.previewText).toBe('Start timer "Deep work"');
    expect(
      result.warnings.some((w) => w.includes("No timer is currently running")),
    ).toBe(true);
    const n = result.normalizedInput as Record<string, unknown>;
    expect(n.note).toBeNull();
    expect(n.stoppedEntryId).toBeNull();
    expect(n.stoppedLabel).toBeNull();
  });

  it("does not warn when there is no timer and no note", async () => {
    mockTimePeople();
    mockRolodex(() => []);
    mockTimeService(null);
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "swap_timer", {
      title: "Deep work",
    });

    expect(result.ok).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("mentions category and resolved people for the new timer", async () => {
    mockTimePeople();
    mockRolodex(() => [PERSON_ANA]);
    mockTimeService(RUNNING_ENTRY);
    mockTimeCategories();
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "swap_timer", {
      title: "Tennis",
      categoryName: "exercise",
      personNames: ["Ana"],
    });

    expect(result.ok).toBe(true);
    expect(result.previewText).toContain(
      'Stop "Commute" (running 42m) and start "Tennis" [Exercise] · with Ana',
    );
    const n = result.normalizedInput as Record<string, unknown>;
    expect(n.personIds).toEqual(["person-ana"]);
    // Exact case-insensitive match normalizes to the stored category name.
    expect(n.category).toBe("Exercise");
  });

  it("rejects an empty title", async () => {
    mockTimePeople();
    mockRolodex(() => []);
    mockTimeService(null);
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "swap_timer", { title: "" });

    expect(result.ok).toBe(false);
  });
});

describe("swap_timer execute", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("stops the running timer and starts the new one at the same instant", async () => {
    mockTimePeople();
    mockRolodex(() => []);
    const { startEntry, stopRunning, updateEntry } =
      mockTimeService(RUNNING_ENTRY);
    const { executeAction } = await import("@/lib/assistant-action-executor");
    const result = await executeAction("user-1", "swap_timer", {
      title: "Deep work",
    });

    expect(result.ok).toBe(true);
    expect(result.recordId).toBe("entry-new");
    expect(result.recordType).toBe("TimeEntry");
    expect(result.summary).toBe('Stopped "Commute" and started "Deep work"');

    // Stop happened with an explicit end time...
    expect(stopRunning).toHaveBeenCalledOnce();
    expect(stopRunning.mock.calls[0]![0]).toBe("user-1");
    const stoppedAt = stopRunning.mock.calls[0]![1] as Date;
    expect(stoppedAt).toBeInstanceOf(Date);

    // ...and the new timer starts at that exact instant (no gap, no overlap).
    expect(startEntry).toHaveBeenCalledOnce();
    const startInput = startEntry.mock.calls[0]![1] as { label: string; startedAt: Date };
    expect(startInput.label).toBe("Deep work");
    expect(startInput.startedAt.getTime()).toBe(stoppedAt.getTime());

    // No note provided -> nothing written onto the stopped entry.
    expect(updateEntry).not.toHaveBeenCalled();
  });

  it("saves the note onto the stopped entry", async () => {
    mockTimePeople();
    mockRolodex(() => []);
    const { updateEntry } = mockTimeService(RUNNING_ENTRY);
    const { executeAction } = await import("@/lib/assistant-action-executor");
    const result = await executeAction("user-1", "swap_timer", {
      title: "Deep work",
      note: "Finished the repair dashboard",
    });

    expect(result.ok).toBe(true);
    expect(updateEntry).toHaveBeenCalledOnce();
    expect(updateEntry).toHaveBeenCalledWith("user-1", "entry-1", {
      notes: "Finished the repair dashboard",
    });
  });

  it("just starts when no timer is running", async () => {
    mockTimePeople();
    mockRolodex(() => []);
    const { startEntry, stopRunning, updateEntry } = mockTimeService(null);
    const { executeAction } = await import("@/lib/assistant-action-executor");
    const result = await executeAction("user-1", "swap_timer", {
      title: "Solo work",
      note: "ignored — nowhere to save it",
    });

    expect(result.ok).toBe(true);
    expect(result.recordId).toBe("entry-new");
    expect(result.summary).toBe(
      'Started "Solo work" (no timer was running)',
    );
    expect(stopRunning).not.toHaveBeenCalled();
    expect(updateEntry).not.toHaveBeenCalled();
    expect(startEntry).toHaveBeenCalledOnce();
    const startInput = startEntry.mock.calls[0]![1] as { label: string };
    expect(startInput.label).toBe("Solo work");
  });

  it("links resolved people to the new timer", async () => {
    const setEntryPeople = mockTimePeople();
    mockRolodex(() => [PERSON_ANA]);
    mockTimeService(RUNNING_ENTRY);
    const { executeAction } = await import("@/lib/assistant-action-executor");
    const result = await executeAction("user-1", "swap_timer", {
      title: "Tennis",
      personNames: ["Ana"],
    });

    expect(result.ok).toBe(true);
    expect(setEntryPeople).toHaveBeenCalledOnce();
    expect(setEntryPeople).toHaveBeenCalledWith("user-1", "entry-new", [
      "person-ana",
    ]);
  });

  it("does not touch people links when personNames is omitted", async () => {
    const setEntryPeople = mockTimePeople();
    mockRolodex(() => [PERSON_ANA]);
    mockTimeService(RUNNING_ENTRY);
    const { executeAction } = await import("@/lib/assistant-action-executor");
    const result = await executeAction("user-1", "swap_timer", {
      title: "Deep work",
    });

    expect(result.ok).toBe(true);
    expect(setEntryPeople).not.toHaveBeenCalled();
  });

  it("fails validation before touching anything when the title is invalid", async () => {
    mockTimePeople();
    mockRolodex(() => []);
    const { startEntry, stopRunning } = mockTimeService(RUNNING_ENTRY);
    const { executeAction } = await import("@/lib/assistant-action-executor");
    const result = await executeAction("user-1", "swap_timer", { title: "" });

    expect(result.ok).toBe(false);
    expect(stopRunning).not.toHaveBeenCalled();
    expect(startEntry).not.toHaveBeenCalled();
  });
});
