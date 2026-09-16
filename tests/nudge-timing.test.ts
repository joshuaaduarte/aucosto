import { describe, expect, it } from "vitest";
import {
  buildConfirmNudge,
  buildPlanNudge,
  localHourToUtcHour,
  preferredNudgeHours,
  slotForHour,
  type ActivityHour,
} from "@/lib/nudge-timing";

/** Josh's real histogram (distinct active days per LA hour), bulk
 *  time.category_updated backfill excluded. */
const REAL: ActivityHour[] = [
  { hour: 3, activeDays: 1 }, { hour: 4, activeDays: 5 },
  { hour: 5, activeDays: 9 }, { hour: 6, activeDays: 12 },
  { hour: 7, activeDays: 11 }, { hour: 8, activeDays: 10 },
  { hour: 9, activeDays: 16 }, { hour: 10, activeDays: 12 },
  { hour: 11, activeDays: 14 }, { hour: 12, activeDays: 10 },
  { hour: 13, activeDays: 12 }, { hour: 14, activeDays: 13 },
  { hour: 15, activeDays: 14 }, { hour: 16, activeDays: 12 },
  { hour: 17, activeDays: 3 }, { hour: 18, activeDays: 5 },
  { hour: 19, activeDays: 7 }, { hour: 20, activeDays: 6 },
  { hour: 21, activeDays: 8 }, { hour: 22, activeDays: 10 },
  { hour: 23, activeDays: 2 },
];

describe("preferredNudgeHours", () => {
  it("picks morning onset and pre-bedtime evening from real data", () => {
    const { morningHour, eveningHour } = preferredNudgeHours(REAL);
    // Morning peak is 16 at 09:00; half of that is 8, first hour reaching it is 05:00.
    expect(morningHour).toBe(5);
    // Evening window stops at 21 so there's runway before a 22:00 bedtime.
    expect(eveningHour).toBe(21);
  });

  it("uses onset rather than peak so the prompt waits at the start of the day", () => {
    const { morningHour } = preferredNudgeHours(REAL);
    const peakHour = REAL.filter((h) => h.hour >= 4 && h.hour <= 11)
      .sort((a, b) => b.activeDays - a.activeDays)[0]!.hour;
    expect(peakHour).toBe(9);
    expect(morningHour).toBeLessThan(peakHour);
  });

  it("never returns an evening hour past bedtime runway", () => {
    const lateOwl: ActivityHour[] = [
      { hour: 18, activeDays: 1 }, { hour: 21, activeDays: 4 },
      { hour: 22, activeDays: 40 }, { hour: 23, activeDays: 50 },
    ];
    expect(preferredNudgeHours(lateOwl).eveningHour).toBeLessThanOrEqual(21);
  });

  it("falls back when there is no history", () => {
    expect(preferredNudgeHours([])).toEqual({ morningHour: 7, eveningHour: 21 });
  });

  it("ignores hours outside both windows", () => {
    const noise: ActivityHour[] = [
      { hour: 2, activeDays: 99 }, { hour: 14, activeDays: 99 },
    ];
    expect(preferredNudgeHours(noise)).toEqual({ morningHour: 7, eveningHour: 21 });
  });
});

describe("slotForHour / localHourToUtcHour", () => {
  it("splits slots at noon", () => {
    expect(slotForHour(5)).toBe("morning");
    expect(slotForHour(11)).toBe("morning");
    expect(slotForHour(12)).toBe("evening");
    expect(slotForHour(21)).toBe("evening");
  });

  it("converts LA hours to cron UTC hours, wrapping midnight", () => {
    expect(localHourToUtcHour(5, -7)).toBe(12); // 05:00 PDT -> 12:00 UTC
    expect(localHourToUtcHour(21, -7)).toBe(4); // 21:00 PDT -> 04:00 UTC
    expect(localHourToUtcHour(0, -7)).toBe(7);
  });
});

describe("buildPlanNudge", () => {
  it("asks for tomorrow's blocks when nothing is planned", () => {
    const nudge = buildPlanNudge({ reflected: true, plannedTomorrow: 0 });
    expect(nudge?.url).toBe("/app/plan");
    expect(nudge?.body).toMatch(/two or three blocks/i);
  });

  it("falls back to reflecting once tomorrow is planned", () => {
    const nudge = buildPlanNudge({ reflected: false, plannedTomorrow: 3 });
    expect(nudge?.url).toBe("/app/reflect");
  });

  it("stays silent when the plan exists and the day is reflected", () => {
    expect(buildPlanNudge({ reflected: true, plannedTomorrow: 2 })).toBeNull();
  });
});

describe("buildConfirmNudge", () => {
  it("names the planned blocks so the prompt is if-then, not generic", () => {
    const nudge = buildConfirmNudge({
      wakeCaptured: false,
      blocks: [
        { title: "Deep work", timeLabel: "9:00 AM" },
        { title: "Gym", timeLabel: "6:00 PM" },
      ],
    });
    expect(nudge?.body).toContain("9:00 AM Deep work");
    expect(nudge?.body).toContain("6:00 PM Gym");
    expect(nudge?.url).toBe("/app/plan");
  });

  it("caps at three blocks so the notification stays readable", () => {
    const nudge = buildConfirmNudge({
      wakeCaptured: false,
      blocks: Array.from({ length: 6 }, (_, i) => ({
        title: `Block ${i}`, timeLabel: `${i + 6}:00 AM`,
      })),
    });
    expect(nudge?.body).toContain("Block 2");
    expect(nudge?.body).not.toContain("Block 3");
  });

  it("offers a single habit cue when the wake is already captured", () => {
    const nudge = buildConfirmNudge({
      wakeCaptured: true,
      blocks: [],
      habitCue: { title: "Run", timeLabel: "7:00 AM" },
    });
    expect(nudge?.title).toMatch(/one thing/i);
    expect(nudge?.body).toBe("7:00 AM Run");
  });

  it("says nothing when the wake is captured and there is no cue", () => {
    expect(
      buildConfirmNudge({ wakeCaptured: true, blocks: [], habitCue: null }),
    ).toBeNull();
  });
});
