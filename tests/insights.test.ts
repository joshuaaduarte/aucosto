import { describe, expect, it } from "vitest";
import {
  buildDayFacts,
  deriveAllPatterns,
  deriveEstimationAccuracy,
  derivePlanVsActual,
  deriveSpendTrends,
  deriveTimeAllocation,
  deriveWellbeingTrends,
  deriveInsightOfTheDay,
  estimationSparkline,
  listWeekKeys,
  rangeStart,
  rollingAverage,
  weekKeyOf,
  weeklyTrackedSparkline,
} from "@/lib/insights";

const NOW = new Date(2026, 5, 12, 12, 0, 0); // Friday June 12 2026

const entry = (
  day: number,
  hour: number,
  durationMin: number,
  category: string | null = "work",
) => {
  const startedAt = new Date(2026, 5, day, hour, 0, 0);
  return {
    startedAt,
    endedAt: new Date(startedAt.getTime() + durationMin * 60000),
    category,
    label: category ?? "session",
  };
};

describe("shared buckets", () => {
  it("computes range starts and week keys", () => {
    expect(rangeStart("7d", NOW)!.getDate()).toBe(6);
    expect(rangeStart("all", NOW)).toBeNull();
    // June 12 2026 is a Friday → Monday June 8.
    expect(weekKeyOf(NOW)).toBe("2026-06-08");
    expect(
      listWeekKeys(new Date(2026, 5, 1), new Date(2026, 5, 12)),
    ).toEqual(["2026-06-01", "2026-06-08"]);
  });

  it("rolls averages over gaps", () => {
    expect(rollingAverage([1, null, 3], 2)).toEqual([1, 1, 3]);
    expect(rollingAverage([null, null], 3)).toEqual([null, null]);
  });
});

describe("deriveTimeAllocation", () => {
  it("buckets by week and ranks categories", () => {
    const allocation = deriveTimeAllocation(
      [entry(8, 9, 120, "work"), entry(9, 9, 60, "reading"), entry(2, 9, 30, "work")],
      { from: new Date(2026, 5, 1), to: NOW, now: NOW },
    );
    expect(allocation.weeks).toHaveLength(2);
    expect(allocation.weeks[1]!.totalMs).toBe(180 * 60000);
    expect(allocation.topCategory!.label).toBe("Work");
    expect(allocation.leastCategory!.label).toBe("Reading");
  });
});

describe("deriveWellbeingTrends", () => {
  it("aligns raw + rolling series to the day axis and finds best week", () => {
    const reflections = [
      { dateKey: "2026-06-01", mood: 2, energyLevel: 2, productivityRating: 2, dayRating: 2 },
      { dateKey: "2026-06-02", mood: 2, energyLevel: 2, productivityRating: 2, dayRating: 2 },
      { dateKey: "2026-06-08", mood: 5, energyLevel: 4, productivityRating: 4, dayRating: 5 },
      { dateKey: "2026-06-09", mood: 4, energyLevel: 4, productivityRating: 4, dayRating: 5 },
    ];
    const trends = deriveWellbeingTrends(reflections, {
      from: new Date(2026, 5, 1),
      to: NOW,
    });
    expect(trends.dayKeys[0]).toBe("2026-06-01");
    expect(trends.series.mood.raw[0]).toBe(2);
    expect(trends.series.mood.raw[2]).toBeNull();
    expect(trends.bestWeek!.avg).toBe(5);
    expect(trends.worstWeek!.avg).toBe(2);
  });
});

describe("deriveEstimationAccuracy", () => {
  const task = (day: number, est: number, actual: number) => ({
    completedAt: new Date(2026, 5, day, 17, 0),
    estimatedMinutes: est,
    actualMinutes: actual,
    bucket: "work",
  });

  it("computes weekly accuracy and an improving trend", () => {
    const accuracy = deriveEstimationAccuracy(
      [
        task(1, 60, 120), // 100% error
        task(2, 60, 110),
        task(3, 60, 100),
        task(8, 60, 70),
        task(9, 60, 65),
        task(10, 60, 60), // near perfect
      ],
      { from: new Date(2026, 5, 1), to: NOW },
    );
    expect(accuracy.sampleCount).toBe(6);
    expect(accuracy.trend).toBe("improving");
    expect(accuracy.weekly[1]!.accuracy).toBeGreaterThan(
      accuracy.weekly[0]!.accuracy,
    );
  });

  it("returns null trend with sparse data", () => {
    const accuracy = deriveEstimationAccuracy(
      [task(1, 60, 70)],
      { from: new Date(2026, 5, 1), to: NOW },
    );
    expect(accuracy.trend).toBeNull();
    expect(accuracy.best).toBeNull();
  });
});

