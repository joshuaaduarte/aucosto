import { describe, expect, it } from "vitest";
import { feedHostLabel, normalizeFeedUrl, parseFeedOccurrences } from "@/lib/ical-feed";

const ics = (body: string) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//test//EN", body.trim(), "END:VCALENDAR"].join("\r\n");

const window = { from: new Date("2026-11-01T00:00:00Z"), to: new Date("2026-11-30T00:00:00Z") };

describe("normalizeFeedUrl", () => {
  it("turns webcal into https and rejects other schemes", () => {
    expect(normalizeFeedUrl(" webcal://p01-calendars.icloud.com/x.ics ")).toBe(
      "https://p01-calendars.icloud.com/x.ics",
    );
    expect(normalizeFeedUrl("https://calendar.google.com/calendar/ical/a/private-b/basic.ics")).toContain("https://");
    expect(normalizeFeedUrl("ftp://x")).toBeNull();
    expect(normalizeFeedUrl("not a url")).toBeNull();
  });
  it("labels a feed by host only", () => {
    expect(feedHostLabel("https://www.outlook.office365.com/owa/calendar/secret/calendar.ics")).toBe(
      "outlook.office365.com",
    );
  });
});

describe("parseFeedOccurrences", () => {
  it("rejects non-calendar text", () => {
    expect(() => parseFeedOccurrences("<html>login</html>", window)).toThrow(/calendar/);
  });

  it("reads a one-off UTC event and skips cancelled ones", () => {
    const out = parseFeedOccurrences(
      ics(`
BEGIN:VEVENT
UID:one@test
DTSTART:20261110T170000Z
DTEND:20261110T173000Z
SUMMARY:Standup
LOCATION:Room 4
END:VEVENT
BEGIN:VEVENT
UID:two@test
DTSTART:20261111T170000Z
DTEND:20261111T173000Z
SUMMARY:Gone
STATUS:CANCELLED
END:VEVENT`),
      window,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ title: "Standup", location: "Room 4", allDay: false, status: "confirmed" });
    expect(out[0]!.startsAt.toISOString()).toBe("2026-11-10T17:00:00.000Z");
  });

  it("expands weekly series with an EXDATE and a moved instance (Outlook-style zone)", () => {
    const out = parseFeedOccurrences(
      ics(`
BEGIN:VTIMEZONE
TZID:Pacific Standard Time
BEGIN:STANDARD
DTSTART:16010101T020000
TZOFFSETFROM:-0700
TZOFFSETTO:-0800
RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=11
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:16010101T020000
TZOFFSETFROM:-0800
TZOFFSETTO:-0700
RRULE:FREQ=YEARLY;BYDAY=2SU;BYMONTH=3
END:DAYLIGHT
END:VTIMEZONE
BEGIN:VEVENT
UID:nvh@test
DTSTART;TZID=Pacific Standard Time:20261103T140000
DTEND;TZID=Pacific Standard Time:20261103T150000
RRULE:FREQ=WEEKLY;COUNT=4
EXDATE;TZID=Pacific Standard Time:20261110T140000
SUMMARY:NVH weekly
END:VEVENT
BEGIN:VEVENT
UID:nvh@test
RECURRENCE-ID;TZID=Pacific Standard Time:20261117T140000
DTSTART;TZID=Pacific Standard Time:20261118T100000
DTEND;TZID=Pacific Standard Time:20261118T110000
SUMMARY:NVH weekly (moved)
END:VEVENT`),
      window,
    );
    expect(out.map((o) => o.title)).toEqual(["NVH weekly", "NVH weekly (moved)", "NVH weekly"]);
    // Nov 3 is PST after the Nov 1 change: 14:00 PST = 22:00 UTC.
    expect(out[0]!.startsAt.toISOString()).toBe("2026-11-03T22:00:00.000Z");
    expect(out[1]!.startsAt.toISOString()).toBe("2026-11-18T18:00:00.000Z");
    // The moved instance keys on its ORIGINAL start, so it updates in place.
    expect(out[1]!.key).toContain("nvh@test@2026-11-17");
    expect(new Set(out.map((o) => o.key)).size).toBe(3);
  });

  it("keeps all-day events as all-day and drops ones outside the window", () => {
    const out = parseFeedOccurrences(
      ics(`
BEGIN:VEVENT
UID:bday@test
DTSTART;VALUE=DATE:20261120
DTEND;VALUE=DATE:20261121
SUMMARY:Ana's birthday
END:VEVENT
BEGIN:VEVENT
UID:old@test
DTSTART:20260101T170000Z
DTEND:20260101T180000Z
SUMMARY:Old
END:VEVENT`),
      window,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ title: "Ana's birthday", allDay: true });
  });
});
