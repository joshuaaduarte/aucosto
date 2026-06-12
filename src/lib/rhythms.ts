// Pure helpers for Life Rhythms — guided flows at the day's natural
// transition points. No DB access here, so this is importable from client
// components, server components, and the service alike (the service layer in
// src/lib/services/rhythms.ts owns the raw SQL). `type` is a string enum
// validated through normalizeRhythmType (mirrors the Habit.cadence pattern).

export const RHYTHM_TYPES = [
  "wakeup",
  "work",
  "winddown",
  "sleep",
  "workout",
] as const;

export type RhythmType = (typeof RHYTHM_TYPES)[number];

export type RhythmDefinition = {
  type: RhythmType;
  name: string;
  /** Short tagline shown under the name. */
  description: string;
  /** Emoji icon (matches the habit-templates emoji convention). */
  icon: string;
  /**
   * Timed rhythms expect an explicit End (sleep, workout, work) and surface a
   * running duration; untimed ones are quick "I did this" check-ins that can
   * be closed immediately.
   */
  timed: boolean;
  /** Color key resolved through categoryColor() for chips and accents. */
  colorKey: string;
  /**
   * Static, non-persisted prompts shown on the card — a gentle "here's what
   * this flow usually involves". Not checked off or stored anywhere.
   */
  checklist: string[];
};

export const RHYTHM_DEFINITIONS: Record<RhythmType, RhythmDefinition> = {
  wakeup: {
    type: "wakeup",
    name: "Morning Wake-up",
    description: "Start the day with intention before the noise begins.",
    icon: "🌅",
    timed: false,
    colorKey: "morning",
    checklist: [
      "Drink a glass of water",
      "Step outside for daylight",
      "Set the one thing that matters today",
      "Skip the phone for 20 minutes",
    ],
  },
  work: {
    type: "work",
    name: "Work Session",
    description: "Drop into focused, protected work.",
    icon: "💻",
    timed: true,
    colorKey: "work",
    checklist: [
      "Pick a single focus task",
      "Silence notifications",
      "Start a timer to protect the block",
      "Close stray tabs and chats",
    ],
  },
  winddown: {
    type: "winddown",
    name: "Evening Wind-down",
    description: "Close the loops and ease off the day.",
    icon: "🌇",
    timed: false,
    colorKey: "evening",
    checklist: [
      "Review what got done",
      "Set up tomorrow's first task",
      "Tidy the workspace",
      "Reflect on the day",
    ],
  },
  sleep: {
    type: "sleep",
    name: "Sleep / Bedtime",
    description: "Power down and protect your rest.",
    icon: "🌙",
    timed: true,
    colorKey: "sleep",
    checklist: [
      "Screens off",
      "Dim the lights",
      "Set tomorrow's alarm",
      "Wind down with a book or stretch",
    ],
  },
  workout: {
    type: "workout",
    name: "Workout",
    description: "Move your body and log the session.",
    icon: "🏋️",
    timed: true,
    colorKey: "exercise",
    checklist: [
      "Warm up first",
      "Hydrate before and after",
      "Note today's focus (push / pull / cardio)",
      "Cool down and stretch",
    ],
  },
};

/** Stable display order for the rhythms page (follows the arc of a day). */
export const RHYTHM_ORDER: RhythmType[] = [
  "sleep",
  "wakeup",
  "work",
  "winddown",
  "workout",
];

export function isRhythmType(value: unknown): value is RhythmType {
  return (
    typeof value === "string" && RHYTHM_TYPES.includes(value as RhythmType)
  );
}

export function normalizeRhythmType(
  value: string | null | undefined,
): RhythmType | null {
  return isRhythmType(value) ? value : null;
}

export function rhythmDefinition(type: string): RhythmDefinition | null {
  return isRhythmType(type) ? RHYTHM_DEFINITIONS[type] : null;
}

/**
 * The rhythm that best fits the current hour, used for the hub's contextual
 * nudge. Time bands (local hour):
 *   05:00–09:59 → Morning Wake-up
 *   10:00–17:59 → Work Session
 *   18:00–20:59 → Evening Wind-down
 *   21:00–04:59 → Sleep / Bedtime
 * (Workout has no natural time slot, so it's never auto-suggested.)
 */
export function suggestedRhythmForHour(hour: number): RhythmType {
  if (hour >= 5 && hour < 10) return "wakeup";
  if (hour >= 10 && hour < 18) return "work";
  if (hour >= 18 && hour < 21) return "winddown";
  return "sleep";
}

/** Minutes between two instants, clamped at zero, rounded. */
export function rhythmDurationMinutes(startedAt: Date, endedAt: Date): number {
  return Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));
}

/** Human duration for a session, e.g. "1h 12m" or "42m". */
export function formatRhythmDuration(minutes: number | null): string {
  if (minutes === null || minutes <= 0) return "—";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
