import { describe, expect, it } from "vitest";
import { habitGhostsForDay } from "@/app/app/calendar/_lib/derive";
import { buildDayTimeline } from "@/app/app/calendar/_lib/timeline";

// 2026-06-10 is a Wednesday (weekday 3).
const wednesday = new Date(2026, 5, 10);
const saturday = new Date(2026, 5, 13);

function habit(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "h1",
    title: "Morning run",
    bucket: "exercise",
    cadence: "daily",
    daysOfWeek: null,
    reminderTime: "07:00",
    defaultDurationMinutes: 60,
    windowStart: null,
    windowEnd: null,
    archivedAt: null,
    ...overrides,
  } as Parameters<typeof habitGhostsForDay>[0][number];
}

describe("habitGhostsForDay", () => {
  it("projects a daily habit with a reminder onto any day", () => {
    const ghosts = habitGhostsForDay([habit()], wednesday);
    expect(ghosts).toHaveLength(1);
    expect(ghosts[0]).toMatchObject({
      id: "h1",
      title: "Morning run",
      category: "exercise",
      reminderMinutes: 7 * 60,
      durationMinutes: 60,
    });
  });

  it("skips habits without a parseable reminder time", () => {
    expect(habitGhostsForDay([habit({ reminderTime: null })], wednesday)).toHaveLength(0);
    expect(habitGhostsForDay([habit({ reminderTime: "nope" })], wednesday)).toHaveLength(0);
  });

  it("skips archived habits", () => {
    expect(
      habitGhostsForDay([habit({ archivedAt: new Date() })], wednesday),
    ).toHaveLength(0);
  });

  it("respects weekdays cadence (Mon–Fri only)", () => {
    const h = habit({ cadence: "weekdays" });
    expect(habitGhostsForDay([h], wednesday)).toHaveLength(1);
    expect(habitGhostsForDay([h], saturday)).toHaveLength(0);
  });

  it("uses explicit daysOfWeek when present", () => {
    const h = habit({ cadence: "custom", daysOfWeek: "6" }); // Saturday only
    expect(habitGhostsForDay([h], saturday)).toHaveLength(1);
    expect(habitGhostsForDay([h], wednesday)).toHaveLength(0);
  });

  it("falls back to a default duration when none is set", () => {
    const ghosts = habitGhostsForDay([habit({ defaultDurationMinutes: null })], wednesday);
    expect(ghosts[0]?.durationMinutes).toBe(30);
  });

  it("falls back to the 'habit' colour key when bucket is empty", () => {
    const ghosts = habitGhostsForDay([habit({ bucket: null })], wednesday);
    expect(ghosts[0]?.category).toBe("habit");
  });

  it("does not ghost weekly habits with no fixed day", () => {
    expect(
      habitGhostsForDay([habit({ cadence: "weekly", daysOfWeek: null })], wednesday),
    ).toHaveLength(0);
  });

  it("emits window minutes only when both bounds parse and start < end", () => {
    const withWindow = habitGhostsForDay(
      [habit({ windowStart: "06:00", windowEnd: "09:00" })],
      wednesday,
    );
    expect(withWindow[0]).toMatchObject({
      windowStartMinutes: 6 * 60,
      windowEndMinutes: 9 * 60,
    });

    // No window set → null (no band drawn).
    expect(habitGhostsForDay([habit()], wednesday)[0]).toMatchObject({
      windowStartMinutes: null,
      windowEndMinutes: null,
    });

    // Inverted / malformed window → null.
    expect(
      habitGhostsForDay([habit({ windowStart: "09:00", windowEnd: "06:00" })], wednesday)[0],
    ).toMatchObject({ windowStartMinutes: null, windowEndMinutes: null });
    expect(
      habitGhostsForDay([habit({ windowStart: "06:00", windowEnd: "nope" })], wednesday)[0],
    ).toMatchObject({ windowStartMinutes: null, windowEndMinutes: null });
  });
});

describe("buildDayTimeline habit window bands", () => {
  const dayAt = (hour: number, minute = 0) => new Date(2026, 5, 10, hour, minute, 0);

  it("has no band when the habit has no window", () => {
    const model = buildDayTimeline({
      items: [],
      entries: [],
      habits: habitGhostsForDay([habit()], wednesday),
      day: wednesday,
      now: dayAt(9),
    });
    expect(model.habits[0]!.band).toBeNull();
  });

  it("draws a band spanning the window, unmatched when no entry overlaps", () => {
    const model = buildDayTimeline({
      items: [],
      entries: [],
      habits: habitGhostsForDay(
        [habit({ windowStart: "06:00", windowEnd: "09:00" })],
        wednesday,
      ),
      day: wednesday,
      now: dayAt(12),
    });
    const band = model.habits[0]!.band;
    expect(band).not.toBeNull();
    expect(band!.matched).toBe(false);
    // 06:00 in a 06:00–22:00 window (expanded to fit the early band? no — ghosts
    // don't expand the axis; default starts 07:00) → band top clamps to 0.
    expect(band!.topPct).toBeCloseTo(0, 1);
    expect(band!.heightPct).toBeGreaterThan(0);
  });

  it("marks the band matched when a tracked entry overlaps the window", () => {
    const model = buildDayTimeline({
      items: [],
      entries: [
        {
          id: "e1",
          label: "Run",
          category: "exercise",
          startedAt: dayAt(7, 30),
          endedAt: dayAt(8, 0),
        },
      ],
      habits: habitGhostsForDay(
        [habit({ windowStart: "06:00", windowEnd: "09:00" })],
        wednesday,
      ),
      day: wednesday,
      now: dayAt(12),
    });
    expect(model.habits[0]!.band!.matched).toBe(true);
  });

  it("does not match an entry that falls entirely outside the window", () => {
    const model = buildDayTimeline({
      items: [],
      entries: [
        {
          id: "e1",
          label: "Late work",
          category: "work",
          startedAt: dayAt(14, 0),
          endedAt: dayAt(15, 0),
        },
      ],
      habits: habitGhostsForDay(
        [habit({ windowStart: "06:00", windowEnd: "09:00" })],
        wednesday,
      ),
      day: wednesday,
      now: dayAt(16),
    });
    expect(model.habits[0]!.band!.matched).toBe(false);
  });
});

describe("buildDayTimeline habit ghosts", () => {
  it("positions ghosts within the window with an absolute ISO span", () => {
    const model = buildDayTimeline({
      items: [],
      entries: [],
      habits: habitGhostsForDay([habit()], wednesday),
      day: wednesday,
      now: new Date(2026, 5, 10, 9, 0, 0),
    });
    expect(model.habits).toHaveLength(1);
    const ghost = model.habits[0]!;
    expect(ghost.habitId).toBe("h1");
    // 07:00 start sits at the top of the default 07:00–22:00 window.
    expect(ghost.topPct).toBeCloseTo(0, 1);
    expect(new Date(ghost.startIso).getHours()).toBe(7);
    expect(new Date(ghost.endIso).getHours()).toBe(8);
  });
});
