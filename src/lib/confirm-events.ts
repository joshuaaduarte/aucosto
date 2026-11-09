// "Did this happen?" — pure logic for turning ended calendar events into
// one-tap time entries (the Toggl calendar pattern: confirm, don't type).
//
// An event needs confirming when it has ended, is recent, isn't all-day,
// and nothing already covers it: no time entry linked to it overlaps the
// occurrence, and unlinked entries don't cover at least half of it.
// Skips are remembered by the caller and passed in.
//
// No DB access — tested in tests/confirm-events.test.ts.

export type ConfirmableEvent = {
  /** Occurrence id (virtual "parent::iso" for recurring native blocks). */
  id: string;
  /** Backing CalendarItem id — what TimeEntry.calendarEventId stores. */
  backingId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  status: string;
  sourceTool: string | null;
};

export type CoveringEntry = {
  startedAt: Date;
  endedAt: Date | null;
  calendarEventId: string | null;
};

export type PendingConfirmation = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  minutes: number;
  sourceTool: string | null;
};

/** Events shorter than this aren't worth a prompt (reminders, "leave now"). */
const MIN_MINUTES = 10;
/** Longer than this is a placeholder ("Out of office"), not something done. */
const MAX_MINUTES = 8 * 60;

function overlapMs(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

export function pendingConfirmations(input: {
  events: ConfirmableEvent[];
  entries: CoveringEntry[];
  skippedIds: Set<string>;
  now: Date;
  /** Only events ending at or after this count (e.g. start of yesterday). */
  since: Date;
  limit?: number;
}): PendingConfirmation[] {
  const nowMs = input.now.getTime();
  const sinceMs = input.since.getTime();
  const out: PendingConfirmation[] = [];

  for (const event of input.events) {
    if (event.allDay) continue;
    if (event.status === "cancelled" || event.status === "done") continue;
    // Habit ghosts and rhythm context aren't calendar commitments.
    if (event.sourceTool === "rhythm") continue;
    if (input.skippedIds.has(event.id)) continue;
    const start = event.startsAt.getTime();
    const end = event.endsAt.getTime();
    if (end > nowMs || end < sinceMs) continue;
    const durationMs = end - start;
    const minutes = Math.round(durationMs / 60000);
    if (minutes < MIN_MINUTES || minutes > MAX_MINUTES) continue;

    let linked = false;
    let coveredMs = 0;
    for (const entry of input.entries) {
      const entryStart = entry.startedAt.getTime();
      const entryEnd = (entry.endedAt ?? input.now).getTime();
      const overlap = overlapMs(start, end, entryStart, entryEnd);
      if (overlap <= 0) continue;
      if (entry.calendarEventId === event.backingId) {
        linked = true;
        break;
      }
      coveredMs += overlap;
    }
    if (linked || coveredMs >= durationMs / 2) continue;

    out.push({
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      minutes,
      sourceTool: event.sourceTool,
    });
  }

  out.sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime());
  return input.limit ? out.slice(0, input.limit) : out;
}

/**
 * Minutes of the day not covered by any time entry, from `from` to `now`.
 * Drives the daytime check-in push ("3h untracked since 9:00").
 */
export function untrackedMinutes(input: {
  entries: Array<{ startedAt: Date; endedAt: Date | null }>;
  from: Date;
  now: Date;
}): number {
  const from = input.from.getTime();
  const to = input.now.getTime();
  if (to <= from) return 0;
  const spans = input.entries
    .map((entry) => ({
      start: Math.max(from, entry.startedAt.getTime()),
      end: Math.min(to, (entry.endedAt ?? input.now).getTime()),
    }))
    .filter((span) => span.end > span.start)
    .sort((a, b) => a.start - b.start);
  let covered = 0;
  let cursor = from;
  for (const span of spans) {
    const start = Math.max(span.start, cursor);
    if (span.end > start) {
      covered += span.end - start;
      cursor = span.end;
    }
  }
  return Math.round((to - from - covered) / 60000);
}

/** Copy for the daytime check-in push, or null when there's nothing to ask. */
export function buildCheckInNudge(input: {
  pending: number;
  untracked: number;
  sinceLabel: string;
  /** A timer running 4h+ is more likely forgotten: ask about it first. */
  longTimer?: { label: string; hours: number } | null;
}): { title: string; body: string; url: string } | null {
  if (input.longTimer && input.longTimer.hours >= 4) {
    return {
      title: `Still on ${input.longTimer.label}? ⏱️`,
      body: `That timer has run ${input.longTimer.hours}h. Tap to keep it or stop it at the right time.`,
      url: "/app/time",
    };
  }
  const parts: string[] = [];
  if (input.pending > 0) {
    parts.push(`${input.pending} event${input.pending === 1 ? "" : "s"} to confirm`);
  }
  if (input.untracked >= 120) {
    const hours = Math.floor(input.untracked / 60);
    parts.push(`about ${hours}h untracked`);
  }
  if (parts.length === 0) return null;
  return {
    title: "Quick check-in ⏱️",
    body: `Since ${input.sinceLabel}: ${parts.join(", ")}. Two taps to fill it in.`,
    url: "/app/time#confirm",
  };
}

/** "9:00–9:30 AM · Yesterday" — server-side formatting for the card. */
export function formatConfirmWhen(row: { startsAt: Date; endsAt: Date }, now: Date): string {
  const time = (date: Date) =>
    date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const day =
    row.startsAt >= today
      ? "Today"
      : row.startsAt.getTime() >= today.getTime() - 24 * 60 * 60 * 1000
        ? "Yesterday"
        : row.startsAt.toLocaleDateString("en-US", { weekday: "short" });
  return `${time(row.startsAt)}–${time(row.endsAt)} · ${day}`;
}
