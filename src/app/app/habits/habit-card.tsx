"use client";

import { useState } from "react";
import { formatHabitQuantity, type HabitGoalUnit } from "@/lib/habits";
import type { HabitSummary } from "@/lib/services/habits";
import {
  archiveHabitAction,
  createDoFromHabitAction,
  deleteHabitAction,
  salvageHabitAction,
  startHabitTimerAction,
} from "./actions";
import { StartTimerButton } from "../_components/start-timer-button";
import {
  detailTone,
  periodLabel,
  progressRatio,
  progressValue,
  recentWindowSummary,
  statusCopy,
  surfaceTone,
  topStatusLabel,
} from "./_components/habit-card-helpers";
import { HabitDetails } from "./_components/habit-details";
import { HabitEditForm } from "./_components/habit-edit-form";
import { LogProgressModal } from "./_components/log-progress-modal";
import { ScheduleModal } from "./_components/schedule-modal";
import { CompactStat, MetricTile } from "./_components/stat-tiles";

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
              <StartTimerButton id={habit.id} action={startHabitTimerAction} />
              <button type="button" className="btn-ghost hidden h-8 w-full px-2.5 text-[0.75rem] sm:block" onClick={() => setScheduleOpen(true)}>
                Schedule
              </button>
              <form action={createDoFromHabitAction} className="hidden sm:block">
                <input type="hidden" name="habitId" value={habit.id} />
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

          <HabitDetails habit={habit} onSchedule={() => setScheduleOpen(true)} />

          <HabitEditForm habit={habit} />

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
                {habit.archivedAt ? "Restore habit" : "Pause / archive"}
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
