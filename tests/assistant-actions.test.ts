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
