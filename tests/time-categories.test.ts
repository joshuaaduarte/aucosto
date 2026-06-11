import { describe, expect, it } from "vitest";
import {
  PRESET_TIME_CATEGORIES,
  UNCATEGORIZED_COLOR,
  categoryColor,
  categoryLabel,
  normalizeCategory,
} from "@/lib/time-categories";

describe("time categories", () => {
  it("resolves preset colors by id and label, case-insensitively", () => {
    const shower = PRESET_TIME_CATEGORIES.find((c) => c.id === "shower")!;
    expect(categoryColor("shower")).toBe(shower.color);
    expect(categoryColor("Shower")).toBe(shower.color);
    expect(categoryColor("  SHOWER  ")).toBe(shower.color);
  });

  it("has unique ids and colors set for every preset", () => {
    const ids = PRESET_TIME_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const preset of PRESET_TIME_CATEGORIES) {
      expect(preset.color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("gives linked tool categories their own colors", () => {
    expect(categoryColor("do")).not.toBe(UNCATEGORIZED_COLOR);
    expect(categoryColor("habit")).not.toBe(UNCATEGORIZED_COLOR);
    expect(categoryColor("calendar")).not.toBe(UNCATEGORIZED_COLOR);
  });

  it("assigns a stable fallback color to custom categories", () => {
    const first = categoryColor("guitar practice");
    expect(first).toMatch(/^#[0-9a-f]{6}$/);
    expect(categoryColor("guitar practice")).toBe(first);
    expect(categoryColor("Guitar Practice")).toBe(first);
  });

  it("falls back to the uncategorized color for empty input", () => {
    expect(categoryColor(null)).toBe(UNCATEGORIZED_COLOR);
    expect(categoryColor("   ")).toBe(UNCATEGORIZED_COLOR);
  });

  it("labels presets with their canonical casing and keeps custom text", () => {
    expect(categoryLabel("shower")).toBe("Shower");
    expect(categoryLabel("Deep Focus")).toBe("Deep Focus");
    expect(categoryLabel(null)).toBe("Uncategorized");
  });

  it("normalizes by trimming and lowercasing", () => {
    expect(normalizeCategory("  Reading ")).toBe("reading");
    expect(normalizeCategory(undefined)).toBe("");
  });
});
