import { describe, expect, it } from "vitest";
import { buildTodayTimeline, pickNowCards } from "@/app/app/_lib/hub-now";

const base = { sleepState: "none" as const, morningCompleted: false, reflectedToday: false };

describe("pickNowCards", () => {
  it("shows only the sleep card while asleep", () => {
    expect(pickNowCards({ ...base, hour: 2, sleepState: "running" })).toEqual(["sleep"]);
    expect(pickNowCards({ ...base, hour: 7, sleepState: "running" })).toEqual(["sleep"]);
  });

  it("shows sleep and the morning check-in until the morning is done", () => {
    expect(pickNowCards({ ...base, hour: 7 })).toEqual(["sleep", "morning"]);
    expect(pickNowCards({ ...base, hour: 7, sleepState: "logged", morningCompleted: true })).toEqual(["focus"]);
  });

  it("falls back to focus during the day", () => {
    expect(pickNowCards({ ...base, hour: 14 })).toEqual(["focus"]);
  });

  it("asks for the reflection, then bed, in the evening", () => {
    expect(pickNowCards({ ...base, hour: 21 })).toEqual(["reflect-today", "sleep"]);
    expect(pickNowCards({ ...base, hour: 21, reflectedToday: true })).toEqual(["sleep"]);
    expect(pickNowCards({ ...base, hour: 21, reflectedToday: true, sleepState: "logged" })).toEqual(["focus"]);
  });
});

describe("buildTodayTimeline", () => {
  const at = (h: number) => new Date(2026, 10, 3, h);
  it("merges plan blocks and events by time, once each, without all-day events", () => {
    const rows = buildTodayTimeline({
      planBlocks: [{ id: "p1", title: "Deep work", startsAt: at(9), endsAt: at(11) }],
      events: [
        { id: "p1", title: "Deep work", startsAt: at(9), endsAt: at(11) },
        { id: "e1", title: "Dentist", startsAt: at(8), endsAt: at(9) },
        { id: "e2", title: "Holiday", startsAt: at(0), endsAt: at(23), allDay: true },
      ],
      now: at(10),
      formatTime: (d) => `${d.getHours()}h`,
    });
    expect(rows).toEqual([
      { id: "e1", title: "Dentist", timeLabel: "8h", past: true, kind: "event" },
      { id: "p1", title: "Deep work", timeLabel: "9h", past: false, kind: "plan" },
    ]);
  });
});
