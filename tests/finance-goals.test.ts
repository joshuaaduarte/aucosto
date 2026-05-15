import { describe, expect, it } from "vitest";
import { summarizeGoal, summarizeGoals } from "@/lib/finance-goals";

describe("finance-goals", () => {
  it("computes progress and monthly pace for one goal", () => {
    const result = summarizeGoal(
      {
        targetAmountCents: 1000000,
        currentAmountCents: 250000,
        targetDate: new Date("2026-09-01T12:00:00.000Z"),
        monthlyContributionCents: null,
      },
      new Date("2026-05-14T12:00:00.000Z"),
    );

    expect(result).toEqual({
      fundedCents: 250000,
      remainingCents: 750000,
      fundedPercent: 25,
      monthlyNeededCents: 187500,
      targetDateLabel: "Sep 2026",
    });
  });

  it("summarizes active goals only", () => {
    const result = summarizeGoals(
      [
        {
          targetAmountCents: 1000000,
          currentAmountCents: 250000,
          targetDate: new Date("2026-09-01T12:00:00.000Z"),
          monthlyContributionCents: null,
          status: "active",
        },
        {
          targetAmountCents: 300000,
          currentAmountCents: 100000,
          targetDate: null,
          monthlyContributionCents: 25000,
          status: "paused",
        },
        {
          targetAmountCents: 500000,
          currentAmountCents: 500000,
          targetDate: null,
          monthlyContributionCents: null,
          status: "done",
        },
      ],
      new Date("2026-05-14T12:00:00.000Z"),
    );

    expect(result).toEqual({
      targetCents: 1300000,
      fundedCents: 350000,
      remainingCents: 950000,
      monthlyNeededCents: 212500,
      fundedPercent: 27,
      activeCount: 2,
    });
  });
});
