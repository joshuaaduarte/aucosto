import { daysUntil, formatUSDFromCents } from "@/lib/money";
import { parseHabitDays } from "@/lib/habits";
import { UNCATEGORIZED_COLOR, categoryColor } from "@/lib/time-categories";
import type { DoItemSummary } from "@/lib/services/do";
import type { HabitGhostInput } from "./timeline";
import type {
  CalendarItem,
  FinanceAccount,
  TimeEntry,
} from "@/generated/prisma/client";

export type CalendarSignal = {
  title: string;
  detail: string;
  tone: "sky" | "amber" | "emerald" | "zinc";
};

export type CalendarTodayBuckets = {
  now: CalendarItem[];
  next: CalendarItem[];
  later: CalendarItem[];
  needsAttention: CalendarItem[];
};

export type CalendarGapSuggestion = {
  taskId: string;
  title: string;
  estimateMinutes: number | null;
  gapStart: Date;
  gapEnd: Date;
  gapMinutes: number;
  fit: "tight" | "comfortable";
  reason: string;
};

function scoreTaskForGap(task: DoItemSummary, gapMinutes: number, now: Date) {
  const estimate = task.estimatedMinutes ?? 30;
  const fitPenalty = Math.abs(gapMinutes - estimate);
  let score = 0;

  switch (task.lane) {
    case "today":
      score += 36;
      break;
    case "next":
      score += 20;
      break;
    case "later":
      score += 10;
      break;
    case "someday":
      score += 4;
      break;
  }

  switch (task.status) {
    case "in_progress":
      score += 18;
      break;
    case "ready":
      score += 12;
      break;
    case "scheduled":
      score += 6;
      break;
    case "waiting":
      score -= 100;
      break;
    case "done":
      score -= 100;
      break;
  }

  if (task.scheduledMinutes === 0 && task.lane === "today") {
    score += 10;
  }

  if (task.trackedMinutes > 0) {
    score += Math.min(12, Math.round(task.trackedMinutes / 15) * 2);
  }

  const anchor = task.lastWorkedAt ?? task.updatedAt ?? task.createdAt;
  const staleHours = Math.max(
    0,
    Math.round((now.getTime() - anchor.getTime()) / (60 * 60 * 1000)),
  );
  score += Math.min(10, Math.floor(staleHours / 12) * 2);
  score += Math.max(0, 16 - Math.min(16, fitPenalty));

  return score;
}

function describeGapReason(task: DoItemSummary, gapMinutes: number) {
  const estimate = task.estimatedMinutes ?? 30;

  if (task.status === "in_progress") {
    return "Already in motion, so it is easier to resume.";
  }
  if (task.lane === "today" && task.scheduledMinutes === 0) {
    return "Today task still needs protected time.";
  }
  if (Math.abs(gapMinutes - estimate) <= 10) {
    return "Estimate fits this opening closely.";
  }
  if (task.trackedMinutes > 0) {
    return "You already put time into it, so momentum is real.";
  }
  return "Fits the gap without blowing up the rest of the day.";
}

export function startOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

export function endOfDay(date: Date): Date {
  const value = startOfDay(date);
  value.setDate(value.getDate() + 1);
  return value;
}

export function startOfCalendarWeek(date: Date = new Date()): Date {
  const value = startOfDay(date);
  const day = value.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  value.setDate(value.getDate() + diff);
  return value;
}

export function addDays(date: Date, days: number): Date {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

export function buildWeekDays(anchor: Date = new Date()) {
  const start = startOfCalendarWeek(anchor);
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, index);
    return {
      key: date.toISOString(),
      date,
      label: date.toLocaleDateString([], { weekday: "short" }),
      monthDay: date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
      }),
    };
  });
}

export function itemTone(kind: string, status: string) {
  if (status === "done") return "var(--text-faint)";
  if (kind === "suggestion") return "var(--accent)";
  if (kind === "external") return "var(--text-faint)";
  return "var(--text)";
}

/**
 * Unified color for a calendar item, drawn from the time-category palette so
 * the calendar, timeline, and time tool speak one color language: blocks
 * sourced from a task use the "do" color, habit blocks the "habit" color,
 * native blocks the "calendar" color. Done/external items stay muted.
 */
export function calendarItemColor(
  item: Pick<CalendarItem, "kind" | "status" | "sourceTool">,
): string {
  if (item.status === "done") return "var(--text-faint)";
  if (item.kind === "external") return UNCATEGORIZED_COLOR;
  if (item.sourceTool === "do") return categoryColor("do");
  if (item.sourceTool === "habit") return categoryColor("habit");
  if (item.sourceTool === "work") return categoryColor("work");
  return categoryColor("calendar");
}

