import { describe, expect, it } from "vitest";
import { buildDayTimeline } from "@/app/app/calendar/_lib/timeline";

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

  it("hides the now line outside the window", () => {
    const model = buildDayTimeline({
      items: [calItem("a", local(9), local(10))],
      entries: [],
      day,
      now: new Date(2026, 5, 11, 3, 0, 0),
    });
    expect(model.nowPct).toBeNull();
  });
});
