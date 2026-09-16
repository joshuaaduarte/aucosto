// Pure helpers for scheduling and wording the two daily push nudges.
//
// Why this file exists: the nudge times used to be guesses (07:30 / 19:30).
// They're now derived from the owner's own activity histogram — the JITAI
// idea that a prompt only works at a moment that is both relevant AND
// actionable. `preferredNudgeHours` is the reproducible derivation; run
// scripts/derive-nudge-times.ts to re-check it against fresh data.
//
// No DB access — importable from anywhere. Tested in tests/nudge-timing.test.ts.

export type ActivityHour = {
  /** Local hour, 0–23. */
  hour: number;
  /** Distinct local days on which the user did anything in this hour. */
  activeDays: number;
};

export type NudgeSlot = "morning" | "evening";

/** Hours we'll consider for each slot. Morning is capped before the midday
 *  work block; evening stops at 21 so there's still runway to plan before a
 *  22:00–00:00 bedtime. */
const MORNING_WINDOW = { from: 4, to: 11 } as const;
const EVENING_WINDOW = { from: 18, to: 21 } as const;

/** Fraction of the window's peak that counts as "reliably awake and using
 *  the app" when looking for the *start* of the morning. */
const MORNING_ONSET_RATIO = 0.5;

function withinWindow(
  hours: ActivityHour[],
  window: { from: number; to: number },
): ActivityHour[] {
  return hours
    .filter((h) => h.hour >= window.from && h.hour <= window.to)
    .sort((a, b) => a.hour - b.hour);
}

/**
 * Best hour to send each nudge, derived from when the user is actually
 * active.
 *
 * Morning uses *onset* rather than peak: the wake-and-plan-confirm prompt
 * should be waiting when the day starts, not arrive once it's underway. So
 * we take the earliest hour that reaches half the morning peak.
 *
 * Evening uses the plain peak inside a window that stops before bedtime.
 *
 * Falls back to sensible defaults when there isn't enough history.
 */
export function preferredNudgeHours(
  hours: ActivityHour[],
  fallback: { morningHour: number; eveningHour: number } = {
    morningHour: 7,
    eveningHour: 21,
  },
): { morningHour: number; eveningHour: number } {
  const morning = withinWindow(hours, MORNING_WINDOW);
  const evening = withinWindow(hours, EVENING_WINDOW);

  let morningHour = fallback.morningHour;
  const morningPeak = Math.max(0, ...morning.map((h) => h.activeDays));
  if (morningPeak > 0) {
    const threshold = morningPeak * MORNING_ONSET_RATIO;
    const onset = morning.find((h) => h.activeDays >= threshold);
    if (onset) morningHour = onset.hour;
  }

  let eveningHour = fallback.eveningHour;
  const eveningPeak = Math.max(0, ...evening.map((h) => h.activeDays));
  if (eveningPeak > 0) {
    // Latest hour that ties the peak — later is better for planning
    // tomorrow, as long as it's still inside the window.
    const best = evening.filter((h) => h.activeDays === eveningPeak).pop();
    if (best) eveningHour = best.hour;
  }

  return { morningHour, eveningHour };
}

/** Which nudge a given local hour belongs to. Noon is the divider. */
export function slotForHour(hour: number): NudgeSlot {
  return hour < 12 ? "morning" : "evening";
}

/** Convert a local hour to the UTC hour a cron must fire at.
 *  `offsetHours` is the local zone's offset from UTC (LA in PDT = -7). */
export function localHourToUtcHour(hour: number, offsetHours: number): number {
  return ((hour - offsetHours) % 24 + 24) % 24;
}

export type NudgeBlock = {
  title: string;
  /** Pre-formatted local time, e.g. "9:00 AM". */
  timeLabel: string;
};

function joinBlocks(blocks: NudgeBlock[]): string {
  return blocks.map((b) => `${b.timeLabel} ${b.title}`).join(" · ");
}

/**
 * Evening nudge. Asks for an if-then plan for tomorrow rather than nagging
 * about today — the megastudy pattern (plan ahead, then remind against the
 * plan) beat plain reminders.
 */
export function buildPlanNudge(options: {
  reflected: boolean;
  plannedTomorrow: number;
}): { title: string; body: string; url: string } | null {
  if (options.plannedTomorrow > 0 && options.reflected) return null;

  if (options.plannedTomorrow > 0) {
    return {
      title: "Tomorrow's set 👌",
      body: "Two minutes on how today went, while it's fresh.",
      url: "/app/reflect",
    };
  }

  return {
    title: "What's tomorrow look like? 🌙",
    body: options.reflected
      ? "Pick two or three blocks so tomorrow starts with a plan."
      : "Reflect on today, then pick two or three blocks for tomorrow.",
    url: "/app/plan",
  };
}

/**
 * Morning nudge. When a plan exists it names the blocks and asks only for
 * confirmation; with no plan it falls back to capturing the wake time.
 */
export function buildConfirmNudge(options: {
  wakeCaptured: boolean;
  blocks: NudgeBlock[];
  habitCue?: NudgeBlock | null;
}): { title: string; body: string; url: string } | null {
  const { wakeCaptured, blocks, habitCue } = options;

  if (blocks.length > 0) {
    return {
      title: "Today's plan ☀️",
      body: `${joinBlocks(blocks.slice(0, 3))} — tap to confirm.`,
      url: "/app/plan",
    };
  }

  if (wakeCaptured) {
    if (!habitCue) return null;
    return {
      title: "One thing today 🎯",
      body: `${habitCue.timeLabel} ${habitCue.title}`,
      url: "/app/plan",
    };
  }

  return {
    title: "Good morning ☀️",
    body: "Set today's first block — it takes one tap.",
    url: "/app/plan",
  };
}
