import { describe, expect, it } from "vitest";
import { daysSince, deriveStaleData, type FreshnessInput } from "@/lib/data-freshness";

const NOW = new Date(2026, 10, 9, 13, 40);
const daysAgo = (days: number, hour = 9) => new Date(2026, 10, 9 - days, hour);
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000);

function input(patch: Partial<FreshnessInput> = {}): FreshnessInput {
  return {
    now: NOW,
    calendarFeeds: [],
    health: { linkedHabitCount: 0, lastSyncedAt: null },
    money: { visible: true, accountCount: 0, lastEntryAt: null },
    ...patch,
  };
}

const keys = (value: FreshnessInput) => deriveStaleData(value).map((notice) => notice.key);

describe("daysSince", () => {
  it("counts calendar days, not 24-hour blocks", () => {
    expect(daysSince(new Date(2026, 10, 8, 23, 55), new Date(2026, 10, 9, 0, 5))).toBe(1);
    expect(daysSince(new Date(2026, 10, 9, 0, 5), new Date(2026, 10, 9, 23, 55))).toBe(0);
    expect(daysSince(new Date(2026, 10, 10), NOW)).toBe(0);
  });
});

describe("deriveStaleData", () => {
  it("says nothing when nothing was ever set up", () => {
    expect(deriveStaleData(input())).toEqual([]);
    expect(deriveStaleData(input({ calendarFeeds: null }))).toEqual([]);
  });

  it("says nothing while every source is fresh", () => {
    expect(
      deriveStaleData(
        input({
          calendarFeeds: [{ name: "Work", lastSyncedAt: hoursAgo(3), lastError: null }],
          health: { linkedHabitCount: 2, lastSyncedAt: daysAgo(1) },
          money: { visible: true, accountCount: 4, lastEntryAt: daysAgo(4) },
        }),
      ),
    ).toEqual([]);
  });

  it("flags a calendar whose link fails, even if it tried recently", () => {
    const notices = deriveStaleData(
      input({ calendarFeeds: [{ name: "Work", lastSyncedAt: hoursAgo(1), lastError: "HTTP 404" }] }),
    );
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ key: "calendar:Work", href: "/app/settings" });
    expect(notices[0]!.title).toContain("Work");
  });

  it("flags a calendar that has not refreshed in two days, and not one just added", () => {
    expect(keys(input({ calendarFeeds: [{ name: "Home", lastSyncedAt: hoursAgo(49), lastError: null }] }))).toEqual([
      "calendar:Home",
    ]);
    expect(keys(input({ calendarFeeds: [{ name: "Home", lastSyncedAt: hoursAgo(47), lastError: null }] }))).toEqual([]);
    expect(keys(input({ calendarFeeds: [{ name: "New", lastSyncedAt: null, lastError: null }] }))).toEqual([]);
  });

  it("flags Apple Health only when habits depend on it", () => {
    expect(keys(input({ health: { linkedHabitCount: 0, lastSyncedAt: daysAgo(30) } }))).toEqual([]);
    expect(keys(input({ health: { linkedHabitCount: 1, lastSyncedAt: daysAgo(1) } }))).toEqual([]);
    const stale = deriveStaleData(input({ health: { linkedHabitCount: 3, lastSyncedAt: daysAgo(5) } }));
    expect(stale.map((notice) => notice.key)).toEqual(["health"]);
    expect(stale[0]!.detail).toContain("Nov 4, 5 days ago");
    expect(stale[0]!.detail).toContain("3 habits depend");
  });

  it("flags Apple Health that was linked but never arrived", () => {
    const notices = deriveStaleData(input({ health: { linkedHabitCount: 1, lastSyncedAt: null } }));
    expect(notices[0]).toMatchObject({ key: "health", title: "No Apple Health data has arrived yet" });
    expect(notices[0]!.detail).toContain("1 habit depends");
  });

  it("flags Money after five quiet days, only with accounts and only when visible", () => {
    const quiet = { visible: true, accountCount: 10, lastEntryAt: daysAgo(6) };
    const notices = deriveStaleData(input({ money: quiet }));
    expect(notices.map((notice) => notice.key)).toEqual(["money"]);
    expect(notices[0]!.detail).toContain("Nov 3, 6 days ago");
    expect(keys(input({ money: { ...quiet, lastEntryAt: daysAgo(4) } }))).toEqual([]);
    expect(keys(input({ money: { ...quiet, accountCount: 0 } }))).toEqual([]);
    expect(keys(input({ money: { ...quiet, visible: false } }))).toEqual([]);
  });

  it("flags Money with accounts but no entry ever", () => {
    const notices = deriveStaleData(input({ money: { visible: true, accountCount: 2, lastEntryAt: null } }));
    expect(notices[0]!.title).toMatch(/yet/);
  });

  it("lists calendars first, then health, then money", () => {
    expect(
      keys(
        input({
          calendarFeeds: [{ name: "Work", lastSyncedAt: hoursAgo(80), lastError: null }],
          health: { linkedHabitCount: 1, lastSyncedAt: daysAgo(9) },
          money: { visible: true, accountCount: 1, lastEntryAt: daysAgo(9) },
        }),
      ),
    ).toEqual(["calendar:Work", "health", "money"]);
  });
});
