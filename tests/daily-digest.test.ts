import { describe, expect, it } from "vitest";
import {
  deriveDailyDigest,
  type DailyDigestInput,
} from "@/app/app/_lib/daily-digest";

// Fixed reference point: June 10, 2026 — 10 days elapsed of a 30-day month.
const NOW = new Date(2026, 5, 10, 12, 0, 0);

function entry(startMinutesAgo: number, durationMinutes: number) {
  const startedAt = new Date(NOW.getTime() - startMinutesAgo * 60_000);
  return {
    startedAt,
    endedAt: new Date(startedAt.getTime() + durationMinutes * 60_000),
  };
}

function digestInput(overrides: Partial<DailyDigestInput> = {}): DailyDigestInput {
  return {
    now: NOW,
    completedTodayEntries: [],
    runningEntry: null,
    habits: [],
    finance: null,
    ...overrides,
  };
}

describe("deriveDailyDigest", () => {
  it("returns quiet zero-state lines with no finance line", () => {
    const digest = deriveDailyDigest(digestInput());

    expect(digest.lines.map((line) => line.key)).toEqual(["time", "habits"]);

    const time = digest.lines.find((line) => line.key === "time")!;
    expect(time.value).toBe("0m");
    expect(time.detail).toBe("nothing tracked yet today");
    expect(time.href).toBe("/app/time");
    expect(time.progress).toBe(0);
    expect(time.subtle).toBe(true);

    const habits = digest.lines.find((line) => line.key === "habits")!;
    expect(habits.value).toBe("All clear");
    expect(habits.detail).toBe("no habits due today");
    expect(habits.href).toBe("/app/habits");
    expect(habits.progress).toBeNull();
    expect(habits.subtle).toBe(true);
  });

  it("sums completed entries and adds the running entry's elapsed time", () => {
    const digest = deriveDailyDigest(
      digestInput({
        completedTodayEntries: [entry(240, 90), entry(120, 30)],
        runningEntry: { startedAt: new Date(NOW.getTime() - 15 * 60_000) },
      }),
    );

    const time = digest.lines.find((line) => line.key === "time")!;
    // 90m + 30m completed + 15m running = 135m = 2h 15m
    expect(time.value).toBe("2h 15m");
    expect(time.detail).toBe("tracked today, timer still live");
    // Coverage of the waking window so far: 135m over 6h (06:00→12:00).
    expect(time.progress).toBeCloseTo(135 / 360, 5);
    expect(time.subtle).toBe(false);
  });

  it("counts only due habits and reports partial completion", () => {
    const digest = deriveDailyDigest(
      digestInput({
        habits: [
          { dueToday: true, completedToday: true },
          { dueToday: true, completedToday: false },
          // not due today: completion must not count toward the ratio
          { dueToday: false, completedToday: true },
        ],
      }),
    );

    const habits = digest.lines.find((line) => line.key === "habits")!;
    expect(habits.value).toBe("1 of 2");
    expect(habits.detail).toBe("due habits handled so far");
    expect(habits.progress).toBe(0.5);
    expect(habits.subtle).toBe(false);
  });

  it("reports all due habits handled", () => {
    const digest = deriveDailyDigest(
      digestInput({
        habits: [
          { dueToday: true, completedToday: true },
          { dueToday: true, completedToday: true },
        ],
      }),
    );

    const habits = digest.lines.find((line) => line.key === "habits")!;
    expect(habits.value).toBe("2 of 2");
    expect(habits.detail).toBe("due habits handled");
  });

  it("projects month-to-date spend pace when finance data is present", () => {
    const digest = deriveDailyDigest(
      digestInput({
        finance: {
          monthTransactions: [
            { amount: -10_000, description: "Coffee shop" },
            // income and card payments are not true expenses
            { amount: 250_000, description: "Payroll deposit" },
            { amount: -50_000, description: "Credit card payment" },
          ],
        },
      }),
    );

    const finance = digest.lines.find((line) => line.key === "finance");
    expect(finance).toBeDefined();
    // $100 spent over 10 of 30 days -> on pace for $300.
    expect(finance!.value).toBe("$100");
    expect(finance!.detail).toBe("on pace for $300 this month");
    expect(finance!.href).toBe("/app/finance");
    expect(finance!.progress).toBeCloseTo(100 / 300, 5);
  });

  it("collapses the finance tile entirely when there is no spend yet", () => {
    const digest = deriveDailyDigest(
      digestInput({ finance: { monthTransactions: [] } }),
    );

    expect(digest.lines.some((line) => line.key === "finance")).toBe(false);
  });

  it("omits the finance line when finance is hidden or not fetched", () => {
    const withNull = deriveDailyDigest(digestInput({ finance: null }));
    expect(withNull.lines.some((line) => line.key === "finance")).toBe(false);

    const withUndefined = deriveDailyDigest(digestInput({ finance: undefined }));
    expect(withUndefined.lines.some((line) => line.key === "finance")).toBe(false);
  });
});
