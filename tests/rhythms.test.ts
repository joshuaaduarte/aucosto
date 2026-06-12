import { describe, expect, it } from "vitest";
import {
  normalizeRhythmType,
  rhythmDurationMinutes,
  formatRhythmDuration,
  suggestedRhythmForHour,
} from "@/lib/rhythms";
import { projectProgress, normalizeProjectStatus } from "@/lib/projects";
import { deriveRhythmConsistency } from "@/lib/insights";

describe("rhythm helpers", () => {
  it("normalizes valid types and rejects junk", () => {
    expect(normalizeRhythmType("work")).toBe("work");
    expect(normalizeRhythmType("sleep")).toBe("sleep");
    expect(normalizeRhythmType("nope")).toBeNull();
    expect(normalizeRhythmType(null)).toBeNull();
  });

  it("suggests the rhythm that fits the hour", () => {
    expect(suggestedRhythmForHour(7)).toBe("wakeup");
    expect(suggestedRhythmForHour(13)).toBe("work");
    expect(suggestedRhythmForHour(19)).toBe("winddown");
    expect(suggestedRhythmForHour(22)).toBe("sleep");
    expect(suggestedRhythmForHour(3)).toBe("sleep");
  });

  it("computes and formats durations", () => {
    const start = new Date("2026-06-12T09:00:00Z");
    const end = new Date("2026-06-12T10:12:00Z");
    expect(rhythmDurationMinutes(start, end)).toBe(72);
    expect(rhythmDurationMinutes(end, start)).toBe(0);
    expect(formatRhythmDuration(72)).toBe("1h 12m");
    expect(formatRhythmDuration(45)).toBe("45m");
    expect(formatRhythmDuration(120)).toBe("2h");
    expect(formatRhythmDuration(null)).toBe("—");
  });
});

describe("deriveRhythmConsistency", () => {
  it("buckets sessions by week and counts per type", () => {
    const from = new Date("2026-06-01T00:00:00");
    const to = new Date("2026-06-14T23:59:59");
    const sessions = [
      { type: "work", startedAt: new Date("2026-06-02T09:00:00") },
      { type: "work", startedAt: new Date("2026-06-02T14:00:00") },
      { type: "sleep", startedAt: new Date("2026-06-03T22:00:00") },
      { type: "bogus", startedAt: new Date("2026-06-04T10:00:00") },
      { type: "wakeup", startedAt: new Date("2026-06-10T07:00:00") },
    ];
    const result = deriveRhythmConsistency(sessions, { from, to });
    expect(result.totalSessions).toBe(4); // bogus ignored
    expect(result.activeDays).toBe(3); // Jun 2, 3, 10 (Jun 4 was bogus)
    expect(result.busiestType?.type).toBe("work");
    const work = result.perType.find((entry) => entry.type === "work");
    expect(work?.count).toBe(2);
    // Two ISO weeks span Jun 1–14.
    expect(result.weekly.length).toBeGreaterThanOrEqual(2);
  });

  it("returns an empty shape with no sessions", () => {
    const from = new Date("2026-06-01T00:00:00");
    const to = new Date("2026-06-07T23:59:59");
    const result = deriveRhythmConsistency([], { from, to });
    expect(result.totalSessions).toBe(0);
    expect(result.activeDays).toBe(0);
    expect(result.busiestType).toBeNull();
  });
});

describe("project helpers", () => {
  it("computes task progress percent", () => {
    expect(projectProgress(0, 0)).toBe(0);
    expect(projectProgress(1, 1)).toBe(50);
    expect(projectProgress(3, 1)).toBe(75);
    expect(projectProgress(2, 0)).toBe(100);
  });

  it("normalizes archived as a valid status", () => {
    expect(normalizeProjectStatus("archived")).toBe("archived");
    expect(normalizeProjectStatus("paused")).toBe("paused");
    expect(normalizeProjectStatus("garbage")).toBe("active");
  });
});
