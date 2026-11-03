// The hub's "Now" slot: instead of stacking every contextual card (focus,
// sleep, morning check-in, reflection) the hub shows only what fits the hour.
//
//   • asleep (a sleep session is running) → the sleep card, to wake up
//   • morning (05:00–10:59) until the morning check-in is done → sleep + morning
//   • evening (18:00 on) → today's reflection, then "going to bed"
//   • otherwise → the one generated focus recommendation
//
// Pure and server-side; the server clock is pinned to the owner's timezone.

export type NowCard = "sleep" | "morning" | "reflect-today" | "focus";

export function pickNowCards(input: {
  hour: number;
  sleepState: "running" | "logged" | "none";
  morningCompleted: boolean;
  reflectedToday: boolean;
}): NowCard[] {
  const { hour, sleepState, morningCompleted, reflectedToday } = input;
  if (sleepState === "running") return ["sleep"];
  if (hour >= 5 && hour < 11 && !morningCompleted) return ["sleep", "morning"];
  if (hour >= 18) {
    const cards: NowCard[] = [];
    if (!reflectedToday) cards.push("reflect-today");
    if (sleepState === "none") cards.push("sleep");
    return cards.length ? cards : ["focus"];
  }
  return ["focus"];
}

export type TimelineItem = {
  id: string;
  title: string;
  timeLabel: string;
  /** The item has ended. */
  past: boolean;
  /** "plan" blocks can start a timer; "event" rows link to the calendar. */
  kind: "plan" | "event";
};

type Timed = { id: string; title: string; startsAt: Date; endsAt: Date };

/**
 * Today's plan blocks and calendar events in one list, by start time. Events
 * that are themselves plan blocks (same id) are listed once, as plan blocks;
 * all-day events are left out (they have no place on a timeline).
 */
export function buildTodayTimeline(input: {
  planBlocks: Timed[];
  events: Array<Timed & { allDay?: boolean }>;
  now: Date;
  formatTime: (date: Date) => string;
}): TimelineItem[] {
  const planIds = new Set(input.planBlocks.map((b) => b.id));
  const rows = [
    ...input.planBlocks.map((b) => ({ ...b, kind: "plan" as const })),
    ...input.events.filter((e) => !e.allDay && !planIds.has(e.id)).map((e) => ({ ...e, kind: "event" as const })),
  ];
  return rows
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .map((row) => ({
      id: row.id,
      title: row.title,
      timeLabel: input.formatTime(row.startsAt),
      past: row.endsAt < input.now,
      kind: row.kind,
    }));
}
