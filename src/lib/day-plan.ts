// Pure helpers for the day plan (the /app/plan screen) and for re-entry
// after a gap. No DB access; tested in tests/day-plan.test.ts.
//
// Two ideas drive this file:
//
// 1. A plan is a small number of *named, time-boxed* blocks, written the
//    night before. Planned blocks are stored as CalendarItems tagged with
//    sourceTool = PLAN_SOURCE_TOOL, so they land on the existing timeline
//    instead of needing a table of their own.
//
// 2. Coming back after a gap should read as a fresh start, not as a wall of
//    missing days. `deriveReturnState` decides when to reframe, and gives
//    the rest of the app a window start so stats don't render the gap.

export const PLAN_SOURCE_TOOL = "plan";

/** A gap of at least this many days makes re-entry a "fresh start". */
export const RETURN_GAP_DAYS = 5;

export type PlanSlot = {
  /** Stable key for form fields / React lists. */
  key: string;
  label: string;
  /** Local hour the block starts. */
  startHour: number;
  durationMinutes: number;
};

/** The default shape of a planned day: one deep block, one commitment, one
 *  recovery block. Deliberately three — enough to shape a day, few enough to
 *  fill in under a minute. */
export const DEFAULT_PLAN_SLOTS: PlanSlot[] = [
  { key: "focus", label: "Focus block", startHour: 9, durationMinutes: 90 },
  { key: "second", label: "Second block", startHour: 13, durationMinutes: 60 },
  { key: "recovery", label: "Recovery", startHour: 18, durationMinutes: 45 },
];

/** Local midnight of the day `offsetDays` from `now`. */
export function startOfDay(now: Date, offsetDays = 0): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d;
}

/** Resolve a slot against a specific day into a concrete start/end pair. */
export function slotWindow(
  slot: Pick<PlanSlot, "startHour" | "durationMinutes">,
  day: Date,
): { startsAt: Date; endsAt: Date } {
  const startsAt = new Date(day);
  startsAt.setHours(slot.startHour, 0, 0, 0);
  const endsAt = new Date(startsAt.getTime() + slot.durationMinutes * 60_000);
  return { startsAt, endsAt };
}

/** After this local hour there isn't enough of the day left to be worth
 *  shaping, so planning rolls forward to tomorrow. */
export const PLAN_TODAY_CUTOFF_HOUR = 17;

export type PlanMode =
  | { kind: "confirm"; dayOffset: 0 }
  | { kind: "plan"; dayOffset: 0 | 1 };

/**
 * What the plan screen should do right now.
 *
 * The case this exists for: waking at 5am with nothing planned. The screen
 * must offer to shape *today* — offering tomorrow would be answering a
 * question nobody asked, and it's the morning push that lands the user here.
 * Late in the day the same emptiness means the opposite, so planning rolls
 * forward to tomorrow.
 */
export function resolvePlanMode(options: {
  now: Date;
  hasPlanToday: boolean;
  cutoffHour?: number;
}): PlanMode {
  if (options.hasPlanToday) return { kind: "confirm", dayOffset: 0 };
  const cutoff = options.cutoffHour ?? PLAN_TODAY_CUTOFF_HOUR;
  return { kind: "plan", dayOffset: options.now.getHours() < cutoff ? 0 : 1 };
}

/**
 * Default slots for a day, skipping any that have already passed.
 *
 * Suggesting a 9:00 AM focus block at 2pm is the kind of small wrongness that
 * makes a tool feel like it isn't paying attention — and it costs a correction
 * on every single block.
 */
export function defaultSlotsForDay(options: {
  now: Date;
  dayOffset: 0 | 1;
}): PlanSlot[] {
  if (options.dayOffset === 1) return DEFAULT_PLAN_SLOTS;

  // Round up to the next whole hour, leaving a few minutes of runway.
  const earliest = options.now.getMinutes() > 50
    ? options.now.getHours() + 2
    : options.now.getHours() + 1;

  const usable = DEFAULT_PLAN_SLOTS.filter((slot) => slot.startHour >= earliest);
  if (usable.length > 0) return usable;

  // Nothing left in the template — offer a single block starting next hour.
  return [
    {
      key: "now",
      label: "Next block",
      startHour: Math.min(23, earliest),
      durationMinutes: 60,
    },
  ];
}

export type ReturnState = {
  /** Whole days since the last recorded activity. 0 when active today. */
  awayDays: number;
  /** True when the gap is big enough to reframe as a fresh start. */
  isReturning: boolean;
  /** Earliest date stats should cover. On a return this is the return day,
   *  so the gap never renders; otherwise it's `defaultWindowStart`. */
  windowStart: Date;
};

/**
 * Decide whether this visit is a re-entry after a gap.
 *
 * The fresh-start effect says a temporal landmark motivates by separating
 * you from the past imperfect self — so after a real gap we start the
 * counters over rather than showing weeks of blanks.
 */
export function deriveReturnState(options: {
  lastActiveAt: Date | null;
  now: Date;
  defaultWindowStart: Date;
  gapDays?: number;
}): ReturnState {
  const { lastActiveAt, now, defaultWindowStart } = options;
  const gapDays = options.gapDays ?? RETURN_GAP_DAYS;

  if (!lastActiveAt) {
    return { awayDays: 0, isReturning: false, windowStart: defaultWindowStart };
  }

  const today = startOfDay(now);
  const lastDay = startOfDay(lastActiveAt);
  const awayDays = Math.max(
    0,
    Math.round((today.getTime() - lastDay.getTime()) / 86_400_000),
  );

  if (awayDays < gapDays) {
    return { awayDays, isReturning: false, windowStart: defaultWindowStart };
  }

  return { awayDays, isReturning: true, windowStart: today };
}

/** "3 weeks" / "6 days" — how long they were away, for the welcome-back copy. */
export function describeAway(awayDays: number): string {
  if (awayDays >= 14) {
    const weeks = Math.round(awayDays / 7);
    return `${weeks} weeks`;
  }
  return `${awayDays} days`;
}

export type PlannedBlockLike = {
  title: string;
  startsAt: Date;
};

/** One-line summary of a plan, e.g. "9:00 AM Deep work · 1:00 PM Gym". */
export function planSummaryLine(
  blocks: PlannedBlockLike[],
  timeZone?: string,
): string {
  return blocks
    .slice()
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .map((b) => {
      const label = b.startsAt.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        ...(timeZone ? { timeZone } : {}),
      });
      return `${label} ${b.title}`;
    })
    .join(" · ");
}
