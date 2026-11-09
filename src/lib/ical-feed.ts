// Pure helpers for read-only calendar feeds (the private iCal / .ics links
// Google Calendar and Outlook publish). No DB, no network: the service
// fetches the text and hands it here.
//
// Why a library: real feeds carry RRULEs, EXDATEs, moved occurrences
// (RECURRENCE-ID) and VTIMEZONE blocks with Windows zone names (Outlook).
// ical.js handles all of that; hand-rolling it is where feeds go wrong.
//
// Tested in tests/ical-feed.test.ts.

import ICAL from "ical.js";

export type FeedOccurrence = {
  /** Stable per occurrence: UID + original start, so a moved instance keeps its row. */
  key: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  location: string | null;
  notes: string | null;
  /** STATUS:TENTATIVE → "tentative"; everything else "confirmed". */
  status: "confirmed" | "tentative";
};

/** Feeds deliver events we don't want on a personal timeline. */
const MAX_OCCURRENCES_PER_EVENT = 500;
const MAX_NOTES_LENGTH = 2000;

/**
 * Accepts the links people actually paste: webcal:// (Apple/Google "subscribe"
 * buttons) becomes https://. Returns null for anything that isn't http(s).
 */
export function normalizeFeedUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withScheme = trimmed.replace(/^webcals?:\/\//i, "https://");
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  return url.toString();
}

/** A short, safe label for a feed URL (host only — the path is the secret). */
export function feedHostLabel(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "calendar feed";
  }
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

/**
 * Parse an .ics document and return every occurrence that overlaps
 * [from, to). Throws on text that isn't iCalendar at all, so the caller can
 * record a clear sync error instead of silently emptying the calendar.
 */
export function parseFeedOccurrences(
  icsText: string,
  window: { from: Date; to: Date },
): FeedOccurrence[] {
  if (!/BEGIN:VCALENDAR/i.test(icsText)) {
    throw new Error("That link didn't return a calendar (.ics) file.");
  }
  const root = new ICAL.Component(ICAL.parse(icsText));

  for (const tz of root.getAllSubcomponents("vtimezone")) {
    const tzid = tz.getFirstPropertyValue("tzid");
    if (typeof tzid === "string" && !ICAL.TimezoneService.has(tzid)) {
      ICAL.TimezoneService.register(tz);
    }
  }

  const masters = new Map<string, ICAL.Event>();
  const exceptions: ICAL.Event[] = [];
  for (const component of root.getAllSubcomponents("vevent")) {
    const event = new ICAL.Event(component);
    if (!event.uid) continue;
    if (component.hasProperty("recurrence-id")) {
      exceptions.push(event);
    } else {
      masters.set(event.uid, event);
    }
  }
  for (const exception of exceptions) {
    const master = masters.get(exception.uid);
    if (master) {
      master.relateException(exception);
    } else {
      // An orphan moved instance (its series is outside the export): keep it
      // as a one-off under a key that can't collide with a series row.
      masters.set(`${exception.uid}#${exception.recurrenceId?.toString()}`, exception);
    }
  }

  const fromMs = window.from.getTime();
  const toMs = window.to.getTime();
  const out: FeedOccurrence[] = [];

  const push = (
    event: ICAL.Event,
    key: string,
    start: ICAL.Time,
    end: ICAL.Time,
  ) => {
    const startsAt = start.toJSDate();
    let endsAt = end.toJSDate();
    if (endsAt <= startsAt) {
      endsAt = new Date(startsAt.getTime() + (start.isDate ? 24 * 60 : 30) * 60 * 1000);
    }
    if (endsAt.getTime() <= fromMs || startsAt.getTime() >= toMs) return;
    const statusProp = event.component.getFirstPropertyValue("status");
    if (typeof statusProp === "string" && statusProp.toUpperCase() === "CANCELLED") return;
    out.push({
      key,
      title: cleanText(event.summary, 200) ?? "(No title)",
      startsAt,
      endsAt,
      allDay: start.isDate,
      location: cleanText(event.location, 300),
      notes: cleanText(event.description, MAX_NOTES_LENGTH),
      status:
        typeof statusProp === "string" && statusProp.toUpperCase() === "TENTATIVE"
          ? "tentative"
          : "confirmed",
    });
  };

  for (const [key, event] of masters) {
    if (!event.isRecurring()) {
      if (!event.startDate) continue;
      push(event, `${key}@${event.startDate.toString()}`, event.startDate, event.endDate ?? event.startDate);
      continue;
    }
    const iterator = event.iterator();
    let count = 0;
    for (let next = iterator.next(); next; next = iterator.next()) {
      if (next.toJSDate().getTime() >= toMs) break;
      if (++count > MAX_OCCURRENCES_PER_EVENT) break;
      const details = event.getOccurrenceDetails(next);
      // Key on the ORIGINAL start (recurrenceId) so a moved meeting updates in place.
      push(
        details.item,
        `${key}@${details.recurrenceId.toString()}`,
        details.startDate,
        details.endDate,
      );
    }
  }

  out.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return out;
}
