// Regression: buildAssistantSnapshot is a composite read over ~20 service
// calls. Per docs/lessons.md #4 ("layout reads must never throw"), a single
// failing service must degrade its section to empty/null — logged and listed
// in `degradedSections` — instead of 500ing the whole snapshot response.

import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  listCalendarItems: vi.fn(),
  listDoItems: vi.fn(),
  listRecentEvents: vi.fn(),
  listHabits: vi.fn(),
  listAccounts: vi.fn(),
  ensureProjectBoardTables: vi.fn(),
  listBoardProjects: vi.fn(),
  ensureProjectPlanningColumns: vi.fn(),
  listProjectPlanSummaries: vi.fn(),
  ensureRolodexTables: vi.fn(),
  getUpcomingBirthdays: vi.fn(),
  getDueFollowUps: vi.fn(),
  getRecentlyMentioned: vi.fn(),
  listUnresolvedMentions: vi.fn(),
  ensureInsightTables: vi.fn(),
  listRecentInsights: vi.fn(),
  getWorkAssistantSummary: vi.fn(),
  getReflection: vi.fn(),
  getUserProfile: vi.fn(),
  getTodayWakeStatus: vi.fn(),
  getRunningEntry: vi.fn(),
  listCompletedSince: vi.fn(),
  listEntriesBetween: vi.fn(),
}));

vi.mock("@/lib/services/calendar", () => ({
  listCalendarItems: mocks.listCalendarItems,
}));
vi.mock("@/lib/services/do", () => ({ listDoItems: mocks.listDoItems }));
vi.mock("@/lib/services/events", () => ({
  listRecentEvents: mocks.listRecentEvents,
}));
vi.mock("@/lib/services/habits", () => ({ listHabits: mocks.listHabits }));
vi.mock("@/lib/services/finance", () => ({
  listAccounts: mocks.listAccounts,
}));
vi.mock("@/lib/services/projects", () => ({
  ensureProjectBoardTables: mocks.ensureProjectBoardTables,
  listBoardProjects: mocks.listBoardProjects,
}));
vi.mock("@/lib/services/project-planning", () => ({
  ensureProjectPlanningColumns: mocks.ensureProjectPlanningColumns,
  listProjectPlanSummaries: mocks.listProjectPlanSummaries,
}));
vi.mock("@/lib/services/rolodex", () => ({
  ensureRolodexTables: mocks.ensureRolodexTables,
  getUpcomingBirthdays: mocks.getUpcomingBirthdays,
  getDueFollowUps: mocks.getDueFollowUps,
  getRecentlyMentioned: mocks.getRecentlyMentioned,
  listUnresolvedMentions: mocks.listUnresolvedMentions,
}));
vi.mock("@/lib/services/captured-insights", () => ({
  ensureInsightTables: mocks.ensureInsightTables,
  listRecentInsights: mocks.listRecentInsights,
}));
vi.mock("@/lib/services/work", () => ({
  getWorkAssistantSummary: mocks.getWorkAssistantSummary,
}));
vi.mock("@/lib/services/reflect", () => ({
  getReflection: mocks.getReflection,
}));
vi.mock("@/lib/services/user", () => ({
  getUserProfile: mocks.getUserProfile,
}));
vi.mock("@/lib/services/rhythms", () => ({
  getTodayWakeStatus: mocks.getTodayWakeStatus,
}));
vi.mock("@/lib/services/time", () => ({
  getRunningEntry: mocks.getRunningEntry,
  listCompletedSince: mocks.listCompletedSince,
  listEntriesBetween: mocks.listEntriesBetween,
}));

import {
  buildAssistantSnapshot,
  type AssistantSnapshot,
} from "@/lib/assistant-snapshot";

const UID = "user-1";
const D = (h: number, m = 0) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};

