import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAN_SLOTS,
  RETURN_GAP_DAYS,
  deriveReturnState,
  describeAway,
  planSummaryLine,
  slotWindow,
  startOfDay,
} from "@/lib/day-plan";

describe("slotWindow", () => {
  it("resolves a slot against a day", () => {
    const day = new Date(2026, 8, 16);
    const { startsAt, endsAt } = slotWindow(
      { startHour: 9, durationMinutes: 90 },
      day,
    );
    expect(startsAt.getHours()).toBe(9);
    expect(endsAt.getHours()).toBe(10);
    expect(endsAt.getMinutes()).toBe(30);
  });

  it("keeps the default plan to three blocks", () => {
    expect(DEFAULT_PLAN_SLOTS).toHaveLength(3);
  });
});

describe("startOfDay", () => {
  it("returns local midnight and honours the offset", () => {
    const now = new Date(2026, 8, 16, 14, 32);
    expect(startOfDay(now).getHours()).toBe(0);
    expect(startOfDay(now, 1).getDate()).toBe(17);
  });
});

describe("deriveReturnState", () => {
  const now = new Date(2026, 8, 16, 9, 0);
  const defaultWindowStart = new Date(2026, 6, 1);

  it("treats a long gap as a fresh start and hides it from stats", () => {
    const state = deriveReturnState({
      lastActiveAt: new Date(2026, 7, 18),
      now,
      defaultWindowStart,
    });
    expect(state.isReturning).toBe(true);
    expect(state.awayDays).toBe(29);
    // Window starts today, so the 29 empty days never render.
    expect(state.windowStart.getTime()).toBe(startOfDay(now).getTime());
  });

  it("leaves an ordinary day alone", () => {
    const state = deriveReturnState({
      lastActiveAt: new Date(2026, 8, 15),
      now,
      defaultWindowStart,
    });
    expect(state.isReturning).toBe(false);
    expect(state.awayDays).toBe(1);
    expect(state.windowStart).toBe(defaultWindowStart);
  });

  it("does not trip one day below the threshold", () => {
    const justUnder = deriveReturnState({
      lastActiveAt: new Date(2026, 8, 16 - (RETURN_GAP_DAYS - 1)),
      now,
      defaultWindowStart,
    });
    expect(justUnder.isReturning).toBe(false);
  });

  it("is inert for a brand new user with no history", () => {
    const state = deriveReturnState({
      lastActiveAt: null,
      now,
      defaultWindowStart,
    });
    expect(state.isReturning).toBe(false);
    expect(state.awayDays).toBe(0);
  });
});

describe("describeAway", () => {
  it("uses days under two weeks and weeks beyond", () => {
    expect(describeAway(6)).toBe("6 days");
    expect(describeAway(29)).toBe("4 weeks");
  });
});

describe("planSummaryLine", () => {
  it("orders blocks by start time", () => {
    const line = planSummaryLine([
      { title: "Gym", startsAt: new Date(2026, 8, 16, 18, 0) },
      { title: "Deep work", startsAt: new Date(2026, 8, 16, 9, 0) },
    ]);
    expect(line).toBe("9:00 AM Deep work · 6:00 PM Gym");
  });

  it("returns an empty string for an empty plan", () => {
    expect(planSummaryLine([])).toBe("");
  });
});
