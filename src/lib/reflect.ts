// Pure helpers for the daily reflection tool — rating scales, mood palette,
// local day keys, and the context-snapshot shape. No DB access; importable
// from client and server. Tested in tests/reflect.test.ts.

export type ReflectionRatingField =
  | "mood"
  | "energyLevel"
  | "productivityRating"
  | "dayRating";

export type RatingStep = {
  value: 1 | 2 | 3 | 4 | 5;
  emoji: string;
  label: string;
  color: string;
};

/** Emoji-anchored 1–5 mood scale; colors run red → emerald. */
export const MOOD_SCALE: RatingStep[] = [
  { value: 1, emoji: "😞", label: "Rough", color: "#ef4444" },
  { value: 2, emoji: "😐", label: "Meh", color: "#f97316" },
  { value: 3, emoji: "🙂", label: "Fine", color: "#eab308" },
  { value: 4, emoji: "😀", label: "Good", color: "#84cc16" },
  { value: 5, emoji: "🤩", label: "Great", color: "#10b981" },
];

export const RATING_FIELDS: Array<{
  field: ReflectionRatingField;
  label: string;
  question: string;
}> = [
  { field: "mood", label: "Mood", question: "How did the day feel?" },
  { field: "energyLevel", label: "Energy", question: "How was your energy?" },
  {
    field: "productivityRating",
    label: "Productivity",
    question: "How productive were you?",
  },
  { field: "dayRating", label: "Overall", question: "Rate the day overall." },
];

export function moodColor(value: number): string {
  return MOOD_SCALE.find((step) => step.value === value)?.color ?? "#9ca3af";
}

export function moodEmoji(value: number): string {
  return MOOD_SCALE.find((step) => step.value === value)?.emoji ?? "·";
}

/** Local-day key (YYYY-MM-DD) — the server runtime is pinned to the owner's
    timezone, so this is stable across server and browser. */
export function dayKey(date: Date): string {
  return date.toLocaleDateString("en-CA");
}

/** A natural inline phrase for the day a reflection targets, relative to
 *  `todayKey`: "today" | "yesterday" | "that day". Reads correctly both as a
 *  question ("How did {label} feel?") and a possessive ("{label}'s
 *  reflection"). The page header already shows the full date, so older days
 *  collapse to "that day" rather than an awkward "on Jun 12" mid-sentence.
 *  `todayKey` is passed in (not derived from `new Date()`) so callers stay
 *  pure and the result agrees with their own day math. */
export function reflectionDayLabel(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return "today";
  const [year, month, day] = todayKey.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return "that day";
  }
  // day - 1 rolls back across month/year boundaries via the Date constructor.
  const yesterdayKey = dayKey(new Date(year, month - 1, day - 1));
  if (dateKey === yesterdayKey) return "yesterday";
  return "that day";
}

export function isValidRating(value: number): value is 1 | 2 | 3 | 4 | 5 {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

export type ReflectionEntryNote = {
  label: string;
  note: string;
};

/** Auto-captured at save time — a freeze-frame of the day. */
export type ReflectionContextSnapshot = {
  trackedMinutes: number;
  entryCount: number;
  tasksCompleted: number;
  habitsDue: number;
  habitsHit: number;
  entryNotes: ReflectionEntryNote[];
};

export function summarizeSnapshot(snapshot: ReflectionContextSnapshot): string {
  const hours = Math.floor(snapshot.trackedMinutes / 60);
  const minutes = snapshot.trackedMinutes % 60;
  const tracked =
    snapshot.trackedMinutes === 0
      ? "nothing tracked"
      : hours > 0
        ? `${hours}h ${minutes}m tracked`
        : `${minutes}m tracked`;
  const parts = [
    `${tracked} across ${snapshot.entryCount} ${snapshot.entryCount === 1 ? "entry" : "entries"}`,
    `${snapshot.tasksCompleted} ${snapshot.tasksCompleted === 1 ? "task" : "tasks"} completed`,
  ];
  if (snapshot.habitsDue > 0) {
    parts.push(`${snapshot.habitsHit}/${snapshot.habitsDue} habits logged`);
  }
  return parts.join(" · ");
}
