"use client";

import { formatHabitQuantity, type HabitGoalUnit } from "@/lib/habits";
import type { HabitSummary } from "@/lib/services/habits";
import { createDoFromHabitAction } from "../actions";
import { detailTone, recentWindowSummary } from "./habit-card-helpers";
import { MetricTile } from "./stat-tiles";

export function HabitDetails({
  habit,
  onSchedule,
}: {
  habit: HabitSummary;
  onSchedule: () => void;
}) {
  const windowSummary = recentWindowSummary(habit);

  return (
    <details className="rounded-[0.95rem] border" style={{ borderColor: "var(--border-faint)" }}>
      <summary className="cursor-pointer list-none px-3 py-2 text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
        View details
      </summary>
      <div className="space-y-4 px-3 pb-3">
        <div className="grid gap-1.5 sm:hidden">
          <button type="button" className="btn-ghost h-8 w-full px-2.5 text-[0.75rem]" onClick={onSchedule}>
            Schedule
          </button>
          <form action={createDoFromHabitAction}>
            <input type="hidden" name="habitId" value={habit.id} />
            <input type="hidden" name="title" value={habit.title} />
            <input type="hidden" name="bucket" value={habit.bucket ?? ""} />
            <input type="hidden" name="estimatedMinutes" value={habit.defaultDurationMinutes ?? ""} />
            <button className="btn-ghost h-8 w-full px-2.5 text-[0.75rem]" type="submit">
              Add task to Do List
            </button>
          </form>
        </div>

        {habit.notes || habit.fallbackTitle || habit.rescuePrompt ? (
          <div className="rounded-[0.85rem] border p-3" style={{ borderColor: "var(--border-faint)", background: "var(--bg-tint)" }}>
            {habit.notes ? (
              <p className="whitespace-pre-line text-[0.8125rem] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {habit.notes}
              </p>
            ) : null}
            {(habit.fallbackTitle || habit.rescuePrompt) ? (
              <p className="mt-2 text-[0.75rem] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {habit.fallbackTitle ? `Fallback: ${habit.fallbackTitle}` : ""}
                {habit.fallbackTitle && habit.rescuePrompt ? " • " : ""}
                {habit.rescuePrompt ?? ""}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <MetricTile label="30-day hit rate" value={`${habit.completionRate30d}%`} />
          <MetricTile label="30-day saved" value={`${habit.keptAliveRate30d}%`} />
          <MetricTile label="Misses lately" value={`${windowSummary.missCount}`} />
        </div>

        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
            Last 14 days
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {habit.recentDays.map((day) => {
              const toneForDay = detailTone(day.completed, day.due, day.keptAlive);
              return (
                <div
                  key={day.dateKey}
                  className="rounded-[0.8rem] border px-2.5 py-2"
                  style={{
                    borderColor: toneForDay.borderColor,
                    background: toneForDay.background,
                    color: toneForDay.color,
                  }}
                >
                  <p className="text-[0.625rem] font-semibold uppercase tracking-wider">{day.label}</p>
                  <p className="mt-1 text-[0.75rem] font-medium">{day.completed ? "Hit" : day.keptAlive ? "Saved" : day.due ? "Missed" : "Off"}</p>
                  <p className="mt-0.5 text-[0.6875rem] opacity-80">
                    {day.due ? formatHabitQuantity(day.progress, habit.goalUnit as HabitGoalUnit) : "Not due"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </details>
  );
}
