"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createDoItem, listDoItems, updateDoItem } from "@/lib/services/do";
import { listHabits, logHabitProgress } from "@/lib/services/habits";
import { recordSavedReview } from "@/lib/services/review";
import { requireViewerContext } from "@/lib/viewer-context";
import {
  PRIORITY_LIMIT,
  REVIEW_NOTE_LIMIT,
  cleanPriorityIds,
  findWeeklyReviewHabit,
  reviewWeekFor,
  weekKey,
} from "@/lib/weekly-review";

const SaveReviewInput = z.object({
  priorityIds: z.array(z.string().min(1).max(64)).max(PRIORITY_LIMIT),
  newTitles: z.array(z.string().trim().min(1).max(200)).max(PRIORITY_LIMIT),
  note: z.string().max(REVIEW_NOTE_LIMIT).optional(),
});

export type SaveReviewResult =
  | { ok: true; priorityCount: number; habitLogged: boolean }
  | { ok: false; error: string };

/**
 * Save the weekly review: the picked tasks move to the Do List's Today lane
 * (new titles become tasks there), the "Weekly review" habit is ticked if
 * there is one and it is not done yet, and the review itself is recorded.
 */
export async function saveWeeklyReview(input: unknown): Promise<SaveReviewResult> {
  const parsed = SaveReviewInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick up to three priorities." };

  try {
    const context = await requireViewerContext();
    if (context.role !== "owner") return { ok: false, error: "The weekly review is the owner's." };
    const userId = context.effectiveUserId;
    const now = new Date();
    const week = reviewWeekFor(now);

    const openTasks = await listDoItems(userId, { includeDone: false });
    const openIds = new Set(openTasks.map((task) => task.id));
    const pickedIds = cleanPriorityIds(parsed.data.priorityIds, openIds);
    const room = PRIORITY_LIMIT - pickedIds.length;
    const newTitles = [...new Set(parsed.data.newTitles)].slice(0, Math.max(0, room));

    const priorities: Array<{ id: string; title: string }> = [];
    for (const id of pickedIds) {
      const task = openTasks.find((item) => item.id === id)!;
      if (task.lane !== "today") await updateDoItem(userId, id, { lane: "today" });
      priorities.push({ id, title: task.title });
    }
    for (const title of newTitles) {
      const task = await createDoItem(userId, { title, lane: "today" });
      priorities.push({ id: task.id, title: task.title });
    }

    let habitLogged = false;
    const habit = findWeeklyReviewHabit(await listHabits(userId));
    if (habit) {
      const done = habit.cadence === "weekly" ? habit.completedThisWeek : habit.completedToday;
      if (!done) {
        await logHabitProgress(userId, habit.id, { quantity: habit.targetCount });
        habitLogged = true;
      }
    }

    await recordSavedReview(userId, {
      reviewedWeek: weekKey(week.start),
      forWeek: weekKey(week.end),
      priorities,
      note: parsed.data.note?.trim() || null,
    });

    revalidatePath("/app");
    revalidatePath("/app/review");
    revalidatePath("/app/do");
    if (habitLogged) revalidatePath("/app/habits");
    return { ok: true, priorityCount: priorities.length, habitLogged };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save the review.",
    };
  }
}
