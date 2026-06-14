import { describe, expect, it } from "vitest";
import {
  MOOD_SCALE,
  RATING_FIELDS,
  dayKey,
  isValidRating,
  moodColor,
  moodEmoji,
  reflectionDayLabel,
  summarizeSnapshot,
} from "@/lib/reflect";

describe("reflection scales", () => {
  it("defines a complete 1–5 emoji-anchored scale", () => {
    expect(MOOD_SCALE.map((step) => step.value)).toEqual([1, 2, 3, 4, 5]);
    for (const step of MOOD_SCALE) {
      expect(step.emoji.length).toBeGreaterThan(0);
      expect(step.color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("covers the four rating fields", () => {
    expect(RATING_FIELDS.map((f) => f.field)).toEqual([
      "mood",
      "energyLevel",
      "productivityRating",
      "dayRating",
    ]);
  });

  it("resolves mood colors and emoji with fallbacks", () => {
    expect(moodColor(5)).toBe("#10b981");
    expect(moodColor(0)).toBe("#9ca3af");
    expect(moodEmoji(1)).toBe("😞");
    expect(moodEmoji(9)).toBe("·");
  });

  it("validates ratings strictly", () => {
    expect(isValidRating(3)).toBe(true);
    expect(isValidRating(0)).toBe(false);
    expect(isValidRating(6)).toBe(false);
    expect(isValidRating(2.5)).toBe(false);
  });
});

describe("dayKey", () => {
  it("produces a local YYYY-MM-DD key", () => {
    expect(dayKey(new Date(2026, 5, 12, 23, 30))).toBe("2026-06-12");
    expect(dayKey(new Date(2026, 0, 1, 0, 5))).toBe("2026-01-01");
  });
});

describe("reflectionDayLabel", () => {
  it("labels the current day", () => {
    expect(reflectionDayLabel("2026-06-14", "2026-06-14")).toBe("today");
  });

  it("labels the prior day, including across month boundaries", () => {
    expect(reflectionDayLabel("2026-06-13", "2026-06-14")).toBe("yesterday");
    expect(reflectionDayLabel("2026-05-31", "2026-06-01")).toBe("yesterday");
    expect(reflectionDayLabel("2025-12-31", "2026-01-01")).toBe("yesterday");
  });

  it("collapses older days to 'that day'", () => {
    expect(reflectionDayLabel("2026-06-12", "2026-06-14")).toBe("that day");
    expect(reflectionDayLabel("2026-01-01", "2026-06-14")).toBe("that day");
  });
});

describe("summarizeSnapshot", () => {
  it("summarizes a full day", () => {
    expect(
      summarizeSnapshot({
        trackedMinutes: 135,
        entryCount: 4,
        tasksCompleted: 3,
        habitsDue: 5,
        habitsHit: 4,
        entryNotes: [],
      }),
    ).toBe("2h 15m tracked across 4 entries · 3 tasks completed · 4/5 habits logged");
  });

  it("handles the quiet day and singular forms", () => {
    expect(
      summarizeSnapshot({
        trackedMinutes: 0,
        entryCount: 1,
        tasksCompleted: 1,
        habitsDue: 0,
        habitsHit: 0,
        entryNotes: [],
      }),
    ).toBe("nothing tracked across 1 entry · 1 task completed");
  });
});
