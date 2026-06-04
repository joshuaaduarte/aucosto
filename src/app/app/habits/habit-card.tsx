"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  HABIT_CADENCE_LABELS,
  HABIT_CADENCES,
  HABIT_DAY_PART_LABELS,
  HABIT_DAY_PARTS,
  HABIT_GOAL_UNIT_LABELS,
  HABIT_GOAL_UNITS,
  HABIT_WEEKDAY_OPTIONS,
  formatHabitQuantity,
  parseHabitDays,
  type HabitDayPart,
  type HabitGoalUnit,
} from "@/lib/habits";
import type { HabitSummary } from "@/lib/services/habits";
import {
  archiveHabitAction,
  createDoFromHabitAction,
  deleteHabitAction,
  type HabitLogState,
  type HabitScheduleState,
  logHabitAction,
  salvageHabitAction,
  scheduleHabitAction,
  updateHabitAction,
} from "./actions";
import { HabitStartTimerButton } from "./start-timer-button";

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function periodLabel(habit: HabitSummary) {
  return habit.cadence === "weekly" ? "this week" : "today";
}

function progressValue(habit: HabitSummary) {
  return habit.cadence === "weekly" ? habit.progressThisWeek : habit.progressToday;
}

function progressRatio(habit: HabitSummary) {
  return clampPercent((progressValue(habit) / Math.max(1, habit.targetCount)) * 100);
}

function recentWindowSummary(habit: HabitSummary) {
  const dueDays = habit.recentDays.filter((day) => day.due);
  const hitDays = dueDays.filter((day) => day.completed);
  return {
    dueCount: dueDays.length,
    hitCount: hitDays.length,
    missCount: Math.max(0, dueDays.length - dueDays.filter((day) => day.keptAlive).length),
  };
}

function detailTone(completed: boolean, due: boolean, keptAlive = false) {
  if (completed) {
    return {
      background: "var(--text)",
      color: "var(--bg-page)",
      borderColor: "var(--text)",
    };
  }

  if (keptAlive) {
    return {
      background: "var(--bg-tint)",
      color: "var(--text)",
      borderColor: "var(--text)",
    };
  }

  if (due) {
    return {
      background: "var(--accent-tint)",
      color: "var(--text)",
      borderColor: "var(--border-faint)",
    };
  }

  return {
    background: "var(--bg-tint)",
    color: "var(--text-faint)",
    borderColor: "var(--border-faint)",
  };
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[0.85rem] border px-3 py-2.5" style={{ borderColor: "var(--border-faint)", background: "var(--bg-page)" }}>
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
        {label}
      </p>
      <p className="mt-1 text-[0.875rem] font-medium" style={{ color: "var(--text)" }}>
        {value}
      </p>
    </div>
  );
}

function CompactStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[0.8rem] border px-2.5 py-2" style={{ borderColor: "var(--border-faint)", background: "var(--bg-page)" }}>
      <p className="text-[0.625rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
        {label}
      </p>
      <p className="mt-1 truncate text-[0.8125rem] font-medium" style={{ color: "var(--text)" }}>
        {value}
      </p>
    </div>
  );
}

function statusCopy(habit: HabitSummary, period: string) {
  if (habit.cadence === "weekly") {
    if (habit.completedThisWeek) return "Weekly anchor protected.";
    if (habit.fallbackLoggedToday) return "You kept the weekly habit alive today.";
    if (habit.recoveryLoggedToday) return "Recovery logged. Close the weekly target before Sunday.";
    return habit.rescuePrompt ?? "Close the weekly target before Sunday slips.";
  }
  if (habit.completedToday) return `Anchor protected for ${period}.`;
  if (habit.fallbackLoggedToday) return "Not fully closed, but you kept it alive.";
  if (habit.recoveryLoggedToday) return "Recovery logged. Protect the next step.";
  if (habit.needsSaveToday) return habit.rescuePrompt ?? "This one is slipping. Take the smallest good save now.";
  return "Keep the entry friction low and finish it fast.";
}

function surfaceTone(habit: HabitSummary) {
  if (habit.needsSaveToday) {
    return {
      borderColor: "var(--accent-tint-strong)",
      background: "linear-gradient(180deg, var(--accent-tint), var(--bg-page) 28%)",
    };
  }

  if (habit.completedToday || habit.completedThisWeek) {
    return {
      borderColor: "var(--border-soft)",
      background: "linear-gradient(180deg, var(--bg-tint), var(--bg-page) 28%)",
    };
  }

  return {
    borderColor: "var(--border-faint)",
    background: "var(--bg-page)",
  };
}

