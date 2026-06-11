// Read paths: list habits with derived summaries, suggestion ordering, and
// the habit-as-task view consumed by the Do tool.

import "server-only";

import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import {
  type HabitSummary,
  type HabitTaskSummary,
  compareHabitDisplayOrder,
  resolveHabitTaskLane,
  summarizeHabit,
} from "./derive";

export async function listHabits(
  userId: string,
  options: { includeArchived?: boolean } = {},
): Promise<HabitSummary[]> {
  requireCan(userId, "habit", "read");
  const habits = await prisma.habit.findMany({
    where: {
      userId,
      ...(options.includeArchived ? {} : { archivedAt: null }),
    },
    include: {
      entries: true,
      timeEntries: {
        where: { endedAt: { not: null } },
      },
    },
    orderBy: [{ archivedAt: "asc" }, { updatedAt: "desc" }],
  });
  const now = new Date();
  return habits
    .map((habit) => summarizeHabit(habit, now))
    .sort((a, b) => compareHabitDisplayOrder(a, b, now));
}

export async function listSuggestedHabits(
  userId: string,
  options: { limit?: number } = {},
): Promise<HabitSummary[]> {
  const habits = await listHabits(userId);
  return habits
    .filter((habit) => !habit.archivedAt)
    .sort((a, b) => {
      const displayOrder = compareHabitDisplayOrder(a, b, new Date());
      if (displayOrder !== 0) return displayOrder;
      if (a.keptAliveStreak !== b.keptAliveStreak) return b.keptAliveStreak - a.keptAliveStreak;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    })
    .slice(0, options.limit ?? 4);
}

export async function listHabitTaskItems(
  userId: string,
  options: { limit?: number } = {},
): Promise<HabitTaskSummary[]> {
  const habits = await listHabits(userId);
  return habits
    .map((habit) => {
      const taskLane = resolveHabitTaskLane(habit);
      return taskLane ? { ...habit, taskLane } : null;
    })
    .filter((habit): habit is HabitTaskSummary => Boolean(habit))
    .sort((a, b) => {
      if (a.taskLane !== b.taskLane) return a.taskLane === "today" ? -1 : 1;
      if (a.dueToday !== b.dueToday) return a.dueToday ? -1 : 1;
      if ((a.reminderTime ?? "") !== (b.reminderTime ?? "")) {
        return (a.reminderTime ?? "").localeCompare(b.reminderTime ?? "");
      }
      if (a.keptAliveStreak !== b.keptAliveStreak) return b.keptAliveStreak - a.keptAliveStreak;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    })
    .slice(0, options.limit ?? 100);
}
