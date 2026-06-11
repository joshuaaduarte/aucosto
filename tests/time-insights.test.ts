import { describe, expect, it } from "vitest";
import {
  buildDailyStacks,
  clippedDurationMs,
  findUntrackedGap,
  recentLabelsForCategory,
  summarizeCategoriesWindow,
  trackedCoverage,
} from "@/lib/time-insights";

const at = (iso: string) => new Date(iso);

describe("clippedDurationMs", () => {
  const from = at("2026-06-10T00:00:00Z");
  const to = at("2026-06-11T00:00:00Z");
  const now = at("2026-06-10T12:00:00Z");

  it("returns the full duration inside the window", () => {
    const entry = {
      startedAt: at("2026-06-10T08:00:00Z"),
      endedAt: at("2026-06-10T09:30:00Z"),
      category: null,
    };
    expect(clippedDurationMs(entry, from, to, now)).toBe(90 * 60000);
  });

  it("clips entries that span the window edge", () => {
    const entry = {
      startedAt: at("2026-06-09T23:00:00Z"),
      endedAt: at("2026-06-10T01:00:00Z"),
      category: null,
    };
    expect(clippedDurationMs(entry, from, to, now)).toBe(60 * 60000);
  });

  it("counts running entries up to now", () => {
    const entry = {
      startedAt: at("2026-06-10T11:00:00Z"),
      endedAt: null,
      category: null,
    };
    expect(clippedDurationMs(entry, from, to, now)).toBe(60 * 60000);
  });

  it("returns zero for entries outside the window", () => {
    const entry = {
      startedAt: at("2026-06-09T08:00:00Z"),
      endedAt: at("2026-06-09T09:00:00Z"),
      category: null,
    };
    expect(clippedDurationMs(entry, from, to, now)).toBe(0);
  });
});