function topStatusLabel(habit: HabitSummary, period: string) {
  if (habit.cadence === "weekly" ? habit.completedThisWeek : habit.completedToday) return `complete ${period}`;
  if (habit.fallbackLoggedToday) return "saved today";
  if (habit.recoveryLoggedToday) return "recovery logged";
  if (habit.needsSaveToday) return "needs save";
  if (habit.dueToday) return "due now";
  return "in rhythm";
}

function defaultScheduleStart(habit: HabitSummary) {
  if (habit.reminderTime) return habit.reminderTime;
  const dayPart = (habit.dayPart ?? "anytime") as HabitDayPart;
  if (dayPart === "morning") return "07:30";
  if (dayPart === "day") return "13:00";
  if (dayPart === "evening") return "19:00";
  return "09:00";
}

function LogProgressModal({ habit, onClose }: { habit: HabitSummary; onClose: () => void }) {
  const [state, formAction, pending] = useActionState<HabitLogState, FormData>(logHabitAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);
  const defaultQuantity = habit.goalUnit === "check" ? 1 : Math.max(1, habit.targetCount - habit.progressToday);

  useEffect(() => {
    if (pending) {
      submittedRef.current = true;
      return;
    }

    if (submittedRef.current && !state?.error) {
      submittedRef.current = false;
      const timer = window.setTimeout(() => {
        formRef.current?.reset();
        onClose();
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [onClose, pending, state]);

  return (
    <div className="calendar-modal-backdrop" role="presentation" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={`habit-log-title-${habit.id}`} className="calendar-modal" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
              Log progress
            </p>
            <h2 id={`habit-log-title-${habit.id}`} className="mt-1 text-[1.125rem] font-semibold tracking-tight" style={{ color: "var(--text)" }}>
              {habit.title}
            </h2>
            <p className="mt-2 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
              {habit.progressToday > 0
                ? `${formatHabitQuantity(habit.progressToday, habit.goalUnit as HabitGoalUnit)} logged today so far.`
                : "Nothing logged yet today."}
            </p>
          </div>
          <button type="button" className="btn-icon h-8 w-8 rounded-full border" style={{ borderColor: "var(--border-faint)" }} onClick={onClose}>
            x
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <MetricTile label="Target" value={habit.targetLabel} />
          <MetricTile label="Anchor streak" value={`${habit.currentStreak}`} />
          <MetricTile label="30 days" value={`${habit.completionRate30d}% full hit`} />
        </div>

        <form
          ref={formRef}
          action={formAction}
          className="mt-5 space-y-4"
          onSubmit={() => {
            submittedRef.current = true;
          }}
        >
          <input type="hidden" name="id" value={habit.id} />
          <input type="hidden" name="mode" value="full" />
          <div className="space-y-1.5">
            <label htmlFor={`quantity-${habit.id}`} className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
              Quantity
            </label>
            <input
              id={`quantity-${habit.id}`}
              name="quantity"
              type="number"
              min={1}
              step={habit.goalUnit === "minutes" ? 5 : 1}
              defaultValue={defaultQuantity}
              className="field"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`notes-${habit.id}`} className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
              Notes
            </label>
            <input id={`notes-${habit.id}`} name="notes" className="field" placeholder="What helped? What got in the way?" />
          </div>
          {state?.error ? (
            <p className="rounded-md px-3 py-2 text-[0.8125rem]" style={{ background: "var(--accent-tint)", color: "var(--accent-strong)", border: "1px solid var(--accent-tint-strong)" }}>
              {state.error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button type="button" className="btn-ghost w-full sm:w-auto" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className="btn-ink w-full sm:w-auto">
              {pending ? "Saving..." : "Save progress"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ScheduleModal({ habit, onClose }: { habit: HabitSummary; onClose: () => void }) {
  const [state, formAction, pending] = useActionState<HabitScheduleState, FormData>(scheduleHabitAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);
  const today = new Date().toLocaleDateString("en-CA");
  const start = defaultScheduleStart(habit);
  const duration = habit.defaultDurationMinutes ?? (habit.goalUnit === "minutes" ? habit.targetCount : 30);
  const base = new Date(`${today}T${start}`);
  base.setMinutes(base.getMinutes() + duration);
  const end = `${String(base.getHours()).padStart(2, "0")}:${String(base.getMinutes()).padStart(2, "0")}`;

  useEffect(() => {
    if (pending) {
      submittedRef.current = true;
      return;
    }

    if (submittedRef.current && !state?.error) {
      submittedRef.current = false;
      const timer = window.setTimeout(() => {
        formRef.current?.reset();
        onClose();
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [onClose, pending, state]);

  return (
    <div className="calendar-modal-backdrop" role="presentation" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={`habit-schedule-title-${habit.id}`} className="calendar-modal" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
              Schedule habit
            </p>
            <h2 id={`habit-schedule-title-${habit.id}`} className="mt-1 text-[1.125rem] font-semibold tracking-tight" style={{ color: "var(--text)" }}>
              Put {habit.title} on the calendar
            </h2>
          </div>
          <button type="button" className="btn-icon h-8 w-8 rounded-full border" style={{ borderColor: "var(--border-faint)" }} onClick={onClose}>
            x
          </button>
        </div>

        <form
          ref={formRef}
          action={formAction}
          className="mt-5 space-y-4"
          onSubmit={() => {
            submittedRef.current = true;
          }}
        >
          <input type="hidden" name="habitId" value={habit.id} />
          <input type="hidden" name="title" value={habit.title} />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label htmlFor={`date-${habit.id}`} className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                Date
              </label>
              <input id={`date-${habit.id}`} name="date" type="date" defaultValue={today} className="field" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`start-${habit.id}`} className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                Start
              </label>
              <input id={`start-${habit.id}`} name="start" type="time" defaultValue={start} className="field" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`end-${habit.id}`} className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                End
              </label>
              <input id={`end-${habit.id}`} name="end" type="time" defaultValue={end} className="field" />
            </div>
          </div>
          {state?.error ? (
            <p className="rounded-md px-3 py-2 text-[0.8125rem]" style={{ background: "var(--accent-tint)", color: "var(--accent-strong)", border: "1px solid var(--accent-tint-strong)" }}>
              {state.error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button type="button" className="btn-ghost w-full sm:w-auto" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className="btn-ink w-full sm:w-auto">
              {pending ? "Saving..." : "Save block"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function HabitCard({ habit }: { habit: HabitSummary }) {
  const [logOpen, setLogOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const progress = progressValue(habit);
  const progressPercent = progressRatio(habit);
  const period = periodLabel(habit);
  const last7 = habit.recentDays.slice(-7);
  const windowSummary = recentWindowSummary(habit);
  const saveLabel = habit.fallbackTitle ?? "Run recovery";
  const tone = surfaceTone(habit);

  return (
    <>
      <li className="rounded-[1rem] border p-3 sm:p-4" style={tone}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[0.98rem] font-semibold tracking-tight" style={{ color: "var(--text)" }}>
                  {habit.title}
                </p>
                <span className={habit.needsSaveToday ? "pill-accent" : "pill"}>{topStatusLabel(habit, period)}</span>
                {habit.bucket ? <span className="pill">{habit.bucket}</span> : null}
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="pill">{habit.dayPartLabel}</span>
                <span className="pill">{habit.cadenceLabel}</span>
                <span className="pill">{habit.targetLabel}</span>
              </div>

              <p className="mt-2 text-[0.8125rem] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {statusCopy(habit, period)}
              </p>

              {habit.needsSaveToday && (habit.fallbackTitle || habit.rescuePrompt) ? (
                <div className="mt-2 rounded-[0.85rem] border px-3 py-2.5" style={{ borderColor: "var(--accent-tint-strong)", background: "var(--accent-tint)" }}>
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--accent-strong)" }}>
                    Smallest good move
                  </p>
                  <p className="mt-1 text-[0.8125rem]" style={{ color: "var(--text)" }}>
                    {habit.fallbackTitle ?? habit.rescuePrompt}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:justify-end">
              <button type="button" className="btn-ink h-8 w-full px-2.5 text-[0.75rem]" onClick={() => setLogOpen(true)}>
                {habit.goalUnit === "check" ? "Done" : "Log"}
              </button>
              {habit.salvageLabel ? (
                <form action={salvageHabitAction} className="contents sm:block">
                  <input type="hidden" name="id" value={habit.id} />
                  <input type="hidden" name="mode" value={habit.fallbackTitle ? "fallback" : "recovery"} />
                  <input type="hidden" name="notes" value={habit.fallbackTitle ?? habit.rescuePrompt ?? "Recovery logged."} />
                  <button className="btn-ghost h-8 w-full px-2.5 text-[0.75rem]" type="submit">
                    {saveLabel}
                  </button>
                </form>
              ) : null}
              <HabitStartTimerButton id={habit.id} />
              <button type="button" className="btn-ghost hidden h-8 w-full px-2.5 text-[0.75rem] sm:block" onClick={() => setScheduleOpen(true)}>
                Schedule
              </button>
              <form action={createDoFromHabitAction} className="hidden sm:block">
                <input type="hidden" name="title" value={habit.title} />
                <input type="hidden" name="bucket" value={habit.bucket ?? ""} />
                <input type="hidden" name="estimatedMinutes" value={habit.defaultDurationMinutes ?? ""} />
                <button className="btn-ghost h-8 w-full px-2.5 text-[0.75rem]" type="submit">
                  Add task
                </button>
              </form>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[0.95rem] border p-3" style={{ borderColor: "var(--border-faint)", background: "var(--bg-tint)" }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                    Progress
                  </p>
                  <p className="mt-1 text-[1rem] font-semibold tracking-tight" style={{ color: "var(--text)" }}>
                    {`${formatHabitQuantity(progress, habit.goalUnit as HabitGoalUnit)} / ${formatHabitQuantity(habit.targetCount, habit.goalUnit as HabitGoalUnit)}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[1.25rem] font-semibold tracking-tight tabular" style={{ color: "var(--text)" }}>
                    {progressPercent}%
                  </p>
                  <p className="text-[0.6875rem] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                    {period}
                  </p>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: "var(--border-faint)" }}>
                <div className="h-full rounded-full" style={{ width: `${progressPercent}%`, background: "var(--text)" }} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:hidden">
              <CompactStat label="Anchor" value={`${habit.currentStreak}`} />
              <CompactStat label="Alive" value={`${habit.keptAliveStreak}`} />
              <CompactStat label="Best" value={`${habit.longestStreak}`} />
            </div>

            <div className="hidden gap-2 sm:grid sm:grid-cols-3">
              <MetricTile label="Anchor streak" value={`${habit.currentStreak}`} />
              <MetricTile label="Kept alive" value={`${habit.keptAliveStreak}`} />
              <MetricTile label="Best run" value={`${habit.longestStreak}`} />
            </div>
          </div>

          <div className="rounded-[0.95rem] border px-3 py-2.5" style={{ borderColor: "var(--border-faint)", background: "var(--bg-page)" }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                  Recent rhythm
                </p>
                <p className="mt-1 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                  {windowSummary.hitCount} hit{windowSummary.hitCount === 1 ? "" : "s"} in the last {windowSummary.dueCount} due window{windowSummary.dueCount === 1 ? "" : "s"}
                  {windowSummary.missCount > 0 ? `, ${windowSummary.missCount} miss${windowSummary.missCount === 1 ? "" : "es"}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {last7.map((day) => {
                  const toneForDay = detailTone(day.completed, day.due, day.keptAlive);
                  return (
                    <span
                      key={day.dateKey}
                      title={`${day.dateKey}: ${day.completed ? "hit" : day.keptAlive ? "saved" : day.due ? "missed" : "not due"}`}
                      className="inline-flex h-2.5 w-6 rounded-full border"
                      style={toneForDay}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <details className="rounded-[0.95rem] border" style={{ borderColor: "var(--border-faint)" }}>
            <summary className="cursor-pointer list-none px-3 py-2 text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
              View details
            </summary>
            <div className="space-y-4 px-3 pb-3">
              <div className="grid gap-1.5 sm:hidden">
                <button type="button" className="btn-ghost h-8 w-full px-2.5 text-[0.75rem]" onClick={() => setScheduleOpen(true)}>
                  Schedule
                </button>
                <form action={createDoFromHabitAction}>
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

          <details className="rounded-[0.95rem] border" style={{ borderColor: "var(--border-faint)" }}>
            <summary className="cursor-pointer list-none px-3 py-2 text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
              Edit habit
            </summary>
            <form action={updateHabitAction} className="space-y-3 px-3 pb-3">
              <input type="hidden" name="id" value={habit.id} />
              <div className="space-y-1.5">
                <label htmlFor={`title-${habit.id}`} className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                  Habit title
                </label>
                <input id={`title-${habit.id}`} name="title" defaultValue={habit.title} className="field" required />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label htmlFor={`cadence-${habit.id}`} className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                    Cadence
                  </label>
                  <select id={`cadence-${habit.id}`} name="cadence" defaultValue={habit.cadence} className="field">
                    {HABIT_CADENCES.map((option) => (
                      <option key={option} value={option}>
                        {HABIT_CADENCE_LABELS[option]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor={`goalUnit-${habit.id}`} className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                    Track by
                  </label>
                  <select id={`goalUnit-${habit.id}`} name="goalUnit" defaultValue={habit.goalUnit} className="field">
                    {HABIT_GOAL_UNITS.map((option) => (
                      <option key={option} value={option}>
                        {HABIT_GOAL_UNIT_LABELS[option]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor={`target-${habit.id}`} className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                    Target
                  </label>
                  <input id={`target-${habit.id}`} name="targetCount" type="number" min={1} defaultValue={habit.targetCount} className="field" />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                  Custom days
                </p>
                <div className="flex flex-wrap gap-2">
                  {HABIT_WEEKDAY_OPTIONS.map((day) => (
                    <label key={`${habit.id}-${day.value}`} className="pill cursor-pointer gap-2 px-2 py-1">
                      <input
                        type="checkbox"
                        name="daysOfWeek"
                        value={day.value}
                        defaultChecked={parseHabitDays(habit.daysOfWeek).includes(day.value)}
                      />
                      <span>{day.short}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label htmlFor={`bucket-${habit.id}`} className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                    Bucket
                  </label>
                  <input id={`bucket-${habit.id}`} name="bucket" defaultValue={habit.bucket ?? ""} className="field" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor={`dayPart-${habit.id}`} className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                    Best fit
                  </label>
                  <select id={`dayPart-${habit.id}`} name="dayPart" defaultValue={habit.dayPart} className="field">
                    {HABIT_DAY_PARTS.map((option) => (
                      <option key={`${habit.id}-${option}`} value={option}>
                        {HABIT_DAY_PART_LABELS[option]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor={`duration-${habit.id}`} className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                    Default block
                  </label>
                  <input
                    id={`duration-${habit.id}`}
                    name="defaultDurationMinutes"
                    type="number"
                    min={5}
                    step={5}
                    defaultValue={habit.defaultDurationMinutes ?? ""}
                    className="field"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor={`reminder-${habit.id}`} className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                  Exact reminder time
                </label>
                <input id={`reminder-${habit.id}`} name="reminderTime" type="time" defaultValue={habit.reminderTime ?? ""} className="field" />
                <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                  Optional. Leave blank if this habit should stay flexible inside its day part.
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor={`notes-${habit.id}`} className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                  Notes
                </label>
                <input id={`notes-${habit.id}`} name="notes" defaultValue={habit.notes ?? ""} className="field" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor={`fallback-${habit.id}`} className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                    Fallback save
                  </label>
                  <input id={`fallback-${habit.id}`} name="fallbackTitle" defaultValue={habit.fallbackTitle ?? ""} className="field" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor={`rescue-${habit.id}`} className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                    Rescue prompt
                  </label>
                  <input id={`rescue-${habit.id}`} name="rescuePrompt" defaultValue={habit.rescuePrompt ?? ""} className="field" />
                </div>
              </div>

              <div className="flex justify-end">
                <button type="submit" className="btn-ink">
                  Save changes
                </button>
              </div>
            </form>
          </details>

          <div className="flex flex-wrap justify-end gap-2">
            {habit.archivedAt ? (
              <form
                action={deleteHabitAction}
                onSubmit={(event) => {
                  if (!window.confirm(`Delete "${habit.title}" permanently?`)) {
                    event.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="id" value={habit.id} />
                <button type="submit" className="btn-ghost h-8 px-2.5 text-[0.75rem]" style={{ color: "var(--accent-strong)" }}>
                  Delete permanently
                </button>
              </form>
            ) : null}
            <form action={archiveHabitAction}>
              <input type="hidden" name="id" value={habit.id} />
              <input type="hidden" name="archived" value={habit.archivedAt ? "false" : "true"} />
              <button type="submit" className="btn-ghost h-8 px-2.5 text-[0.75rem]">
                {habit.archivedAt ? "Reopen habit" : "Pause habit"}
              </button>
            </form>
          </div>
        </div>
      </li>

      {logOpen ? <LogProgressModal habit={habit} onClose={() => setLogOpen(false)} /> : null}
      {scheduleOpen ? <ScheduleModal habit={habit} onClose={() => setScheduleOpen(false)} /> : null}
    </>
  );
}
