import { describe, expect, it } from "vitest";
import { whoopSleepToMorning } from "@/lib/whoop-morning";

const todayStart = new Date("2026-07-12T07:00:00.000Z"); // midnight LA (PDT)

describe("whoopSleepToMorning", () => {
  it("maps a scored overnight sleep to wake time and asleep minutes", () => {
    const result = whoopSleepToMorning(
      {
        start: "2026-07-12T06:10:00.000Z", // 11:10pm PDT
        end: "2026-07-12T13:40:00.000Z", // 6:40am PDT
        nap: false,
        score: {
          stage_summary: {
            total_in_bed_time_milli: 7.5 * 3_600_000,
            total_awake_time_milli: 30 * 60_000,
          },
        },
      },
      todayStart,
    );
    expect(result?.wakeAt.toISOString()).toBe("2026-07-12T13:40:00.000Z");
    expect(result?.sleepMinutes).toBe(7 * 60); // 7h30m in bed − 30m awake
  });

  it("falls back to end − start when Whoop hasn't scored the sleep", () => {
    const result = whoopSleepToMorning(
      {
        start: "2026-07-12T06:00:00.000Z",
        end: "2026-07-12T14:00:00.000Z",
        score: null,
      },
      todayStart,
    );
    expect(result?.sleepMinutes).toBe(8 * 60);
  });

  it("rejects naps, stale sleeps, and malformed records", () => {
    const base = {
      start: "2026-07-12T06:00:00.000Z",
      end: "2026-07-12T14:00:00.000Z",
    };
    expect(whoopSleepToMorning({ ...base, nap: true }, todayStart)).toBeNull();
    expect(
      // Ended yesterday relative to the day boundary → yesterday's morning.
      whoopSleepToMorning(
        { start: "2026-07-11T06:00:00.000Z", end: "2026-07-11T13:00:00.000Z" },
        todayStart,
      ),
    ).toBeNull();
    expect(whoopSleepToMorning({ end: base.end }, todayStart)).toBeNull();
    expect(whoopSleepToMorning(null, todayStart)).toBeNull();
    expect(
      // Inverted range.
      whoopSleepToMorning({ start: base.end, end: base.start }, todayStart),
    ).toBeNull();
  });
});
