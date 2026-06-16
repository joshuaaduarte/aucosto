import "server-only";

// Server-side state for the Picture-in-Picture mini-app. It spans several
// tools (time + habits + calendar), so it lives in the app layer and reads
// through the services — never Prisma directly. `loadPipState` is the single
// snapshot the floating window renders from; the PiP server actions re-call it
// after every stop/start so the window re-renders with fresh data.

import { listHabits, type HabitSummary } from "@/lib/services/habits";
import { getRunningEntry, listEntriesBetween } from "@/lib/services/time";
import { listTimeCategories } from "@/lib/services/time-categories";
import { listCalendarItems } from "@/lib/services/calendar";
import { startOfToday } from "@/lib/time";
import { categoryColor, normalizeCategory } from "@/lib/time-categories";

export type PipHabit = {
  id: string;
  name: string;
  done: boolean;
  streak: number;
  /** Bucket color (categoryColor) — matches the dot color used across the app. */
  color: string;
};

export type PipCategory = {
  id: string;
  name: string;
  color: string;
};

export type PipEvent = {
  id: string;
  title: string;
  /** ISO timestamps; formatted in the widget (browser clock). */
  startTime: string;
  endTime: string;
  type: "block" | "habit" | "task";
};

export type PipRunningEntry = {
  id: string;
  title: string;
  /** Epoch ms — the live clock counts up from it. */
  startedAtMs: number;
  categoryId: string | null;
  categoryColor: string;
  notes: string | null;
  habitId: string | null;
};

export type PipState = {
  runningEntry: PipRunningEntry | null;
  habits: PipHabit[];
  categories: PipCategory[];
  totalMs: number;
  upcomingEvents: PipEvent[];
};

/** Today's due habits, shaped for the widget (most relevant first, capped). */
export function toPipHabits(habits: HabitSummary[]): PipHabit[] {
  return habits
    .filter((habit) => habit.dueToday)
    .slice(0, 8)
    .map((habit) => ({
      id: habit.id,
      name: habit.title,
      done: habit.completedToday || habit.keptAliveToday,
      streak: habit.currentStreak,
      color: categoryColor(habit.bucket ?? "habit"),
    }));
}

/** Sum of completed entry durations from `from` onward (excludes the running one). */
export function completedMsBetween(
  entries: { startedAt: Date; endedAt: Date | null }[],
  from: Date,
): number {
  return entries
    .filter((entry) => entry.endedAt && entry.startedAt >= from)
    .reduce(
      (sum, entry) => sum + (entry.endedAt!.getTime() - entry.startedAt.getTime()),
      0,
    );
}

/** The next few timed calendar items between now and end of day (max 4). */
export async function getUpcomingPipEvents(
  userId: string,
  nowIso: string,
): Promise<PipEvent[]> {
  const now = new Date(nowIso);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const items = await listCalendarItems(userId, { from: now, to: endOfDay });
  return items
    .filter(
      (item) =>
        !item.allDay &&
        item.status !== "done" &&
        item.status !== "cancelled" &&
        item.endsAt > now,
    )
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .slice(0, 4)
    .map((item) => ({
      id: item.id,
      title: item.title,
      startTime: item.startsAt.toISOString(),
      endTime: item.endsAt.toISOString(),
      type:
        item.sourceTool === "habit"
          ? "habit"
          : item.sourceTool === "do"
            ? "task"
            : "block",
    }));
}

/** Everything the PiP window needs to render either screen. */
export async function loadPipState(userId: string): Promise<PipState> {
  const todayStart = startOfToday();
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const now = new Date();

  const [running, habitList, catRecords, entries, upcomingEvents] =
    await Promise.all([
      getRunningEntry(userId),
      listHabits(userId),
      listTimeCategories(userId, { includeHidden: false }),
      listEntriesBetween(userId, { from: todayStart, to: tomorrow }),
      getUpcomingPipEvents(userId, now.toISOString()),
    ]);

  const categories: PipCategory[] = catRecords.map((category) => ({
    id: normalizeCategory(category.name),
    name: category.emoji ? `${category.emoji} ${category.name}` : category.name,
    color: category.color,
  }));

  // Resolve the running entry's category color the same way the time page does:
  // a managed category's custom color wins, else the stable hash/preset.
  const resolveColor = (category: string | null) => {
    const norm = normalizeCategory(category);
    const match = catRecords.find(
      (record) => normalizeCategory(record.name) === norm,
    );
    return match?.color ?? categoryColor(category);
  };

  const runningEntry: PipRunningEntry | null = running
    ? {
        id: running.id,
        title: running.label,
        startedAtMs: running.startedAt.getTime(),
        categoryId: running.category,
        categoryColor: resolveColor(running.category),
        notes: running.notes,
        habitId: running.habitId,
      }
    : null;

  return {
    runningEntry,
    habits: toPipHabits(habitList),
    categories,
    totalMs: completedMsBetween(entries, todayStart),
    upcomingEvents,
  };
}
