// Curated habit templates — one tap to add, no configuration required.
// Pure module: buckets map onto the shared time-category palette so each
// template carries a consistent color through cards, timers, and insights.
// The emoji lives in the title (zero schema change) and follows the habit
// everywhere: cards, timer labels, calendar blocks.

import type { HabitCadence, HabitDayPart, HabitGoalUnit } from "@/lib/habits";

export type HabitTemplate = {
  key: string;
  emoji: string;
  title: string;
  /** One line on why it matters — shown in the template picker. */
  description: string;
  group: "Morning & foundation" | "Fitness" | "Wellness" | "Productivity";
  dayPart: HabitDayPart;
  cadence: HabitCadence;
  goalUnit: HabitGoalUnit;
  targetCount: number;
  defaultDurationMinutes: number | null;
  /** Bucket doubles as the color key (categoryColor). */
  bucket: string;
  fallbackTitle?: string;
};

export const HABIT_TEMPLATES: HabitTemplate[] = [
  // ── Morning & foundation ─────────────────────────────────────────
  {
    key: "morning-light",
    emoji: "🌅",
    title: "Morning light + movement",
    description: "Daylight in your eyes early anchors sleep and energy all day.",
    group: "Morning & foundation",
    dayPart: "morning",
    cadence: "daily",
    goalUnit: "check",
    targetCount: 1,
    defaultDurationMinutes: 10,
    bucket: "exercise",
    fallbackTitle: "Two minutes on the balcony",
  },
  {
    key: "meditate",
    emoji: "🧘",
    title: "Meditate",
    description: "Ten quiet minutes lowers the volume on everything else.",
    group: "Morning & foundation",
    dayPart: "morning",
    cadence: "daily",
    goalUnit: "minutes",
    targetCount: 10,
    defaultDurationMinutes: 10,
    bucket: "rest",
    fallbackTitle: "Three breaths with eyes closed",
  },
  {
    key: "journal",
    emoji: "📓",
    title: "Journal",
    description: "Thoughts on paper stop circling in your head.",
    group: "Morning & foundation",
    dayPart: "morning",
    cadence: "daily",
    goalUnit: "minutes",
    targetCount: 10,
    defaultDurationMinutes: 10,
    bucket: "planning",
    fallbackTitle: "One honest sentence",
  },
  {
    key: "read",
    emoji: "📖",
    title: "Read",
    description: "Twenty-five pages a day is fifty books a year.",
    group: "Morning & foundation",
    dayPart: "anytime",
    cadence: "daily",
    goalUnit: "minutes",
    targetCount: 25,
    defaultDurationMinutes: 25,
    bucket: "reading",
    fallbackTitle: "Read one page",
  },
  {
    key: "prep-tomorrow",
    emoji: "🌙",
    title: "Prep for tomorrow",
    description: "Ten minutes tonight buys a calm start tomorrow.",
    group: "Morning & foundation",
    dayPart: "evening",
    cadence: "daily",
    goalUnit: "check",
    targetCount: 1,
    defaultDurationMinutes: 10,
    bucket: "planning",
    fallbackTitle: "Pick tomorrow's first task",
  },
  // ── Fitness ──────────────────────────────────────────────────────
  {
    key: "workout",
    emoji: "🏋️",
    title: "Work out",
    description: "Strength now is independence later.",
    group: "Fitness",
    dayPart: "anytime",
    cadence: "daily",
    goalUnit: "check",
    targetCount: 1,
    defaultDurationMinutes: 45,
    bucket: "exercise",
    fallbackTitle: "One set of anything",
  },
  {
    key: "run",
    emoji: "🏃",
    title: "Run",
    description: "The run you don't feel like doing works the best.",
    group: "Fitness",
    dayPart: "anytime",
    cadence: "daily",
    goalUnit: "check",
    targetCount: 1,
    defaultDurationMinutes: 30,
    bucket: "exercise",
    fallbackTitle: "Ten-minute jog around the block",
  },
  {
    key: "walk",
    emoji: "🚶",
    title: "Walk",
    description: "The most underrated reset button there is.",
    group: "Fitness",
    dayPart: "anytime",
    cadence: "daily",
    goalUnit: "check",
    targetCount: 1,
    defaultDurationMinutes: 20,
    bucket: "exercise",
    fallbackTitle: "Once around the block",
  },
  // ── Wellness ─────────────────────────────────────────────────────
  {
    key: "water",
    emoji: "💧",
    title: "Water",
    description: "Eight glasses — tap once per glass through the day.",
    group: "Wellness",
    dayPart: "day",
    cadence: "daily",
    goalUnit: "count",
    targetCount: 8,
    defaultDurationMinutes: null,
    bucket: "wellness",
  },
  {
    key: "sleep-8",
    emoji: "😴",
    title: "Sleep 8 hours",
    description: "Log it each morning — did last night hit eight?",
    group: "Wellness",
    dayPart: "morning",
    cadence: "daily",
    goalUnit: "check",
    targetCount: 1,
    defaultDurationMinutes: null,
    bucket: "wellness",
  },
  // ── Productivity ─────────────────────────────────────────────────
  {
    key: "weekly-review",
    emoji: "🗺️",
    title: "Weekly review",
    description: "Thirty minutes that makes the other 10,000 count.",
    group: "Productivity",
    dayPart: "anytime",
    cadence: "weekly",
    goalUnit: "check",
    targetCount: 1,
    defaultDurationMinutes: 30,
    bucket: "planning",
    fallbackTitle: "Scan the calendar for next week",
  },
  {
    key: "deep-work",
    emoji: "🎯",
    title: "Deep work session",
    description: "One protected block of real focus beats a scattered day.",
    group: "Productivity",
    dayPart: "morning",
    cadence: "weekdays",
    goalUnit: "minutes",
    targetCount: 60,
    defaultDurationMinutes: 60,
    bucket: "work",
    fallbackTitle: "25-minute starter block",
  },
  {
    key: "no-phone-hour",
    emoji: "📵",
    title: "No phone first hour",
    description: "Your attention is sharpest before the feed gets it.",
    group: "Productivity",
    dayPart: "morning",
    cadence: "daily",
    goalUnit: "check",
    targetCount: 1,
    defaultDurationMinutes: null,
    bucket: "rest",
  },
];

export const HABIT_TEMPLATE_GROUPS = [
  "Morning & foundation",
  "Fitness",
  "Wellness",
  "Productivity",
] as const;

export function findHabitTemplate(key: string): HabitTemplate | null {
  return HABIT_TEMPLATES.find((template) => template.key === key) ?? null;
}

/** Full display title as stored ("🌅 Morning light + movement"). */
export function templateTitle(template: HabitTemplate): string {
  return `${template.emoji} ${template.title}`;
}

/** Leading emoji of a habit title, if any — used as the card icon. */
export function splitLeadingEmoji(title: string): {
  emoji: string | null;
  rest: string;
} {
  const match = title.match(/^(\p{Extended_Pictographic}(?:️)?)\s+(.*)$/u);
  if (match && match[2]) return { emoji: match[1]!, rest: match[2] };
  return { emoji: null, rest: title };
}
