import { describe, expect, it } from "vitest";
import { healthQuantity, suggestHealthMetric } from "@/lib/health-habits";

describe("healthQuantity", () => {
  it("passes counts through and leaves unsent measures alone", () => {
    expect(healthQuantity("steps", { steps: 8275.4 }, { goalUnit: "count" })).toBe(8275);
    expect(healthQuantity("steps", {}, { goalUnit: "count" })).toBeNull();
  });
  it("turns check habits into done/not done", () => {
    expect(healthQuantity("workouts", { workouts: 1 }, { goalUnit: "check" })).toBe(1);
    expect(healthQuantity("workouts", { workouts: 0 }, { goalUnit: "check" })).toBe(0);
    expect(healthQuantity("sleepHours", { sleepHours: 6.5 }, { goalUnit: "check" })).toBe(0);
    expect(healthQuantity("sleepHours", { sleepHours: 7.2 }, { goalUnit: "check" })).toBe(1);
  });
  it("converts sleep to minutes for minute habits", () => {
    expect(healthQuantity("sleepHours", { sleepHours: 7.5 }, { goalUnit: "minutes" })).toBe(450);
  });
  it("ignores junk", () => {
    expect(healthQuantity("steps", { steps: -3 }, { goalUnit: "count" })).toBeNull();
    expect(healthQuantity("steps", { steps: Number.NaN }, { goalUnit: "count" })).toBeNull();
  });
});

describe("suggestHealthMetric", () => {
  it("guesses from Josh's habit titles", () => {
    expect(suggestHealthMetric("👟 10,000 steps")).toBe("steps");
    expect(suggestHealthMetric("Weigh-in")).toBe("weighIn");
    expect(suggestHealthMetric("🏃 Run")).toBe("workouts");
    expect(suggestHealthMetric("Meditate")).toBe("mindfulMinutes");
    expect(suggestHealthMetric("Journal")).toBeNull();
  });
});
