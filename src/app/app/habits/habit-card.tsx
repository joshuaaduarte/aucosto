"use client";

// Compact habit card: one-tap logging is the whole point.
//   check   → ✓ Done (instant, with a pop animation)
//   count   → +1 tap counter (water-style), shows today's count
//   minutes → Start timer as the primary path; custom log in details
// Streak is the hero number. Tapping the card opens the detail modal
// (history, stats, schedule, edit, archive).

import { useState, useTransition } from "react";
import { categoryColor } from "@/lib/time-categories";
import { splitLeadingEmoji } from "@/lib/habit-templates";
import { formatHabitQuantity, type HabitGoalUnit } from "@/lib/habits";
import type { HabitSummary } from "@/lib/services/habits";
import {
  quickLogHabitAction,
  salvageHabitAction,
  startHabitTimerAction,
} from "./actions";
import { HabitDetailModal } from "./_components/habit-detail-modal";
import { LogProgressModal } from "./_components/log-progress-modal";

// Done-today chip: still tappable — opens the detail modal so a finished
// habit can be edited (add more) or undone, not locked away for the day.
export function DoneHabitChip({ habit }: { habit: HabitSummary }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const { emoji, rest } = splitLeadingEmoji(habit.title);
  return (
    <>
      <button
        type="button"
        onClick={() => setDetailOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] font-medium transition-colors hover:bg-bg-hover"
        style={{ background: "var(--bg-tint)", color: "var(--text-muted)" }}
        title="Tap to view, edit, or undo today's log"
      >
        {emoji ? `${emoji} ` : ""}
        {rest} ✓
      </button>
      {detailOpen ? (
        <HabitDetailModal habit={habit} onClose={() => setDetailOpen(false)} />
      ) : null}
    </>
  );
}

