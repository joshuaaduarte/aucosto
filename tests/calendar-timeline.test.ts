import { describe, expect, it } from "vitest";
import {
  buildDayTimeline,
  dayWindowHours,
} from "@/app/app/calendar/_lib/timeline";

const day = new Date(2026, 5, 10); // local midnight
const local = (hour: number, minute = 0) =>
  new Date(2026, 5, 10, hour, minute, 0);

function calItem(
  id: string,
  startsAt: Date,
  endsAt: Date,
  overrides: Partial<{
    allDay: boolean;
    status: string;
    kind: string;
    title: string;
  }> = {},
) {
  return {
    id,
    title: overrides.title ?? id,
    startsAt,
    endsAt,
    allDay: overrides.allDay ?? false,
    status: overrides.status ?? "confirmed",
    kind: overrides.kind ?? "block",
  };
}

describe("buildDayTimeline", () => {
  it("uses the default 07:00-22:00 window when everything fits", () => {
    const model = buildDayTimeline({
      items: [calItem("a", local(9), local(10))],
      entries: [],
      day,
      now: local(12),
    });
    expect(model.windowStart.getHours()).toBe(7);
    expect(model.windowEnd.getHours()).toBe(22);
  });

  it("expands the window to fit early and late activity", () => {
    const model = buildDayTimeline({
      items: [calItem("early", local(5, 30), local(6))],
      entries: [
        {
          id: "late",
          label: "Reading",
          category: "reading",
          startedAt: local(22, 30),
          endedAt: local(23, 15),
        },
      ],
      day,
      now: local(23, 30),
    });
    expect(model.windowStart.getHours()).toBe(5);
    expect(model.windowEnd.getTime()).toBe(local(24).getTime());
  });

  it("positions blocks proportionally inside the window", () => {
    const model = buildDayTimeline({
      items: [calItem("mid", local(7), local(22))],
      entries: [],
      day,
      now: local(12),
    });
    const block = model.planned[0]!;
    expect(block.topPct).toBe(0);
    expect(block.heightPct).toBe(100);
  });

  it("extends running entries to now and marks them running", () => {
    const now = local(12);
    const model = buildDayTimeline({
      items: [],
      entries: [
        {
          id: "run",
          label: "Work",
          category: "work",
          startedAt: local(11),
          endedAt: null,
        },
      ],
      day,
      now,
    });
    const block = model.actual[0]!;
    expect(block.running).toBe(true);
    // 11:00 in a 7:00-22:00 window = 4/15 of the way down; 1h tall = 1/15.
    expect(block.topPct).toBeCloseTo((4 / 15) * 100, 1);
    expect(block.heightPct).toBeCloseTo((1 / 15) * 100, 1);
    expect(model.nowPct).toBeCloseTo((5 / 15) * 100, 1);
  });

  it("excludes all-day items and keeps done items muted", () => {
    const model = buildDayTimeline({
      items: [
        calItem("allday", local(0), local(24), { allDay: true }),
        calItem("done", local(9), local(10), { status: "done" }),
      ],
      entries: [],
      day,
      now: local(12),
    });
    expect(model.planned).toHaveLength(1);
    expect(model.planned[0]!.muted).toBe(true);
  });

  it("colors actual blocks by category", () => {
    const model = buildDayTimeline({
      items: [],
      entries: [
        {
          id: "e1",
          label: "Shower",
          category: "shower",
          startedAt: local(8),
          endedAt: local(8, 20),
        },
        {
          id: "e2",
          label: "Mystery",
          category: null,
          startedAt: local(9),
          endedAt: local(9, 20),
        },
      ],
      day,
      now: local(12),
    });
    expect(model.actual[0]!.color).not.toBe(model.actual[1]!.color);
  });

  it("splits genuinely concurrent entries into side-by-side columns", () => {
    const model = buildDayTimeline({
      items: [],
      entries: [
        {
          id: "a",
          label: "A",
          category: "work",
          startedAt: local(9, 0),
          endedAt: local(10, 0),
        },
        {
          id: "b",
          label: "B",
          category: "reading",
          startedAt: local(9, 30),
          endedAt: local(10, 30),
        },
      ],
      day,
      now: local(12),
    });
    const [a, b] = [
      model.actual.find((x) => x.id === "a")!,
      model.actual.find((x) => x.id === "b")!,
    ];
    expect(a.widthPct).toBe(50);
    expect(b.widthPct).toBe(50);
    expect(a.leftPct).toBe(0);
    expect(b.leftPct).toBe(50);
  });

  it("gives short back-to-back entries min height via sub-columns, not overlap", () => {
    // Three 5-minute entries in a row: each inflates to the 22-minute
    // visual minimum, so they chain-overlap and must split into columns.
    const model = buildDayTimeline({
      items: [],
      entries: [0, 1, 2].map((i) => ({
        id: `e${i}`,
        label: `E${i}`,
        category: "chores",
        startedAt: local(9, i * 5),
        endedAt: local(9, i * 5 + 5),
      })),
      day,
      now: local(12),
    });
    expect(model.actual).toHaveLength(3);
    // All share one cluster → equal widths summing to 100%.
    const widths = model.actual.map((b) => b.widthPct);
    expect(new Set(widths).size).toBe(1);
    expect(widths[0]! * 3).toBeCloseTo(100, 5);
    // Distinct columns — no two blocks share a left offset.
    const lefts = new Set(model.actual.map((b) => b.leftPct));
    expect(lefts.size).toBe(3);
    // Heights reflect the 22-minute minimum, not the raw 5 minutes.
    const windowHours = 15; // default 07:00–22:00
    const minPct = (22 / 60 / windowHours) * 100;
    for (const block of model.actual) {
      expect(block.heightPct).toBeCloseTo(minPct, 1);
    }
  });

  it("keeps non-overlapping long entries full width", () => {
    const model = buildDayTimeline({
      items: [],
      entries: [
        {
          id: "a",
          label: "A",
          category: "work",
          startedAt: local(9),
          endedAt: local(10),
        },
        {
          id: "b",
          label: "B",
          category: "work",
          startedAt: local(11),
          endedAt: local(12),
        },
      ],
      day,
      now: local(13),
    });
    for (const block of model.actual) {
      expect(block.widthPct).toBe(100);
      expect(block.leftPct).toBe(0);
    }
  });

  it("hides the now line outside the window", () => {
    const model = buildDayTimeline({
      items: [calItem("a", local(9), local(10))],
      entries: [],
      day,
      now: new Date(2026, 5, 11, 3, 0, 0),
    });
    expect(model.nowPct).toBeNull();
  });

  it("renders rhythm sessions as read-only, full-width context blocks", () => {
    const model = buildDayTimeline({
      items: [],
      entries: [],
      rhythms: [
        // Overnight sleep clipped to the day → 00:00–06:30.
        { id: "s1", type: "sleep", startedAt: local(0), endedAt: local(6, 30) },
        // Morning routine.
        { id: "m1", type: "wakeup", startedAt: local(6, 30), endedAt: local(7) },
      ],
      day,
      now: local(12),
    });
    expect(model.context).toHaveLength(2);
    const sleep = model.context.find((b) => b.id === "rhythm-s1")!;
    expect(sleep.title).toBe("Sleep");
    expect(sleep.muted).toBe(true);
    expect(sleep.leftPct).toBe(0);
    expect(sleep.widthPct).toBe(100);
    // Early sleep expands the window down to midnight.
    expect(model.windowStart.getHours()).toBe(0);
    expect(model.context.find((b) => b.id === "rhythm-m1")!.title).toBe("Morning");
  });

  it("treats a running rhythm session as open to now", () => {
    const model = buildDayTimeline({
      items: [],
      entries: [],
      rhythms: [{ id: "s1", type: "sleep", startedAt: local(0), endedAt: null }],
      day,
      now: local(6),
    });
    const sleep = model.context[0]!;
    expect(sleep.running).toBe(true);
  });

  it("honors an explicit bounds override (shared multi-day y-axis)", () => {
    const model = buildDayTimeline({
      items: [calItem("a", local(9), local(10))],
      entries: [],
      day,
      now: local(12),
      bounds: { startHour: 5, endHour: 20 },
    });
    // The window is forced to the shared bounds, not the 07:00–22:00 default.
    expect(model.windowStart.getHours()).toBe(5);
    expect(model.windowEnd.getHours()).toBe(20);
    // The 9–10 block positions against the forced 5→20 (15h) window.
    const block = model.planned[0]!;
    expect(block.topPct).toBeCloseTo(((9 - 5) / 15) * 100, 5);
  });
});

describe("dayWindowHours", () => {
  it("returns the default 07:00–22:00 window when everything fits", () => {
    expect(dayWindowHours({ items: [], entries: [], day, now: local(12) })).toEqual(
      { startHour: 7, endHour: 22 },
    );
  });

  it("expands to fit early and late items, ignoring all-day items", () => {
    expect(
      dayWindowHours({
        items: [
          calItem("early", local(5, 30), local(6)),
          calItem("late", local(22), local(23, 30)),
          calItem("allday", local(0), local(0), { allDay: true }),
        ],
        entries: [],
        day,
        now: local(12),
      }),
    ).toEqual({ startHour: 5, endHour: 24 });
  });

  it("agrees with the window buildDayTimeline computes on its own", () => {
    const input = {
      items: [calItem("a", local(8), local(9))],
      entries: [],
      day,
      now: local(12),
    };
    const bounds = dayWindowHours(input);
    const model = buildDayTimeline(input);
    expect(model.windowStart.getHours()).toBe(bounds.startHour);
  });
});
