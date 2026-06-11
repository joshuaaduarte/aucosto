import { describe, expect, it } from "vitest";
import { wallClockWindow, windowFromFormData } from "@/lib/wall-clock";

describe("wallClockWindow", () => {
  it("parses date + times in the local timezone", () => {
    const window = wallClockWindow("2026-06-10", "14:30", "15:45")!;
    expect(window.startsAt.getHours()).toBe(14);
    expect(window.startsAt.getMinutes()).toBe(30);
    expect(window.endsAt.getTime() - window.startsAt.getTime()).toBe(
      75 * 60000,
    );
  });

  it("rolls an end at or before the start into the next day", () => {
    const window = wallClockWindow("2026-06-10", "23:30", "00:15")!;
    expect(window.endsAt.getTime() - window.startsAt.getTime()).toBe(
      45 * 60000,
    );
  });

  it("returns null for missing or invalid input", () => {
    expect(wallClockWindow("", "14:30", "15:00")).toBeNull();
    expect(wallClockWindow("2026-06-10", "", "15:00")).toBeNull();
    expect(wallClockWindow("2026-06-10", "garbage", "15:00")).toBeNull();
  });
});

describe("windowFromFormData", () => {
  it("prefers absolute ISO fields when present", () => {
    const formData = new Map<string, string>([
      ["startsAtIso", "2026-06-10T21:30:00.000Z"],
      ["endsAtIso", "2026-06-10T22:45:00.000Z"],
      ["date", "2026-06-10"],
      ["start", "09:00"],
      ["end", "10:00"],
    ]);
    const window = windowFromFormData(formData)!;
    expect(window.startsAt.toISOString()).toBe("2026-06-10T21:30:00.000Z");
    expect(window.endsAt.toISOString()).toBe("2026-06-10T22:45:00.000Z");
  });

  it("falls back to wall-clock fields when ISO fields are absent", () => {
    const formData = new Map<string, string>([
      ["date", "2026-06-10"],
      ["start", "09:00"],
      ["end", "10:00"],
    ]);
    const window = windowFromFormData(formData)!;
    expect(window.startsAt.getHours()).toBe(9);
    expect(window.endsAt.getTime() - window.startsAt.getTime()).toBe(
      60 * 60000,
    );
  });

  it("returns null when nothing usable is present", () => {
    expect(windowFromFormData(new Map())).toBeNull();
  });
});
