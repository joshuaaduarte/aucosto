import { describe, expect, it } from "vitest";
import {
  suggestGapFills,
  type GapHistoryEntry,
  type GapPlannedBlock,
} from "@/lib/gap-suggestions";

// Local-time constructors keep these independent of the machine's TZ.
// 2026-10-14 is a Wednesday.
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);

const gap = { start: at(14, 9, 30), end: at(14, 11, 45) };

function block(overrides: Partial<GapPlannedBlock> = {}): GapPlannedBlock {
  return {
    id: "b1",
    title: "Deep work",
    startsAt: at(14, 9),
    endsAt: at(14, 11),
    status: "planned",
    allDay: false,
    category: "work",
    ...overrides,
  };
}

function entry(
  day: number,
  from: [number, number],
  to: [number, number],
  label = "Email",
  category: string | null = "admin",
): GapHistoryEntry {
  return { label, category, startedAt: at(day, ...from), endedAt: at(day, ...to) };
}

describe("suggestGapFills — plan", () => {
  it("offers an overlapping block, clipped to the gap", () => {
    const [first] = suggestGapFills({ gap, plannedBlocks: [block()] });
    expect(first).toMatchObject({ kind: "plan", label: "Deep work", category: "work" });
    expect(first!.start).toEqual(at(14, 9, 30));
    expect(first!.end).toEqual(at(14, 11));
  });

  it("skips all-day, cancelled, and barely-overlapping blocks", () => {
    const fills = suggestGapFills({
      gap,
      plannedBlocks: [
        block({ id: "a", allDay: true }),
        block({ id: "c", status: "cancelled" }),
        block({ id: "t", startsAt: at(14, 9), endsAt: at(14, 9, 35) }),
      ],
    });
    expect(fills).toEqual([]);
  });

  it("borrows the label's usual category when the block has none", () => {
    const [first] = suggestGapFills({
      gap,
      plannedBlocks: [block({ category: null })],
      history: [entry(10, [8, 0], [9, 0], "Deep work", "focus")],
    });
    expect(first!.category).toBe("focus");
  });
});

describe("suggestGapFills — continue", () => {
  const previous = { id: "e1", label: "Email", category: "admin", endedAt: gap.start };

  it("extends the entry the gap follows", () => {
    const [first] = suggestGapFills({ gap, previousEntry: previous });
    expect(first).toMatchObject({ kind: "continue", extendEntryId: "e1", label: "Email" });
    expect(first!.start).toEqual(gap.start);
    expect(first!.end).toEqual(gap.end);
  });

  it("doesn't offer it when the gap didn't start at that entry's end", () => {
    const fills = suggestGapFills({
      gap,
      previousEntry: { ...previous, endedAt: at(14, 8) },
    });
    expect(fills).toEqual([]);
  });

  it("doesn't offer it for gaps longer than three hours", () => {
    const fills = suggestGapFills({
      gap: { start: gap.start, end: at(14, 13, 0) },
      previousEntry: previous,
    });
    expect(fills).toEqual([]);
  });
});

describe("suggestGapFills — usual", () => {
  it("picks what recurs in this window on similar days", () => {
    const history = [
      entry(12, [9, 0], [11, 0], "Standup + code", "work"), // Mon
      entry(13, [9, 30], [12, 0], "Standup + code", "work"), // Tue
      entry(13, [11, 30], [11, 45], "Snack", "food"),
    ];
    const [first] = suggestGapFills({ gap, history });
    expect(first).toMatchObject({ kind: "usual", label: "Standup + code", category: "work" });
    expect(first!.reason).toContain("2 days");
  });

  it("needs at least two distinct days", () => {
    const fills = suggestGapFills({ gap, history: [entry(13, [9, 0], [12, 0])] });
    expect(fills).toEqual([]);
  });

  it("ignores today and weekend days for a weekday gap", () => {
    const fills = suggestGapFills({
      gap,
      history: [
        entry(14, [9, 0], [9, 30]), // today
        entry(10, [9, 0], [12, 0]), // Sat
        entry(11, [9, 0], [12, 0]), // Sun
      ],
    });
    expect(fills).toEqual([]);
  });

  it("ignores labels that only graze the window", () => {
    const fills = suggestGapFills({
      gap,
      history: [entry(12, [11, 35], [11, 45]), entry(13, [11, 35], [11, 45])],
    });
    expect(fills).toEqual([]);
  });
});

describe("suggestGapFills — ordering", () => {
  it("orders plan, continue, usual and dedupes by label", () => {
    const fills = suggestGapFills({
      gap,
      plannedBlocks: [block()],
      previousEntry: { id: "e1", label: "deep work", category: "work", endedAt: gap.start },
      history: [entry(12, [9, 0], [12, 0]), entry(13, [9, 0], [12, 0])],
    });
    expect(fills.map((fill) => fill.kind)).toEqual(["plan", "usual"]);
  });

  it("respects the limit", () => {
    const fills = suggestGapFills({
      gap,
      plannedBlocks: [block(), block({ id: "b2", title: "Call", startsAt: at(14, 11), endsAt: at(14, 12) })],
      previousEntry: { id: "e1", label: "Email", category: "admin", endedAt: gap.start },
      limit: 2,
    });
    expect(fills).toHaveLength(2);
  });
});
