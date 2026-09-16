// Decides what (if anything) each push nudge should say for a given user.
//
// A cross-tool orchestrator: it composes service functions only — reflect,
// rhythms, habits and the day plan — and never touches prisma directly. It is
// deliberately separate from the cron route so the decision can be tested
// against a throwaway user without fanning out real pushes to real devices.

import "server-only";
import { dayKey } from "@/lib/reflect";
import { startOfDay } from "@/lib/day-plan";
import {
  buildConfirmNudge,
  buildPlanNudge,
  type NudgeBlock,
  type NudgeSlot,
} from "@/lib/nudge-timing";
import { getReflection } from "@/lib/services/reflect";
import { getTodayWakeStatus } from "@/lib/services/rhythms";
import { listPlannedBlocks } from "@/lib/services/day-plan";
import { listHabits } from "@/lib/services/habits";
import type { PushPayload } from "@/lib/services/push";

function timeLabel(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** At most one habit, chosen from the ones the owner explicitly set a
 *  reminder time on — their own configuration is a better signal than any
 *  ranking we'd invent, and capping at one keeps the daily volume at two. */
export async function pickHabitCue(userId: string): Promise<NudgeBlock | null> {
  try {
    const habits = await listHabits(userId);
    const candidate = habits
      .filter((habit) => habit.dueToday && !habit.completedToday && habit.reminderTime)
      .sort((a, b) => (a.reminderTime ?? "").localeCompare(b.reminderTime ?? ""))[0];
    if (!candidate) return null;
    return { title: candidate.title, timeLabel: candidate.reminderTime ?? "" };
  } catch (error) {
    console.error("[nudges] habit cue failed", { userId }, error);
    return null;
  }
}

/** The payload for one user's nudge, or null when there's nothing worth
 *  saying — a fully-handled day sends nothing at all. */
export async function resolveNudge(
  userId: string,
  slot: NudgeSlot,
  now: Date,
): Promise<PushPayload | null> {
  if (slot === "morning") {
    const [wake, blocks, habitCue] = await Promise.all([
      getTodayWakeStatus(userId),
      listPlannedBlocks(userId, startOfDay(now)),
      pickHabitCue(userId),
    ]);

    return buildConfirmNudge({
      wakeCaptured: wake.captured,
      blocks: blocks
        .slice()
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
        .map((block) => ({
          title: block.title,
          timeLabel: timeLabel(block.startsAt),
        })),
      habitCue,
    });
  }

  const [reflection, tomorrow] = await Promise.all([
    getReflection(userId, dayKey(now)),
    listPlannedBlocks(userId, startOfDay(now, 1)),
  ]);

  return buildPlanNudge({
    reflected: Boolean(reflection),
    plannedTomorrow: tomorrow.length,
  });
}
