// delete_time_entry assistant action: preview/execute, refusals, link cleanup.
// Run with: npm test -- tests/delete-time-entry.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

import { ACTION_REGISTRY } from "@/lib/assistant-actions";

const COMPLETED = {
  id: "entry-1",
  label: "Deep work",
  category: "work",
  startedAt: new Date("2026-10-15T13:00:00.000Z"),
  endedAt: new Date("2026-10-15T14:30:00.000Z"), // 90 min
};

const RUNNING = {
  id: "entry-running",
  label: "Commute",
  category: "commute",
  startedAt: new Date("2026-10-15T16:00:00.000Z"),
  endedAt: null,
};

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

interface Mocks {
  listRecentEntries: ReturnType<typeof vi.fn>;
  deleteEntry: ReturnType<typeof vi.fn>;
  listEntryPeople: ReturnType<typeof vi.fn>;
  clearEntryPeople: ReturnType<typeof vi.fn>;
  listPersons: ReturnType<typeof vi.fn>;
}

function installMocks(entries: unknown[]): Mocks {
  const listRecentEntries = vi.fn().mockResolvedValue(entries);
  const deleteEntry = vi.fn().mockResolvedValue(undefined);
  const listEntryPeople = vi.fn().mockResolvedValue([]);
  const clearEntryPeople = vi.fn().mockResolvedValue(undefined);
  const listPersons = vi.fn().mockResolvedValue([]);

  vi.doMock("@/lib/services/time", () => ({
    getRunningEntry: vi.fn().mockResolvedValue(null),
    startEntry: vi.fn(),
    stopRunning: vi.fn(),
    updateEntry: vi.fn(),
    createPastEntry: vi.fn(),
    listRecentEntries,
    deleteEntry,
  }));
  vi.doMock("@/lib/services/time-people", () => ({
    setEntryPeople: vi.fn(),
    listEntryPeople,
    clearEntryPeople,
    personTimeSummary: vi.fn(),
  }));
  vi.doMock("@/lib/services/rolodex", () => ({
    findPersonByName: vi.fn(),
    createPerson: vi.fn(),
    updatePerson: vi.fn(),
    addInteraction: vi.fn(),
    getPerson: vi.fn(),
    listPersons,
  }));

  return { listRecentEntries, deleteEntry, listEntryPeople, clearEntryPeople, listPersons };
}

describe("delete_time_entry registry", () => {
  it("is medium risk", () => {
    expect(ACTION_REGISTRY["delete_time_entry"]!.risk).toBe("medium");
  });

  it("requires confirmation", () => {
    expect(ACTION_REGISTRY["delete_time_entry"]!.confirmationRequired).toBe(true);
  });

  it("is supported", () => {
    expect(ACTION_REGISTRY["delete_time_entry"]!.supported).toBe(true);
  });
});

describe("previewDeleteTimeEntry", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("shows title, start/end, duration, and category", async () => {
    installMocks([COMPLETED]);
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "delete_time_entry", {
      entryId: "entry-1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.previewText).toContain("Delete time entry: Deep work");
    expect(result.previewText).toContain("1h 30m");
    expect(result.previewText).toContain("Category: work");
    expect(result.normalizedInput).toMatchObject({
      entryId: "entry-1",
      beforeTitle: "Deep work",
    });
  });

  it("names linked people whose links will be removed", async () => {
    const mocks = installMocks([COMPLETED]);
    mocks.listEntryPeople.mockResolvedValue(["person-ana"]);
    mocks.listPersons.mockResolvedValue([PERSON_ANA]);
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "delete_time_entry", {
      entryId: "entry-1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.previewText).toContain("Linked people (links removed): Ana");
  });

  it("falls back to person IDs when Rolodex lookup fails", async () => {
    const mocks = installMocks([COMPLETED]);
    mocks.listEntryPeople.mockResolvedValue(["person-ana"]);
    mocks.listPersons.mockRejectedValue(new Error("rolodex down"));
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "delete_time_entry", {
      entryId: "entry-1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.previewText).toContain(
      "Linked people (links removed): person-ana",
    );
  });

  it("returns a clean error when the entry is not found", async () => {
    installMocks([COMPLETED]);
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "delete_time_entry", {
      entryId: "nope",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Time entry "nope" not found');
  });

  it("refuses a running timer and names stop_timer", async () => {
    installMocks([RUNNING]);
    const { previewAction } = await import("@/lib/assistant-action-executor");
    const result = await previewAction("user-1", "delete_time_entry", {
      entryId: "entry-running",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("running timer");
    expect(result.error).toContain("stop_timer");
  });

  it("rejects missing or empty entryId", async () => {
    installMocks([COMPLETED]);
    const { previewAction } = await import("@/lib/assistant-action-executor");
    for (const raw of [{}, { entryId: "" }]) {
      const result = await previewAction("user-1", "delete_time_entry", raw);
      expect(result.ok).toBe(false);
    }
  });
});

describe("executeDeleteTimeEntry", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("deletes the entry and clears its people links first", async () => {
    const mocks = installMocks([COMPLETED]);
    mocks.listEntryPeople.mockResolvedValue(["person-ana"]);
    const { executeAction } = await import("@/lib/assistant-action-executor");
    const result = await executeAction("user-1", "delete_time_entry", {
      entryId: "entry-1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recordId).toBe("entry-1");
    expect(result.recordType).toBe("TimeEntry");
    expect(result.summary).toContain("Deep work");

    expect(mocks.clearEntryPeople).toHaveBeenCalledWith("user-1", "entry-1");
    expect(mocks.deleteEntry).toHaveBeenCalledWith("user-1", "entry-1");
    // Links are cleared before the entry itself is deleted.
    const clearOrder = mocks.clearEntryPeople.mock.invocationCallOrder[0]!;
    const deleteOrder = mocks.deleteEntry.mock.invocationCallOrder[0]!;
    expect(clearOrder).toBeLessThan(deleteOrder);
  });

  it("is a no-op error when the entry is not found", async () => {
    const mocks = installMocks([COMPLETED]);
    const { executeAction } = await import("@/lib/assistant-action-executor");
    const result = await executeAction("user-1", "delete_time_entry", {
      entryId: "nope",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Time entry "nope" not found');
    expect(mocks.deleteEntry).not.toHaveBeenCalled();
    expect(mocks.clearEntryPeople).not.toHaveBeenCalled();
  });

  it("refuses a running timer without deleting anything", async () => {
    const mocks = installMocks([RUNNING]);
    const { executeAction } = await import("@/lib/assistant-action-executor");
    const result = await executeAction("user-1", "delete_time_entry", {
      entryId: "entry-running",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("stop_timer");
    expect(mocks.deleteEntry).not.toHaveBeenCalled();
    expect(mocks.clearEntryPeople).not.toHaveBeenCalled();
  });
});