function seedHealthy() {
  mocks.ensureProjectBoardTables.mockResolvedValue(undefined);
  mocks.ensureProjectPlanningColumns.mockResolvedValue(undefined);
  mocks.ensureRolodexTables.mockResolvedValue(undefined);
  mocks.ensureInsightTables.mockResolvedValue(undefined);
  mocks.getRunningEntry.mockResolvedValue(null);
  mocks.listCalendarItems.mockResolvedValue([
    {
      title: "Deep work",
      startsAt: D(9),
      endsAt: D(11),
      status: "scheduled",
      sourceTool: null,
    },
  ]);
  mocks.listCompletedSince.mockResolvedValue([
    {
      label: "Morning routine",
      category: "routine",
      startedAt: D(6),
      endedAt: D(7),
    },
  ]);
  mocks.listEntriesBetween.mockResolvedValue([]);
  mocks.listDoItems.mockResolvedValue([
    {
      title: "Spec sheet",
      lane: "today",
      status: "open",
      projectName: "Dash",
      completedAt: null,
    },
  ]);
  mocks.listHabits.mockResolvedValue([
    {
      title: "Run",
      completedToday: false,
      currentStreak: 4,
      targetLabel: "daily",
      bucket: "health",
      dueToday: true,
      recentDays: [],
    },
  ]);
  mocks.listBoardProjects.mockResolvedValue([
    {
      id: "p1",
      name: "Dash",
      status: "active",
      momentum: { level: "alive" },
      lastWorkedAt: D(9),
      openTaskCount: 2,
      nextAction: "Finish spec",
    },
  ]);
  mocks.listRecentEvents.mockResolvedValue([
    { type: "time.started", tool: "time", at: D(9) },
  ]);
  mocks.getTodayWakeStatus.mockResolvedValue({
    captured: true,
    wakeTime: "06:30",
    source: "morning",
    morning: null,
    sleepMinutes: 420,
  });
  mocks.getReflection.mockResolvedValue(null);
  mocks.getUserProfile.mockResolvedValue({
    name: "Joshua",
    financeVisible: false,
  });
  mocks.listAccounts.mockResolvedValue([]);
  mocks.listProjectPlanSummaries.mockResolvedValue([]);
  mocks.getUpcomingBirthdays.mockResolvedValue([]);
  mocks.getDueFollowUps.mockResolvedValue([]);
  mocks.getRecentlyMentioned.mockResolvedValue([]);
  mocks.listUnresolvedMentions.mockResolvedValue([]);
  mocks.listRecentInsights.mockResolvedValue([]);
  mocks.getWorkAssistantSummary.mockResolvedValue(null);
}

beforeEach(() => {
  vi.clearAllMocks();
  seedHealthy();
});

describe("buildAssistantSnapshot — happy path", () => {
  it("builds, JSON-serializes, and reports no degraded sections", async () => {
    const snap = await buildAssistantSnapshot(UID);
    expect(snap.user.displayName).toBe("Joshua");
    expect(snap.facts.today.time.totalTrackedMinutes).toBe(60);
    expect(snap.facts.today.wokeUpAt).toBe("06:30");
    expect(snap.degradedSections).toEqual([]);
    // Must survive NextResponse.json()
    expect(() => JSON.stringify(snap)).not.toThrow();
  });
});

