// Decides what (if anything) each push nudge should say for a given user.
//
// A cross-tool orchestrator: it composes service functions only — reflect,
// rhythms, habits and the day plan — and never touches prisma directly. It is
// deliberately separate from the cron route so the decision can be tested
// against a throwaway user without fanning out real pushes to real devices.

import "server-only";
import { dayKey, isRatedReflection } from "@/lib/reflect";
import { startOfDay } from "@/lib/day-plan";
import {
  buildConfirmNudge,
  buildPlanNudge,
  type NudgeBlock,
  type NudgeSlot,
} from "@/lib/nudge-timing";
import { getReflection } from "@/lib/services/reflect";
import { buildCheckInNudge, untrackedMinutes } from "@/lib/confirm-events";
import { loadPendingConfirmations } from "@/lib/event-confirmations";
import { getRunningEntry, listEntriesBetween } from "@/lib/services/time";
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

/**
 * Daytime time check-in (TagTime-style sampling, but about real events):
 * ended calendar events to confirm and long untracked stretches since the
 * day started (wake time, else 9:00). Silent when there's nothing to ask.
 */
async function resolveCheckIn(userId: string, now: Date): Promise<PushPayload | null> {
  const dayStart = startOfDay(now);
  const [wake, pending, entries, running] = await Promise.all([
    getTodayWakeStatus(userId).catch(() => null),
    loadPendingConfirmations(userId, now, { since: dayStart }),
    listEntriesBetween(userId, { from: dayStart, to: now }).catch(() => []),
    getRunningEntry(userId).catch(() => null),
  ]);
  const from = new Date(dayStart);
  const [wakeHour, wakeMinute] = (wake?.wakeTime ?? "").split(":").map(Number);
  if (Number.isFinite(wakeHour) && Number.isFinite(wakeMinute)) {
    from.setHours(wakeHour!, wakeMinute!, 0, 0);
  } else {
    from.setHours(9, 0, 0, 0);
  }
  return buildCheckInNudge({
    pending: pending.length,
    untracked: untrackedMinutes({ entries, from, now }),
    sinceLabel: timeLabel(from),
    longTimer: running
      ? {
          label: running.label,
          hours: Math.floor((now.getTime() - running.startedAt.getTime()) / 3_600_000),
        }
      : null,
  });
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

  if (slot === "midday" || slot === "afternoon") {
    return resolveCheckIn(userId, now);
  }

  const [reflection, tomorrow] = await Promise.all([
    getReflection(userId, dayKey(now)),
    listPlannedBlocks(userId, startOfDay(now, 1)),
  ]);

  return buildPlanNudge({
    reflected: isRatedReflection(reflection),
    plannedTomorrow: tomorrow.length,
  });
}
