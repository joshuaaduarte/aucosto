import { describe, expect, it } from "vitest";
import { isRatedReflection } from "@/lib/reflect";
import { deriveWellbeingTrends } from "@/lib/insights/trends";
import { habitWeekConsistency } from "@/lib/habits";

describe("isRatedReflection", () => {
  it("counts only days someone rated", () => {
    expect(isRatedReflection(null)).toBe(false);
    expect(isRatedReflection(undefined)).toBe(false);
    expect(isRatedReflection({ mood: null })).toBe(false);
    expect(isRatedReflection({ mood: 3 })).toBe(true);
  });
});

describe("deriveWellbeingTrends with unrated days", () => {
  it("leaves unrated days as gaps and out of the sample count", () => {
    const trends = deriveWellbeingTrends(
      [
        { dateKey: "2026-11-02", mood: 4, energyLevel: 4, productivityRating: 3, dayRating: 4 },
        { dateKey: "2026-11-03", mood: null, energyLevel: null, productivityRating: null, dayRating: null },
        { dateKey: "2026-11-04", mood: 2, energyLevel: 2, productivityRating: 2, dayRating: 2 },
      ],
      { from: new Date("2026-11-02T12:00:00"), to: new Date("2026-11-04T12:00:00") },
    );
    expect(trends.series.mood.raw).toEqual([4, null, 2]);
    expect(trends.sampleCount).toBe(2);
  });
});

describe("habitWeekConsistency", () => {
  const day = (due: boolean, completed: boolean, progress: number) => ({ due, completed, progress });

  it("counts a weekly habit as one slot, done once the week hits the target", () => {
    const week = [day(true, false, 0), day(true, false, 0), day(true, true, 1), ...Array(4).fill(day(true, false, 0))];
    expect(habitWeekConsistency({ cadence: "weekly", targetCount: 1 }, week)).toEqual({
      doneCount: 1,
      scheduledCount: 1,
      pct: 100,
    });
    expect(
      habitWeekConsistency({ cadence: "weekly", targetCount: 1 }, Array(7).fill(day(true, false, 0))),
    ).toEqual({ doneCount: 0, scheduledCount: 1, pct: 0 });
  });

  it("counts each due day for daily habits", () => {
    const week = [day(true, true, 1), day(true, false, 0), day(false, false, 0), day(true, true, 1)];
    expect(habitWeekConsistency({ cadence: "daily", targetCount: 1 }, week)).toEqual({
      doneCount: 2,
      scheduledCount: 3,
      pct: 67,
    });
  });
});
