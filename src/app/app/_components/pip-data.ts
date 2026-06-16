import "server-only";

// Server-side payload builder for the Picture-in-Picture timer widget. It
// spans two tools (time + habits), so it lives in the app layer and reads
// through the services — never Prisma directly. The global running-timer bar
// uses loadPipWidgetData() to feed a pop-out from any page; the time page
// reuses toPipHabits() with data it already has on hand.

import { listHabits, type HabitSummary } from "@/lib/services/habits";
import { listEntriesBetween } from "@/lib/services/time";
import { startOfToday } from "@/lib/time";
import { categoryColor } from "@/lib/time-categories";
import type { PipHabit } from "@/components/pip-timer-widget";

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

/** Sum of completed entry durations between [from, to). Excludes the running one. */
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

/** Everything the PiP widget needs that isn't the running entry itself. */
export async function loadPipWidgetData(userId: string): Promise<{
  habits: PipHabit[];
  totalMsToday: number;
}> {
  const todayStart = startOfToday();
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [habitList, entries] = await Promise.all([
    listHabits(userId),
    listEntriesBetween(userId, { from: todayStart, to: tomorrow }),
  ]);

  return {
    habits: toPipHabits(habitList),
    totalMsToday: completedMsBetween(entries, todayStart),
  };
}
