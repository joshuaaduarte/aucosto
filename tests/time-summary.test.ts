import { describe, expect, it } from "vitest";
import { entryDurationMs, sumDurations, summarizeCategories } from "@/lib/time-summary";

function entry({
  startedAt,
  endedAt,
  category,
}: {
  startedAt: string;
  endedAt: string | null;
  category?: string | null;
}) {
  return {
    startedAt: new Date(startedAt),
    endedAt: endedAt ? new Date(endedAt) : null,
    category: category ?? null,
  };
}

describe("time-summary", () => {
  it("calculates entry duration safely", () => {
    expect(
      entryDurationMs(
        entry({
          startedAt: "2026-05-14T10:00:00.000Z",
          endedAt: "2026-05-14T11:30:00.000Z",
        }),
      ),
    ).toBe(90 * 60 * 1000);
  });

  it("ignores running entries when summing durations", () => {
    const total = sumDurations([
      entry({ startedAt: "2026-05-14T10:00:00.000Z", endedAt: "2026-05-14T11:00:00.000Z" }),
      entry({ startedAt: "2026-05-14T11:00:00.000Z", endedAt: null }),
    ]);
    expect(total).toBe(60 * 60 * 1000);
  });

  it("groups category totals and normalizes blanks", () => {
    const result = summarizeCategories([
      entry({ startedAt: "2026-05-14T10:00:00.000Z", endedAt: "2026-05-14T11:00:00.000Z", category: "Work" }),
      entry({ startedAt: "2026-05-14T12:00:00.000Z", endedAt: "2026-05-14T12:30:00.000Z", category: " work " }),
      entry({ startedAt: "2026-05-14T13:00:00.000Z", endedAt: "2026-05-14T14:00:00.000Z", category: null }),
    ]);

    expect(result).toEqual([
      { category: "Work", totalMs: 60 * 60 * 1000 },
      { category: "Uncategorized", totalMs: 60 * 60 * 1000 },
      { category: "work", totalMs: 30 * 60 * 1000 },
    ]);
  });
});
