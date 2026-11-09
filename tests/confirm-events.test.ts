import { describe, expect, it } from "vitest";
import {
  buildCheckInNudge,
  pendingConfirmations,
  untrackedMinutes,
  type ConfirmableEvent,
} from "@/lib/confirm-events";

const at = (hhmm: string, day = "2026-11-09") => new Date(`${day}T${hhmm}:00`);
const event = (over: Partial<ConfirmableEvent> & { id: string }): ConfirmableEvent => ({
  backingId: over.id,
  title: over.id,
  startsAt: at("09:00"),
  endsAt: at("09:30"),
  allDay: false,
  status: "confirmed",
  sourceTool: null,
  ...over,
});
const base = { now: at("12:00"), since: at("00:00", "2026-11-08"), skippedIds: new Set<string>() };

describe("pendingConfirmations", () => {
  it("lists ended, uncovered events newest first", () => {
    const out = pendingConfirmations({
      ...base,
      events: [
        event({ id: "standup" }),
        event({ id: "review", startsAt: at("10:00"), endsAt: at("11:00") }),
        event({ id: "later", startsAt: at("13:00"), endsAt: at("14:00") }),
      ],
      entries: [],
    });
    expect(out.map((row) => row.id)).toEqual(["review", "standup"]);
    expect(out[0]!.minutes).toBe(60);
  });

  it("drops events already logged, mostly covered, skipped, all-day, tiny or huge", () => {
    const out = pendingConfirmations({
      ...base,
      skippedIds: new Set(["skipped"]),
      events: [
        event({ id: "linked", backingId: "parent" }),
        event({ id: "covered", startsAt: at("10:00"), endsAt: at("11:00") }),
        event({ id: "half", startsAt: at("11:00"), endsAt: at("11:40") }),
        event({ id: "skipped" }),
        event({ id: "allday", allDay: true }),
        event({ id: "tiny", startsAt: at("08:00"), endsAt: at("08:05") }),
        event({ id: "ooo", startsAt: at("00:00"), endsAt: at("11:59") }),
        event({ id: "cancelled", status: "cancelled" }),
      ],
      entries: [
        { startedAt: at("09:05"), endedAt: at("09:10"), calendarEventId: "parent" },
        { startedAt: at("10:00"), endedAt: at("10:40"), calendarEventId: null },
        { startedAt: at("11:00"), endedAt: at("11:10"), calendarEventId: null },
      ],
    });
    expect(out.map((row) => row.id)).toEqual(["half"]);
  });

  it("ignores events that ended before the window", () => {
    const out = pendingConfirmations({
      ...base,
      events: [event({ id: "old", startsAt: at("09:00", "2026-11-01"), endsAt: at("10:00", "2026-11-01") })],
      entries: [],
    });
    expect(out).toEqual([]);
  });
});

describe("untrackedMinutes", () => {
  it("subtracts merged entry spans from the window", () => {
    expect(
      untrackedMinutes({
        from: at("09:00"),
        now: at("12:00"),
        entries: [
          { startedAt: at("08:30"), endedAt: at("09:30") },
          { startedAt: at("09:15"), endedAt: at("10:00") },
          { startedAt: at("11:30"), endedAt: null },
        ],
      }),
    ).toBe(90);
  });
});

describe("buildCheckInNudge", () => {
  it("stays quiet when there's nothing to ask", () => {
    expect(buildCheckInNudge({ pending: 0, untracked: 60, sinceLabel: "9:00 AM" })).toBeNull();
  });
  it("names pending events and long gaps", () => {
    expect(buildCheckInNudge({ pending: 2, untracked: 190, sinceLabel: "9:00 AM" })?.body).toBe(
      "Since 9:00 AM: 2 events to confirm, about 3h untracked. Two taps to fill it in.",
    );
  });
  it("asks about a forgotten timer first", () => {
    expect(
      buildCheckInNudge({ pending: 1, untracked: 0, sinceLabel: "9:00 AM", longTimer: { label: "Arlo", hours: 6 } })
        ?.title,
    ).toBe("Still on Arlo? ⏱️");
  });
});
