// Rest days for the app-wide streak and habit streaks. A rest day is one
// "streak.rest_days_set" event (meta = { days, rest }), so this service only
// reads and writes the event log — no table. The streak math itself is pure,
// in src/lib/app-streak.ts and src/lib/habits.ts.

import "server-only";
import { requireCan } from "@/lib/auth/can";
import { listEventsOfTypeSince, recordEvent } from "@/lib/services/events";
import { REST_DAYS_EVENT, REST_DAYS_MAX_AHEAD, restDaysFromEvents } from "@/lib/app-streak";

/**
 * Rest days on or after `since`. Rest days are set at most
 * REST_DAYS_MAX_AHEAD days early, so events are read from that far before.
 * Empty on failure: rest days only ever soften a streak.
 */
export async function listRestDays(userId: string, since: Date): Promise<Set<string>> {
  requireCan(userId, "streak", "read");
  try {
    const from = new Date(since);
    from.setDate(from.getDate() - REST_DAYS_MAX_AHEAD - 1);
    const events = await listEventsOfTypeSince(userId, REST_DAYS_EVENT, from, { limit: 500 });
    return restDaysFromEvents(events);
  } catch (error) {
    console.error("listRestDays failed", error);
    return new Set();
  }
}

/** Turn rest days on or off. Callers validate the range (restDayRange). */
export async function setRestDays(userId: string, days: string[], rest: boolean): Promise<void> {
  requireCan(userId, "streak", "write");
  if (days.length === 0) return;
  await recordEvent({
    userId,
    tool: "streak",
    type: REST_DAYS_EVENT,
    refId: days[0],
    meta: { days, rest },
  });
}
