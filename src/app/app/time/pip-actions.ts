"use server";

// Server actions for the Picture-in-Picture mini-app. Each mutating action
// returns a FRESH PipState so the floating window can re-render itself from
// scratch after a stop/start without the opener having to refetch. All of them
// resolve the active viewer and delegate writes to the service layer.

import { revalidatePath } from "next/cache";
import { resolveActiveUserId } from "@/lib/viewer-context";
import * as timeService from "@/lib/services/time";
import {
  listHabits,
  logHabitProgress,
  markHabitDoneFromTimer,
  startTimerForHabit,
} from "@/lib/services/habits";
import { loadPipState, type PipState } from "../_components/pip-data";

function revalidateAll() {
  revalidatePath("/app");
  revalidatePath("/app/time");
  revalidatePath("/app/habits");
  revalidatePath("/app/do");
  revalidatePath("/app/calendar");
}

/** Read-only refresh — the window's snapshot getter. */
export async function pipState(): Promise<PipState> {
  const userId = await resolveActiveUserId();
  return loadPipState(userId);
}

/** Stop the running timer (auto-logging a linked habit, like the rest of the UI). */
export async function pipStop(): Promise<PipState> {
  const userId = await resolveActiveUserId();
  const habitId = (await timeService.getRunningEntry(userId))?.habitId ?? null;
  await timeService.stopRunning(userId);
  if (habitId) {
    try {
      await markHabitDoneFromTimer(userId, habitId);
    } catch (error) {
      console.error("[pip] habit auto-log on stop failed", error);
    }
  }
  revalidateAll();
  return loadPipState(userId);
}

/** Start a free-form timer in a category (auto-stops any running entry). */
export async function pipStartCategory(
  category: string | null,
  title: string,
): Promise<PipState> {
  const userId = await resolveActiveUserId();
  const label = (title.trim() || "Focus").slice(0, 200);
  await timeService.startEntry(userId, {
    label,
    category: category ?? null,
  });
  revalidateAll();
  return loadPipState(userId);
}

/** Start a habit timer (auto-stops any running entry). */
export async function pipStartHabit(habitId: string): Promise<PipState> {
  const userId = await resolveActiveUserId();
  if (habitId) {
    await startTimerForHabit(userId, habitId);
  }
  revalidateAll();
  return loadPipState(userId);
}

/** One-tap "done" for a habit, without stopping the running timer. */
export async function pipLogHabit(habitId: string): Promise<PipState> {
  const userId = await resolveActiveUserId();
  const habits = await listHabits(userId, { includeArchived: false });
  const habit = habits.find((item) => item.id === habitId);
  if (habit) {
    const remaining =
      habit.cadence === "weekly"
        ? Math.max(1, habit.targetCount - habit.progressThisWeek)
        : Math.max(1, habit.targetCount - habit.progressToday);
    const quantity = habit.goalUnit === "count" ? 1 : remaining;
    await logHabitProgress(userId, habitId, { quantity, notes: null, mode: "full" });
  }
  revalidateAll();
  return loadPipState(userId);
}
