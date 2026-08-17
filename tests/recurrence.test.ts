import { describe, expect, it } from "vitest";
import { expandRecurrence } from "@/lib/recurrence";

const at = (day: number, hour = 9) => new Date(2026, 5, day, hour, 0, 0);

describe("expandRecurrence", () => {
  it("expands daily occurrences inside a range", () => {
    const occurrences = expandRecurrence(at(1), at(1, 10), { frequency: "daily" }, {
      from: at(3, 0),
      to: at(6, 0),
    });
    expect(occurrences.map((item) => item.startsAt.getDate())).toEqual([3, 4, 5]);
  });

  it("supports weekday weekly rules", () => {
    const occurrences = expandRecurrence(
      at(1),
      at(1, 10),
      { frequency: "weekly", weekdays: [1, 2, 3, 4, 5] },
      { from: at(1, 0), to: at(8, 0) },
    );
    expect(occurrences.map((item) => item.startsAt.getDay())).toEqual([1, 2, 3, 4, 5]);
  });

  it("supports custom weekly rules", () => {
    const occurrences = expandRecurrence(
      at(1),
      at(1, 10),
      { frequency: "weekly", weekdays: [2, 4] },
      { from: at(1, 0), to: at(8, 0) },
    );
    expect(occurrences.map((item) => item.startsAt.getDay())).toEqual([2, 4]);
  });

  it("supports monthly rules with end-of-month clamping", () => {
    const occurrences = expandRecurrence(
      new Date(2026, 0, 31, 9),
      new Date(2026, 0, 31, 10),
      { frequency: "monthly" },
      { from: new Date(2026, 1, 1), to: new Date(2026, 4, 1) },
    );
    expect(occurrences.map((item) => item.startsAt.getDate())).toEqual([28, 31, 30]);
  });

  it("stops at an until date", () => {
    const occurrences = expandRecurrence(
      at(1),
      at(1, 10),
      { frequency: "daily", until: at(4, 23).toISOString() },
      { from: at(1, 0), to: at(8, 0) },
    );
    expect(occurrences.map((item) => item.startsAt.getDate())).toEqual([1, 2, 3, 4]);
  });
});
