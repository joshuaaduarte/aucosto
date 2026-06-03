"use client";

import Link from "next/link";
import { formatHabitQuantity, type HabitGoalUnit } from "@/lib/habits";
import type { HabitTaskSummary } from "@/lib/services/habits";
import { quickLogHabitFromDoAction } from "../habits/actions";
import { HabitStartTimerButton } from "../habits/start-timer-button";

export function HabitTaskCard({ habit }: { habit: HabitTaskSummary }) {
  const progress =
    habit.cadence === "weekly" ? habit.progressThisWeek : habit.progressToday;
  const progressLabel = `${formatHabitQuantity(progress, habit.goalUnit as HabitGoalUnit)} / ${formatHabitQuantity(
    habit.targetCount,
    habit.goalUnit as HabitGoalUnit,
  )}`;
  const completeLabel =
    habit.goalUnit === "minutes"
      ? "Log target"
      : habit.goalUnit === "check"
        ? "Done"
        : "Log rest";

  return (
    <li
      className="rounded-md border p-3 sm:p-3.5"
      style={{ borderColor: "var(--border-faint)" }}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p
                className="text-[0.9375rem] font-medium"
                style={{ color: "var(--text)" }}
              >
                {habit.title}
              </p>
              <span className="pill">Habit task</span>
              {habit.bucket ? <span className="pill">{habit.bucket}</span> : null}
              <span className="pill">{habit.cadenceLabel}</span>
              <span className="pill">{habit.targetLabel}</span>
            </div>
            <p
              className="mt-1 text-[0.75rem]"
              style={{ color: "var(--text-faint)" }}
            >
              {habit.cadence === "weekly"
                ? `${progressLabel} this week`
                : `${progressLabel} today`}
              {habit.defaultDurationMinutes
                ? ` · ${habit.defaultDurationMinutes}m default block`
                : ""}
              {habit.reminderTime ? ` · reminder ${habit.reminderTime}` : ""}
              {habit.currentStreak > 0 ? ` · ${habit.currentStreak} streak` : ""}
            </p>
            {habit.notes ? (
              <p
                className="mt-1.5 whitespace-pre-line text-[0.8125rem]"
                style={{ color: "var(--text-muted)" }}
              >
                {habit.notes}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:justify-end">
            <div className="contents sm:block">
              <HabitStartTimerButton id={habit.id} />
            </div>

            <form action={quickLogHabitFromDoAction} className="contents sm:block">
              <input type="hidden" name="id" value={habit.id} />
              <button
                className="btn-ghost h-8 w-full px-2.5 text-[0.75rem]"
                type="submit"
              >
                {completeLabel}
              </button>
            </form>

            <Link
              href="/app/habits"
              className="btn-ghost col-span-2 h-8 w-full px-2.5 text-[0.75rem] sm:col-span-1"
            >
              Open habit
            </Link>
          </div>
        </div>
      </div>
    </li>
  );
}