describe("derivePlanVsActual", () => {
  it("measures tracked share of planned days only", () => {
    const items = [
      {
        startsAt: new Date(2026, 5, 8, 9, 0),
        endsAt: new Date(2026, 5, 8, 11, 0),
        allDay: false,
        status: "confirmed",
      },
    ];
    const result = derivePlanVsActual(
      items,
      [entry(8, 9, 60), entry(9, 9, 240)],
      { from: new Date(2026, 5, 1), to: NOW, now: NOW },
    );
    expect(result.days).toHaveLength(1);
    expect(result.days[0]!.pct).toBe(50);
    expect(result.overallPct).toBe(50);
  });
});

describe("deriveSpendTrends", () => {
  it("groups spending by month and computes MoM change", () => {
    const trends = deriveSpendTrends([
      { date: new Date(2026, 4, 10), amount: -10_000, category: "food" },
      { date: new Date(2026, 5, 10), amount: -15_000, category: "food" },
      { date: new Date(2026, 5, 11), amount: 50_000, category: null }, // income ignored
    ]);
    expect(trends.months).toHaveLength(2);
    expect(trends.months[1]!.totalCents).toBe(15_000);
    expect(trends.momChangePct).toBe(50);
  });
});

describe("patterns", () => {
  it("builds day facts and finds the habit-mood link", () => {
    const reflections = Array.from({ length: 8 }, (_, index) => ({
      dateKey: `2026-06-0${index + 1}`,
      mood: index < 4 ? 5 : 2,
      energyLevel: 3,
      productivityRating: 3,
      dayRating: 3,
      contextSnapshot:
        index < 4
          ? { habitsDue: 4, habitsHit: 4 }
          : { habitsDue: 4, habitsHit: 1 },
    }));
    const days = buildDayFacts({
      entries: [entry(1, 9, 60)],
      reflections,
      from: new Date(2026, 5, 1),
      to: NOW,
      now: NOW,
    });
    const findings = deriveAllPatterns(days);
    const habitFinding = findings.find((f) => f.key === "habits-mood");
    expect(habitFinding).toBeDefined();
    expect(habitFinding!.bars[0]!.value).toBe(5);
    expect(habitFinding!.bars[1]!.value).toBe(2);
  });

  it("weights time-of-day by duration", () => {
    const days = buildDayFacts({
      entries: [entry(8, 9, 300, "work"), entry(8, 20, 30, "reading")],
      reflections: [],
      from: new Date(2026, 5, 1),
      to: NOW,
      now: NOW,
    });
    const findings = deriveAllPatterns(days);
    const timeOfDay = findings.find((f) => f.key === "time-of-day");
    // 5.5h total > 4h threshold; morning dominates.
    expect(timeOfDay).toBeDefined();
    expect(timeOfDay!.finding).toContain("Morning");
  });
});

describe("sparklines + insight of the day", () => {
  it("computes weekly tracked sparkline with pace", () => {
    const entries = [entry(1, 9, 120), entry(2, 9, 120), entry(8, 9, 120), entry(12, 9, 240)];
    const spark = weeklyTrackedSparkline(entries, { weeks: 3, now: NOW });
    expect(spark.values).toHaveLength(3);
    expect(spark.currentMs).toBe(360 * 60000);
  });

  it("summarizes recent estimation ratios", () => {
    const spark = estimationSparkline([
      {
        completedAt: new Date(2026, 5, 10),
        estimatedMinutes: 60,
        actualMinutes: 90,
        bucket: null,
      },
    ]);
    expect(spark.ratios).toEqual([1.5]);
    expect(spark.latestAccuracy).toBe(50);
  });

  it("falls back to null with no eligible insight", () => {
    expect(
      deriveInsightOfTheDay({
        now: NOW,
        entries8w: [],
        tasks: [],
        days: [],
      }),
    ).toBeNull();
  });
});
