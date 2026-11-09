import { describe, expect, it } from "vitest";
import {
  freshStartLabel,
  habitStrength,
  habitStrengthLabel,
  suggestFocusHabits,
} from "@/lib/habits";

describe("habitStrength", () => {
  it("starts at zero with no history", () => {
    expect(habitStrength([], 7)).toBe(0);
  });

  it("reaches about 80% after a month of perfect daily slots", () => {
    expect(habitStrength(Array(30).fill(1), 7)).toBe(80);
  });

  it("dents rather than resets on a single miss", () => {
    const perfect = habitStrength(Array(30).fill(1), 7);
    const oneMiss = habitStrength([...Array(29).fill(1), 0], 7);
    expect(oneMiss).toBeLessThan(perfect);
    expect(oneMiss).toBeGreaterThan(perfect - 10);
  });

  it("counts partial progress fractionally", () => {
    const half = habitStrength(Array(30).fill(0.5), 7);
    expect(half).toBe(40);
  });

  it("moves faster per slot for weekly habits", () => {
    expect(habitStrength(Array(8).fill(1), 1)).toBeGreaterThan(habitStrength(Array(8).fill(1), 7));
  });

  it("clamps slot values to 0–1", () => {
    expect(habitStrength([5, -2, 1], 7)).toBe(habitStrength([1, 0, 1], 7));
  });

  it("labels strength bands", () => {
    expect(habitStrengthLabel(85)).toBe("Solid");
    expect(habitStrengthLabel(55)).toBe("Building");
    expect(habitStrengthLabel(25)).toBe("Starting");
    expect(habitStrengthLabel(5)).toBe("New");
  });
});

describe("suggestFocusHabits", () => {
  const at = (day: number) => new Date(2026, 0, day);
  it("prefers strong habits, then measurable ones, capped at the limit", () => {
    const picks = suggestFocusHabits(
      [
        { id: "a", title: "🧘 Meditate", strength: 0, createdAt: at(1) },
        { id: "b", title: "👟 10,000 steps", strength: 0, createdAt: at(2) },
        { id: "c", title: "Journal", strength: 60, createdAt: at(3) },
        { id: "d", title: "📖 Read", strength: 0, createdAt: at(4) },
        { id: "e", title: "Floss", strength: 0, createdAt: at(5) },
        { id: "f", title: "⚖️ Weigh-in", strength: 0, createdAt: at(6) },
      ],
      4,
    );
    expect(picks).toEqual(["c", "b", "d", "f"]);
  });
});

describe("freshStartLabel", () => {
  it("names the new month on the 1st", () => {
    expect(freshStartLabel(new Date(2026, 11, 1))).toMatch(/December/);
  });
  it("marks Mondays", () => {
    expect(freshStartLabel(new Date(2026, 10, 9))).toMatch(/New week/);
  });
  it("is quiet other days", () => {
    expect(freshStartLabel(new Date(2026, 10, 10))).toBeNull();
  });
});