describe("buildAssistantSnapshot — single failing service degrades", () => {
  // [mock to break, section label, assertion on the degraded snapshot]
  const cases: Array<[string, () => void, (snap: AssistantSnapshot) => void]> = [
    [
      "time.running",
      () => mocks.getRunningEntry.mockRejectedValueOnce(new Error("boom")),
      (s) => expect(s.facts.today.time.runningTimer).toBeNull(),
    ],
    [
      "calendar.today",
      () => mocks.listCalendarItems.mockRejectedValueOnce(new Error("boom")),
      (s) => expect(s.facts.today.calendar.items).toEqual([]),
    ],
    [
      "time.completedToday",
      () => mocks.listCompletedSince.mockRejectedValueOnce(new Error("boom")),
      (s) => expect(s.facts.today.time.entries).toEqual([]),
    ],
    [
      "time.yesterday",
      () => mocks.listEntriesBetween.mockRejectedValueOnce(new Error("boom")),
      (s) => expect(s.facts.yesterday.trackedMinutes).toBe(0),
    ],
    [
      "do.items",
      () => mocks.listDoItems.mockRejectedValueOnce(new Error("boom")),
      (s) => expect(s.facts.today.tasks.open).toEqual([]),
    ],
    [
      "habits",
      () => mocks.listHabits.mockRejectedValueOnce(new Error("boom")),
      (s) => expect(s.facts.today.habits.items).toEqual([]),
    ],
    [
      "projects.board",
      () => mocks.listBoardProjects.mockRejectedValueOnce(new Error("boom")),
      (s) => expect(s.facts.today.projects).toEqual([]),
    ],
    [
      "events.recent",
      () => mocks.listRecentEvents.mockRejectedValueOnce(new Error("boom")),
      (s) => expect(s.facts.today.recentEvents).toEqual([]),
    ],
    [
      "rhythms.wake",
      () => mocks.getTodayWakeStatus.mockRejectedValueOnce(new Error("boom")),
      (s) => expect(s.facts.today.wokeUpAt).toBeNull(),
    ],
    [
      "reflect.yesterday",
      () => mocks.getReflection.mockRejectedValueOnce(new Error("boom")),
      (s) => expect(s.facts.yesterday.reflection).toBeNull(),
    ],
    [
      "user.profile",
      () => mocks.getUserProfile.mockRejectedValueOnce(new Error("boom")),
      (s) => expect(s.user.displayName).toBe("Joshua"),
    ],
    [
      "finance.accounts",
      () => mocks.listAccounts.mockRejectedValueOnce(new Error("boom")),
      (s) => expect(s.facts.finance.summary).toBeNull(),
    ],
    [
      "projects.plans",
      () =>
        mocks.listProjectPlanSummaries.mockRejectedValueOnce(new Error("boom")),
      (s) => expect(s.facts.today.projects).toHaveLength(1),
    ],
    [
      "rolodex.birthdays",
      () => mocks.getUpcomingBirthdays.mockRejectedValueOnce(new Error("boom")),
      (s) => expect(s.facts.rolodex.upcomingBirthdays).toEqual([]),
    ],
    [
      "insights.recent",
      () => mocks.listRecentInsights.mockRejectedValueOnce(new Error("boom")),
      (s) => expect(s.facts.recentInsights).toEqual([]),
    ],
    [
      "work.summary",
      () =>
        mocks.getWorkAssistantSummary.mockRejectedValueOnce(new Error("boom")),
      (s) => expect(s.facts.work).toBeNull(),
    ],
    [
      "ensure.project-board",
      () =>
        mocks.ensureProjectBoardTables.mockRejectedValueOnce(new Error("boom")),
      (s) => expect(s.facts.today.projects).toHaveLength(1),
    ],
  ];

  for (const [label, inject, assertDegraded] of cases) {
    it(`"${label}" failure resolves with that section degraded`, async () => {
      inject();
      const snap = await buildAssistantSnapshot(UID);
      expect(snap.degradedSections).toContain(label);
      assertDegraded(snap);
      expect(() => JSON.stringify(snap)).not.toThrow();
    });
  }

  it("multiple simultaneous failures still resolve", async () => {
    mocks.getRunningEntry.mockRejectedValueOnce(new Error("boom"));
    mocks.listDoItems.mockRejectedValueOnce(new Error("boom"));
    mocks.getTodayWakeStatus.mockRejectedValueOnce(new Error("boom"));
    const snap = await buildAssistantSnapshot(UID);
    expect(snap.degradedSections).toEqual(
      expect.arrayContaining(["time.running", "do.items", "rhythms.wake"]),
    );
    expect(snap.facts.today.time.runningTimer).toBeNull();
    expect(snap.facts.today.tasks.open).toEqual([]);
    expect(snap.facts.today.wokeUpAt).toBeNull();
    // Unaffected sections still populated
    expect(snap.facts.today.calendar.items).toHaveLength(1);
    expect(() => JSON.stringify(snap)).not.toThrow();
  });
});