export function formatDateValue(date: Date) {
  return date.toLocaleDateString("en-CA");
}

export function formatTimeValue(date: Date) {
  return date.toLocaleTimeString("en-CA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatShortTime(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function groupForDay(items: CalendarItem[], day: Date) {
  return items.filter((item) => isSameDay(item.startsAt, day));
}

export function isSameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function formatCalendarTimeRange(
  item: Pick<CalendarItem, "startsAt" | "endsAt" | "allDay">,
): string {
  if (item.allDay) return "All day";
  const start = item.startsAt.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const end = item.endsAt.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${start}-${end}`;
}

export function deriveTodayBuckets(
  items: CalendarItem[],
  now: Date = new Date(),
): CalendarTodayBuckets {
  const sorted = [...items].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  );
  const currentTime = now.getTime();

  const active = sorted.filter((item) => {
    if (item.status === "done" || item.status === "cancelled") return false;
    return (
      item.startsAt.getTime() <= currentTime && item.endsAt.getTime() > currentTime
    );
  });

  const needsAttention = sorted.filter((item) => {
    if (item.status === "done" || item.status === "cancelled") return false;
    return item.endsAt.getTime() <= currentTime;
  });

  const upcoming = sorted.filter((item) => {
    if (item.status === "done" || item.status === "cancelled") return false;
    return item.startsAt.getTime() > currentTime;
  });

  return {
    now: active,
    next: upcoming.slice(0, 1),
    later: upcoming.slice(1),
    needsAttention,
  };
}

export function deriveCalendarSignals(input: {
  todayItems: CalendarItem[];
  runningEntry: Pick<TimeEntry, "label" | "startedAt"> | null;
  weekTotalMs: number;
  accounts: FinanceAccount[];
}): CalendarSignal[] {
  const signals: CalendarSignal[] = [];
  const actionableCount = input.todayItems.filter(
    (item) => item.kind !== "external",
  ).length;

  if (input.runningEntry) {
    signals.push({
      title: "Timer is already live",
      detail: `${input.runningEntry.label} is in motion. Protect the rest of that block.`,
      tone: "sky",
    });
  }

  if (actionableCount === 0) {
    signals.push({
      title: "No intentional blocks yet",
      detail: "Claim one block for the work that would make today feel real.",
      tone: "amber",
    });
  } else {
    signals.push({
      title: `${actionableCount} planned block${actionableCount === 1 ? "" : "s"} today`,
      detail:
        "Your calendar already has at least one intentional commitment in it.",
      tone: "emerald",
    });
  }

  const dueSoon = input.accounts
    .filter((account) => account.kind === "credit_card" && account.dueDate)
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())[0];
  if (dueSoon?.dueDate) {
    const days = daysUntil(dueSoon.dueDate);
    if (days >= 0 && days <= 7) {
      signals.push({
        title: `${dueSoon.name} due in ${days} day${days === 1 ? "" : "s"}`,
        detail: `Worth blocking 15 minutes to review ${formatUSDFromCents(
          Math.abs(
            dueSoon.statementBalanceCents ?? dueSoon.currentBalanceCents,
          ),
        )}.`,
        tone: days <= 3 ? "amber" : "zinc",
      });
    }
  }

  if (input.weekTotalMs < 2 * 60 * 60 * 1000) {
    signals.push({
      title: "Week is still light on tracked work",
      detail:
        "A focused block on the calendar would make the rest of the week easier to defend.",
      tone: "zinc",
    });
  }

  return signals.slice(0, 4);
}

export function deriveGapSuggestions(input: {
  now?: Date;
  todayItems: CalendarItem[];
  suggestedTasks: DoItemSummary[];
  limit?: number;
}): CalendarGapSuggestion[] {
  const now = input.now ?? new Date();
  const dayEnd = endOfDay(now);
  const sorted = [...input.todayItems]
    .filter((item) => item.status !== "cancelled")
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const gaps: Array<{ start: Date; end: Date; minutes: number }> = [];
  let cursor = new Date(now);

  for (const item of sorted) {
    if (item.endsAt <= now) continue;
    const gapStart = new Date(cursor);
    const gapEnd = item.startsAt > now ? item.startsAt : now;
    const gapMinutes = Math.max(
      0,
      Math.round((gapEnd.getTime() - gapStart.getTime()) / 60000),
    );
    if (gapMinutes >= 20) {
      gaps.push({ start: gapStart, end: gapEnd, minutes: gapMinutes });
    }
    if (item.endsAt > cursor) {
      cursor = new Date(item.endsAt);
    }
  }

  if (cursor < dayEnd) {
    const gapMinutes = Math.max(
      0,
      Math.round((dayEnd.getTime() - cursor.getTime()) / 60000),
    );
    if (gapMinutes >= 20) {
      gaps.push({ start: new Date(cursor), end: dayEnd, minutes: gapMinutes });
    }
  }

  const suggestions: CalendarGapSuggestion[] = [];
  const usedTaskIds = new Set<string>();
  for (const gap of gaps) {
    const candidate = input.suggestedTasks
      .filter((task) => {
        const estimate = task.estimatedMinutes ?? 30;
        return (
          !usedTaskIds.has(task.id) &&
          task.status !== "waiting" &&
          task.status !== "done" &&
          estimate <= gap.minutes
        );
      })
      .sort(
        (a, b) => scoreTaskForGap(b, gap.minutes, now) - scoreTaskForGap(a, gap.minutes, now),
      )[0];

    if (!candidate) continue;

    const estimate = candidate.estimatedMinutes;
    usedTaskIds.add(candidate.id);
    suggestions.push({
      taskId: candidate.id,
      title: candidate.title,
      estimateMinutes: estimate,
      gapStart: gap.start,
      gapEnd: gap.end,
      gapMinutes: gap.minutes,
      fit:
        estimate && gap.minutes - estimate <= 15 ? "tight" : "comfortable",
      reason: describeGapReason(candidate, gap.minutes),
    });
  }

  return suggestions.slice(0, input.limit ?? 3);
}

// ── Habit ghost blocks ────────────────────────────────────────────────────

const DEFAULT_HABIT_GHOST_MINUTES = 30;

/** Minimal habit shape needed to project a reminder onto a day. */
type HabitGhostSource = {
  id: string;
  title: string;
  bucket: string | null;
  cadence: string;
  daysOfWeek: string | null;
  reminderTime: string | null;
  defaultDurationMinutes: number | null;
  windowStart: string | null;
  windowEnd: string | null;
  archivedAt: Date | null;
};

function parseReminderMinutes(reminderTime: string | null): number | null {
  if (!reminderTime) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(reminderTime.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Whether a habit's schedule lands on the given weekday (0=Sun…6=Sat).
 * Explicit `daysOfWeek` wins; otherwise fall back to the cadence. Weekly and
 * day-less custom habits have no fixed slot, so they don't ghost.
 */
function habitOccursOnWeekday(habit: HabitGhostSource, weekday: number): boolean {
  const days = parseHabitDays(habit.daysOfWeek);
  if (days.length > 0) return days.includes(weekday);
  switch (habit.cadence) {
    case "daily":
      return true;
    case "weekdays":
      return weekday >= 1 && weekday <= 5;
    default:
      return false;
  }
}

/**
 * Project the active habits with a reminder time onto a single day, returning
 * the ghost templates due that day. Pure — the timeline positions them.
 */
export function habitGhostsForDay(
  habits: HabitGhostSource[],
  day: Date,
): HabitGhostInput[] {
  const weekday = day.getDay();
  const ghosts: HabitGhostInput[] = [];
  for (const habit of habits) {
    if (habit.archivedAt) continue;
    const reminderMinutes = parseReminderMinutes(habit.reminderTime);
    if (reminderMinutes === null) continue;
    if (!habitOccursOnWeekday(habit, weekday)) continue;

    // A band is drawn only when an explicit, well-formed window is set
    // (start before end). Habits with no window keep the bare ghost block.
    const windowStartMinutes = parseReminderMinutes(habit.windowStart);
    const windowEndMinutes = parseReminderMinutes(habit.windowEnd);
    const hasWindow =
      windowStartMinutes !== null &&
      windowEndMinutes !== null &&
      windowEndMinutes > windowStartMinutes;

    ghosts.push({
      id: habit.id,
      title: habit.title,
      category: habit.bucket && habit.bucket.trim() ? habit.bucket : "habit",
      reminderMinutes,
      durationMinutes:
        habit.defaultDurationMinutes && habit.defaultDurationMinutes > 0
          ? habit.defaultDurationMinutes
          : DEFAULT_HABIT_GHOST_MINUTES,
      windowStartMinutes: hasWindow ? windowStartMinutes : null,
      windowEndMinutes: hasWindow ? windowEndMinutes : null,
    });
  }
  return ghosts;
}