export function HabitCard({ habit }: { habit: HabitSummary }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [logPending, startLogTransition] = useTransition();
  const [timerPending, startTimerTransition] = useTransition();
  const { emoji, rest } = splitLeadingEmoji(habit.title);
  const color = categoryColor(habit.bucket ?? "habit");
  const goalUnit = habit.goalUnit as HabitGoalUnit;
  const isWeekly = habit.cadence === "weekly";
  const progress = isWeekly ? habit.progressThisWeek : habit.progressToday;
  const done = isWeekly ? habit.completedThisWeek : habit.completedToday;
  const last7 = habit.recentDays.slice(-7);
  const streak = Math.max(habit.currentStreak, habit.keptAliveStreak);

  const quickLog = (quantity?: number) => {
    if (logPending) return;
    startLogTransition(async () => {
      const formData = new FormData();
      formData.set("id", habit.id);
      if (quantity) formData.set("quantity", String(quantity));
      await quickLogHabitAction(formData);
    });
  };

  return (
    <>
      <li
        className="rounded-[0.9rem] border p-3 sm:px-4"
        style={{
          borderColor: "var(--border-faint)",
          background: "var(--bg-page)",
          borderLeft: `3px solid ${color}`,
          opacity: habit.archivedAt ? 0.6 : 1,
        }}
      >
        {/* Header: identity left, streak hero right — whole row opens details. */}
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="flex w-full items-center gap-2.5 text-left"
        >
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[1.1rem]"
            style={{ background: `color-mix(in srgb, ${color} 16%, var(--bg-page))` }}
            aria-hidden
          >
            {emoji ?? "•"}
          </span>
          <span className="min-w-0 flex-1">
            <span
              className="block truncate text-[0.95rem] font-semibold tracking-tight"
              style={{ color: "var(--text)" }}
            >
              {rest}
            </span>
            <span className="mt-0.5 block text-[0.7rem]" style={{ color: "var(--text-faint)" }}>
              {habit.dayPartLabel}
              {habit.cadence !== "daily" ? ` · ${habit.cadenceLabel}` : ""}
              {goalUnit !== "check"
                ? ` · ${formatHabitQuantity(habit.targetCount, goalUnit)} target`
                : ""}
            </span>
          </span>
          <span className="shrink-0 text-right" title="Current streak (longest run kept alive)">
            <span
              className="block text-[1.45rem] font-bold leading-none tracking-tight tabular"
              style={{ color: streak > 0 ? "var(--text)" : "var(--text-faint)" }}
            >
              {streak > 1 ? "🔥 " : ""}
              {streak}
            </span>
            <span className="text-[0.6rem] font-medium uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
              day streak
            </span>
          </span>
        </button>

        {/* Consistency + last-7 rhythm */}
        <div className="mt-2.5 flex items-center gap-2.5">
          <div className="h-[4px] min-w-0 flex-1 rounded-full" style={{ background: "var(--bg-tint-strong)" }}>
            <div
              className="h-[4px] rounded-full transition-all"
              style={{
                width: `${Math.min(100, Math.max(2, Math.round(habit.completionRate30d)))}%`,
                background: color,
              }}
            />
          </div>
          <span className="tabular shrink-0 text-[0.65rem]" style={{ color: "var(--text-faint)" }}>
            {Math.min(100, Math.round(habit.completionRate30d))}% · 30d
          </span>
          <span className="flex shrink-0 items-center gap-1" aria-hidden>
            {last7.map((day) => (
              <span
                key={day.dateKey}
                title={`${day.dateKey}: ${day.completed ? "hit" : day.keptAlive ? "saved" : day.due ? "missed" : "off"}`}
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: day.completed
                    ? color
                    : day.keptAlive
                      ? "var(--accent)"
                      : day.due
                        ? "var(--bg-tint-strong)"
                        : "transparent",
                  border: day.due || day.completed || day.keptAlive ? "none" : "1px solid var(--border-faint)",
                }}
              />
            ))}
          </span>
        </div>

        {/* One-tap actions */}
        {!habit.archivedAt ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {done ? (
              <span
                key={`done-${progress}`}
                className="habit-pop inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.78rem] font-semibold"
                style={{
                  background: `color-mix(in srgb, ${color} 18%, var(--bg-page))`,
                  color: "var(--text)",
                }}
              >
                ✓ {isWeekly ? "Done this week" : "Done today"}
                {goalUnit !== "check"
                  ? ` · ${formatHabitQuantity(progress, goalUnit)}`
                  : ""}
              </span>
            ) : goalUnit === "count" ? (
              <>
                {/* Big targets (steps) get a bulk-entry modal — tapping
                    +1 ten thousand times is nobody's habit. */}
                {habit.targetCount > 20 ? (
                  <button
                    type="button"
                    onClick={() => setLogOpen(true)}
                    className="btn-ink h-9 rounded-full px-4 text-[0.8125rem]"
                  >
                    Log {emoji ?? ""}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={logPending}
                    onClick={() => quickLog(1)}
                    className="btn-ink h-9 rounded-full px-4 text-[0.8125rem]"
                  >
                    {logPending ? "…" : `+1 ${emoji ?? ""}`.trim()}
                  </button>
                )}
                <span
                  key={`count-${progress}`}
                  className="habit-pop tabular text-[0.85rem] font-semibold"
                  style={{ color: "var(--text)" }}
                >
                  {progress.toLocaleString()}/{habit.targetCount.toLocaleString()}
                </span>
              </>
            ) : goalUnit === "minutes" ? (
              <>
                <button
                  type="button"
                  disabled={timerPending}
                  onClick={() =>
                    startTimerTransition(async () => {
                      const formData = new FormData();
                      formData.set("id", habit.id);
                      await startHabitTimerAction(formData);
                    })
                  }
                  className="btn-ink h-9 rounded-full px-4 text-[0.8125rem]"
                >
                  {timerPending
                    ? "Starting…"
                    : `▶ Start ${habit.defaultDurationMinutes ?? habit.targetCount}m timer`}
                </button>
                {progress > 0 ? (
                  <span className="tabular text-[0.78rem]" style={{ color: "var(--text-muted)" }}>
                    {formatHabitQuantity(progress, goalUnit)} so far
                  </span>
                ) : null}
              </>
            ) : (
              <button
                type="button"
                disabled={logPending}
                onClick={() => quickLog()}
                className="btn-ink h-9 rounded-full px-4 text-[0.8125rem]"
              >
                {logPending ? "✓ …" : "✓ Done"}
              </button>
            )}

            {habit.needsSaveToday && habit.salvageLabel ? (
              <form action={salvageHabitAction} className="contents">
                <input type="hidden" name="id" value={habit.id} />
                <input type="hidden" name="mode" value={habit.fallbackTitle ? "fallback" : "recovery"} />
                <input
                  type="hidden"
                  name="notes"
                  value={habit.fallbackTitle ?? habit.rescuePrompt ?? "Recovery logged."}
                />
                <button
                  className="btn-ghost h-9 rounded-full px-3 text-[0.75rem]"
                  style={{ color: "var(--accent-strong)" }}
                  type="submit"
                  title="Smallest good move — keeps the streak alive"
                >
                  Save: {habit.fallbackTitle ?? "recovery"}
                </button>
              </form>
            ) : null}

            <button
              type="button"
              onClick={() => setDetailOpen(true)}
              className="btn-ghost ml-auto h-9 px-2.5 text-[0.75rem]"
            >
              Details
            </button>
          </div>
        ) : (
          <div className="mt-2.5 flex justify-end">
            <button
              type="button"
              onClick={() => setDetailOpen(true)}
              className="btn-ghost h-8 px-2.5 text-[0.75rem]"
            >
              Restore or delete
            </button>
          </div>
        )}
      </li>

      {detailOpen ? <HabitDetailModal habit={habit} onClose={() => setDetailOpen(false)} /> : null}
      {logOpen ? <LogProgressModal habit={habit} onClose={() => setLogOpen(false)} /> : null}
    </>
  );
}