describe("summarizeCategoriesWindow", () => {
  it("groups by normalized category, sorts by total, includes running time", () => {
    const now = at("2026-06-10T12:00:00Z");
    const entries = [
      {
        startedAt: at("2026-06-10T08:00:00Z"),
        endedAt: at("2026-06-10T08:30:00Z"),
        category: "Shower",
      },
      {
        startedAt: at("2026-06-10T09:00:00Z"),
        endedAt: at("2026-06-10T10:00:00Z"),
        category: "shower",
      },
      {
        startedAt: at("2026-06-10T10:00:00Z"),
        endedAt: null,
        category: "reading",
      },
      {
        startedAt: at("2026-06-10T07:00:00Z"),
        endedAt: at("2026-06-10T07:10:00Z"),
        category: null,
      },
    ];
    const summary = summarizeCategoriesWindow(entries, {
      from: at("2026-06-10T00:00:00Z"),
      to: at("2026-06-11T00:00:00Z"),
      now,
    });
    expect(summary[0]!).toMatchObject({
      category: "reading",
      label: "Reading",
      totalMs: 120 * 60000,
    });
    expect(summary[1]!).toMatchObject({
      category: "shower",
      totalMs: 90 * 60000,
    });
    expect(summary[2]!).toMatchObject({ category: "uncategorized" });
    expect(summary[0]!.color).toMatch(/^#/);
  });
});

describe("buildDailyStacks", () => {
  it("builds one stack per day with category segments", () => {
    const now = new Date(2026, 5, 10, 12, 0, 0);
    const entries = [
      {
        startedAt: new Date(2026, 5, 9, 8, 0),
        endedAt: new Date(2026, 5, 9, 9, 0),
        category: "work",
      },
      {
        startedAt: new Date(2026, 5, 10, 8, 0),
        endedAt: new Date(2026, 5, 10, 8, 30),
        category: "eating",
      },
    ];
    const stacks = buildDailyStacks(entries, { days: 7, now });
    expect(stacks).toHaveLength(7);
    expect(stacks[6]!.isToday).toBe(true);
    expect(stacks[6]!.totalMs).toBe(30 * 60000);
    expect(stacks[5]!.totalMs).toBe(60 * 60000);
    expect(stacks[5]!.segments[0]!.category).toBe("work");
    expect(stacks[0]!.totalMs).toBe(0);
  });

  it("splits an overnight entry across both days", () => {
    const now = new Date(2026, 5, 10, 12, 0, 0);
    const entries = [
      {
        startedAt: new Date(2026, 5, 9, 23, 0),
        endedAt: new Date(2026, 5, 10, 1, 0),
        category: "sleep",
      },
    ];
    const stacks = buildDailyStacks(entries, { days: 7, now });
    expect(stacks[5]!.totalMs).toBe(60 * 60000);
    expect(stacks[6]!.totalMs).toBe(60 * 60000);
  });
});

describe("trackedCoverage", () => {
  it("computes the share of the waking window covered", () => {
    const now = new Date(2026, 5, 10, 10, 0, 0); // 4h window since 06:00
    const entries = [
      {
        startedAt: new Date(2026, 5, 10, 7, 0),
        endedAt: new Date(2026, 5, 10, 9, 0),
        category: "work",
      },
    ];
    const coverage = trackedCoverage(entries, { now });
    expect(coverage.windowMs).toBe(4 * 3_600_000);
    expect(coverage.trackedMs).toBe(2 * 3_600_000);
    expect(coverage.pct).toBe(50);
  });

  it("returns an empty window before the wake hour", () => {
    const now = new Date(2026, 5, 10, 5, 0, 0);
    expect(trackedCoverage([], { now })).toEqual({
      trackedMs: 0,
      windowMs: 0,
      pct: 0,
    });
  });

  it("caps the window at the sleep hour and the pct at 100", () => {
    const now = new Date(2026, 5, 10, 23, 45, 0);
    const entries = [
      {
        startedAt: new Date(2026, 5, 10, 5, 0),
        endedAt: new Date(2026, 5, 10, 23, 30),
        category: "work",
      },
    ];
    const coverage = trackedCoverage(entries, { now });
    expect(coverage.windowMs).toBe(17 * 3_600_000);
    expect(coverage.pct).toBe(100);
  });
});

describe("recentLabelsForCategory", () => {
  const entry = (label: string, category: string | null, hour: number) => ({
    label,
    category,
    startedAt: new Date(2026, 5, 10, hour, 0, 0),
  });

  it("returns distinct labels for the category, most recent first", () => {
    const labels = recentLabelsForCategory(
      [
        entry("aucosto refactor", "work", 8),
        entry("client deck", "Work", 10),
        entry("aucosto refactor", "work", 12),
        entry("dinner", "eating", 13),
      ],
      "work",
    );
    expect(labels).toEqual(["aucosto refactor", "client deck"]);
  });

  it("skips labels that just repeat the category name", () => {
    const labels = recentLabelsForCategory(
      [entry("Work", "work", 8), entry("work", "work", 9), entry("standup", "work", 10)],
      "work",
    );
    expect(labels).toEqual(["standup"]);
  });

  it("respects the limit and handles empty categories", () => {
    const entries = ["a", "b", "c", "d", "e"].map((label, index) =>
      entry(label, "reading", index + 6),
    );
    expect(recentLabelsForCategory(entries, "reading", { limit: 3 })).toHaveLength(3);
    expect(recentLabelsForCategory(entries, null)).toEqual([]);
    expect(recentLabelsForCategory(entries, "work")).toEqual([]);
  });
});

describe("findUntrackedGap", () => {
  const now = at("2026-06-10T12:00:00Z");

  it("returns the gap when it is big enough", () => {
    const gap = findUntrackedGap({
      lastEndedAt: at("2026-06-10T11:13:00Z"),
      now,
    });
    expect(gap).toMatchObject({ minutes: 47 });
    expect(gap!.start.toISOString()).toBe("2026-06-10T11:13:00.000Z");
  });

  it("ignores tiny gaps", () => {
    expect(
      findUntrackedGap({ lastEndedAt: at("2026-06-10T11:55:00Z"), now }),
    ).toBeNull();
  });

  it("ignores stale gaps beyond maxHours", () => {
    expect(
      findUntrackedGap({ lastEndedAt: at("2026-06-09T20:00:00Z"), now }),
    ).toBeNull();
  });

  it("returns null with no prior entry", () => {
    expect(findUntrackedGap({ lastEndedAt: null, now })).toBeNull();
  });
});
