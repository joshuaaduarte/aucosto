import { describe, expect, it } from "vitest";
import { predictCurrentTimeOptions } from "@/lib/time-predictions";

describe("predictCurrentTimeOptions", () => {
  it("suggests work during weekday working hours", () => {
    const predictions = predictCurrentTimeOptions({
      now: new Date(2026, 7, 17, 10, 0),
    });
    expect(predictions[0]).toMatchObject({ label: "Work", reason: "weekday 9-5" });
  });

  it("suggests commute during weekday commute windows", () => {
    const predictions = predictCurrentTimeOptions({
      now: new Date(2026, 7, 17, 17, 30),
    });
    expect(predictions[0]).toMatchObject({ label: "Commute" });
  });

  it("prefers an active calendar event over baseline work", () => {
    const now = new Date(2026, 7, 17, 10, 0);
    const predictions = predictCurrentTimeOptions({
      now,
      calendarItems: [
        {
          id: "c1",
          title: "Design review",
          startsAt: new Date(2026, 7, 17, 9, 30),
          endsAt: new Date(2026, 7, 17, 10, 30),
          status: "confirmed",
          allDay: false,
        },
      ],
    });
    expect(predictions[0]).toMatchObject({ label: "Design review", category: "calendar" });
  });

  it("suggests due habits near their reminder time", () => {
    const predictions = predictCurrentTimeOptions({
      now: new Date(2026, 7, 17, 6, 15),
      habits: [
        {
          id: "h1",
          title: "Run",
          dueToday: true,
          completedToday: false,
          reminderTime: "06:00",
        },
      ],
    });
    expect(predictions[0]).toMatchObject({ label: "Run", category: "habit" });
  });
});
