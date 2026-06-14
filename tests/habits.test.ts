import { describe, expect, it } from "vitest";
import { formatClockMinutes } from "@/lib/habits";

describe("formatClockMinutes", () => {
  it("formats morning times as 12-hour with am", () => {
    expect(formatClockMinutes(7 * 60 + 12)).toBe("7:12am");
    expect(formatClockMinutes(0)).toBe("12:00am");
    expect(formatClockMinutes(6 * 60 + 5)).toBe("6:05am");
  });

  it("formats afternoon/evening times with pm", () => {
    expect(formatClockMinutes(12 * 60)).toBe("12:00pm");
    expect(formatClockMinutes(13 * 60 + 30)).toBe("1:30pm");
    expect(formatClockMinutes(23 * 60 + 59)).toBe("11:59pm");
  });

  it("rounds and wraps out-of-range minutes", () => {
    expect(formatClockMinutes(7 * 60 + 12.6)).toBe("7:13am");
    expect(formatClockMinutes(-30)).toBe("11:30pm");
    expect(formatClockMinutes(1440)).toBe("12:00am");
  });
});
