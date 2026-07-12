// Pure helpers for location signals (no DB — the service layer wraps these).
// Events are arrive/leave markers at named places, posted by iOS Shortcuts
// geofence automations. See docs/location-signals.md.

export type LocationKind = "arrive" | "leave";

export type LocationEventLike = {
  place: string;
  kind: LocationKind;
  occurredAt: Date;
};

export type CurrentPlace = {
  place: string;
  since: Date;
};

/** Ignore an "arrive" older than this — assume the geofence missed the exit. */
export const CURRENT_PLACE_MAX_AGE_HOURS = 18;

/**
 * Where the user is right now, from newest-first events: the latest event
 * wins — an `arrive` pins the place, a `leave` (or nothing recent) means
 * "out and about". Stale arrivals (older than CURRENT_PLACE_MAX_AGE_HOURS)
 * don't count, so a missed exit event can't say "at the gym" all week.
 */
export function deriveCurrentPlace(
  eventsNewestFirst: LocationEventLike[],
  now: Date,
): CurrentPlace | null {
  const latest = eventsNewestFirst[0];
  if (!latest || latest.kind !== "arrive") return null;
  const ageMs = now.getTime() - latest.occurredAt.getTime();
  if (ageMs < 0 || ageMs > CURRENT_PLACE_MAX_AGE_HOURS * 3_600_000) return null;
  return { place: latest.place, since: latest.occurredAt };
}
