import { describe, expect, it } from "vitest";
import {
  HABIT_TEMPLATES,
  HABIT_TEMPLATE_GROUPS,
  findHabitTemplate,
  splitLeadingEmoji,
  templateTitle,
} from "@/lib/habit-templates";
import { HABIT_CADENCES, HABIT_DAY_PARTS, HABIT_GOAL_UNITS } from "@/lib/habits";

describe("habit templates", () => {
  it("has unique keys and valid enum values", () => {
    const keys = HABIT_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const template of HABIT_TEMPLATES) {
      expect(HABIT_DAY_PARTS).toContain(template.dayPart);
      expect(HABIT_CADENCES).toContain(template.cadence);
      expect(HABIT_GOAL_UNITS).toContain(template.goalUnit);
      expect(HABIT_TEMPLATE_GROUPS).toContain(template.group);
      expect(template.description.length).toBeGreaterThan(10);
      expect(template.targetCount).toBeGreaterThan(0);
    }
  });

  it("covers the required presets", () => {
    const keys = HABIT_TEMPLATES.map((t) => t.key);
    for (const required of [
      "morning-light",
      "meditate",
      "journal",
      "read",
      "prep-tomorrow",
      "workout",
      "run",
      "walk",
      "water",
      "sleep-8",
      "weekly-review",
      "deep-work",
      "no-phone-hour",
    ]) {
      expect(keys).toContain(required);
    }
  });

  it("water is a tap counter, deep work is timer-ready", () => {
    const water = findHabitTemplate("water")!;
    expect(water.goalUnit).toBe("count");
    expect(water.targetCount).toBe(8);
    const deepWork = findHabitTemplate("deep-work")!;
    expect(deepWork.goalUnit).toBe("minutes");
    expect(deepWork.defaultDurationMinutes).toBe(60);
  });

  it("builds emoji titles and splits them back apart", () => {
    const meditate = findHabitTemplate("meditate")!;
    const title = templateTitle(meditate);
    expect(title).toBe("🧘 Meditate");
    const split = splitLeadingEmoji(title);
    expect(split.emoji).toBe("🧘");
    expect(split.rest).toBe("Meditate");
    expect(splitLeadingEmoji("Plain habit")).toEqual({
      emoji: null,
      rest: "Plain habit",
    });
  });
});
