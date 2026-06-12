"use client";

// Habit detail view: description, streak stats, 7-day mini calendar,
// timer/schedule/task actions, full edit form, archive/delete. Opened by
// tapping a habit card — the card itself stays compact.

import { useEffect, useState } from "react";
import { categoryColor } from "@/lib/time-categories";
import { formatHabitQuantity, type HabitGoalUnit } from "@/lib/habits";
import type { HabitSummary } from "@/lib/services/habits";
import { splitLeadingEmoji } from "@/lib/habit-templates";
import { StartTimerButton } from "../../_components/start-timer-button";
import { useBodyScrollLock } from "../../_components/use-body-scroll-lock";
import {
  archiveHabitAction,
  createDoFromHabitAction,
  deleteHabitAction,
  startHabitTimerAction,
  undoTodayHabitLogAction,
} from "../actions";
import { detailTone } from "./habit-card-helpers";
import { HabitEditForm } from "./habit-edit-form";
import { LogProgressModal } from "./log-progress-modal";
import { MetricTile } from "./stat-tiles";
import { ScheduleModal } from "./schedule-modal";

export function HabitDetailModal({
  habit,
  onClose,
}: {
  habit: HabitSummary;
  onClose: () => void;
}) {
  useBodyScrollLock();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [undoArmed, setUndoArmed] = useState(false);
  const [undoPending, setUndoPending] = useState(false);
  const { emoji, rest } = splitLeadingEmoji(habit.title);
  const color = categoryColor(habit.bucket ?? "habit");
  const last7 = habit.recentDays.slice(-7);

  useEffect(() => {
    if (!deleteArmed) return;
    const timer = window.setTimeout(() => setDeleteArmed(false), 3000);
    return () => window.clearTimeout(timer);
  }, [deleteArmed]);

  useEffect(() => {
    if (!undoArmed) return;
    const timer = window.setTimeout(() => setUndoArmed(false), 3000);
    return () => window.clearTimeout(timer);
  }, [undoArmed]);

  const loggedToday =
    habit.progressToday > 0 ||
    habit.fallbackLoggedToday ||
    habit.recoveryLoggedToday;

  return (
    <>
      <div className="calendar-modal-backdrop" role="presentation" onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`habit-detail-title-${habit.id}`}
          className="calendar-modal"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[1.25rem]"
                style={{ background: `color-mix(in srgb, ${color} 18%, var(--bg-page))` }}
                aria-hidden
              >
                {emoji ?? "•"}
              </span>
              <div className="min-w-0">
                <h2
                  id={`habit-detail-title-${habit.id}`}
                  className="truncate text-[1.125rem] font-semibold tracking-tight"
                  style={{ color: "var(--text)" }}
                >
                  {rest}
                </h2>
                <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                  {habit.dayPartLabel} · {habit.cadenceLabel} · {habit.targetLabel}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn-icon h-8 w-8 rounded-full border"
              style={{ borderColor: "var(--border-faint)" }}
              onClick={onClose}
              aria-label="Close habit details"
            >
              x
            </button>
          </div>

          {habit.notes ? (
            <p
              className="mt-3 whitespace-pre-line text-[0.85rem] leading-[1.55]"
              style={{ color: "var(--text-muted)" }}
            >
              {habit.notes}
            </p>
          ) : null}

          <div className="mt-4 grid grid-cols-3 gap-2">
            <MetricTile label="Streak" value={`${habit.currentStreak}`} />
            <MetricTile label="Best run" value={`${habit.longestStreak}`} />
            <MetricTile label="30-day rate" value={`${Math.min(100, habit.completionRate30d)}%`} />
          </div>

          {/* Today's log: edit (re-log) or undo. */}
          {loggedToday && !habit.archivedAt ? (
            <div
              className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2.5"
              style={{ borderColor: "var(--border-faint)", background: "var(--bg-tint)" }}
            >
              <p className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                Today:{" "}
                <strong style={{ color: "var(--text)" }}>
                  {habit.progressToday > 0
                    ? formatHabitQuantity(habit.progressToday, habit.goalUnit as HabitGoalUnit)
                    : "saved with a fallback"}
                </strong>{" "}
                logged
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="btn-ghost h-8 px-2.5 text-[0.75rem]"
                  onClick={() => setLogOpen(true)}
                  title="Add to today's total"
                >
                  Add more
                </button>
                <button
                  type="button"
                  disabled={undoPending}
                  onClick={async () => {
                    if (!undoArmed) {
                      setUndoArmed(true);
                      return;
                    }
                    setUndoPending(true);
                    const formData = new FormData();
                    formData.set("id", habit.id);
                    await undoTodayHabitLogAction(formData);
                    setUndoPending(false);
                    setUndoArmed(false);
                  }}
                  className="btn-ghost h-8 px-2.5 text-[0.75rem] font-semibold"
                  style={{
                    color: "var(--accent-strong)",
                    background: undoArmed ? "var(--accent-tint)" : undefined,
                  }}
                  title="Removes all of today's entries — re-log with the right amount"
                >
                  {undoPending ? "Undoing…" : undoArmed ? "Sure?" : "Undo today"}
                </button>
              </div>
            </div>
          ) : null}

          {/* Last 7 days mini calendar */}
          <div className="mt-4">
            <p
              className="text-[0.6875rem] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              Last 7 days
            </p>
            <div className="mt-2 grid grid-cols-7 gap-1.5">
              {last7.map((day) => {
                const tone = detailTone(day.completed, day.due, day.keptAlive);
                return (
                  <div
                    key={day.dateKey}
                    className="rounded-md border px-1 py-1.5 text-center"
                    style={{
                      borderColor: tone.borderColor,
                      background: tone.background,
                      color: tone.color,
                    }}
                    title={`${day.dateKey}: ${day.completed ? "hit" : day.keptAlive ? "saved" : day.due ? "missed" : "not due"}${day.due ? ` · ${formatHabitQuantity(day.progress, habit.goalUnit as HabitGoalUnit)}` : ""}`}
                  >
                    <p className="text-[0.575rem] font-semibold uppercase">{day.label}</p>
                    <p className="mt-0.5 text-[0.75rem]" aria-hidden>
                      {day.completed ? "✓" : day.keptAlive ? "~" : day.due ? "·" : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-4 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {!habit.archivedAt ? (
              <>
                <StartTimerButton id={habit.id} action={startHabitTimerAction} />
                <button
                  type="button"
                  className="btn-ghost h-8 w-full px-2.5 text-[0.75rem]"
                  onClick={() => setLogOpen(true)}
                >
                  Custom log
                </button>
                <button
                  type="button"
                  className="btn-ghost h-8 w-full px-2.5 text-[0.75rem]"
                  onClick={() => setScheduleOpen(true)}
                >
                  Schedule
                </button>
                <form action={createDoFromHabitAction} className="contents">
                  <input type="hidden" name="habitId" value={habit.id} />
                  <input type="hidden" name="title" value={habit.title} />
                  <input type="hidden" name="bucket" value={habit.bucket ?? ""} />
                  <input
                    type="hidden"
                    name="estimatedMinutes"
                    value={habit.defaultDurationMinutes ?? ""}
                  />
                  <button className="btn-ghost h-8 w-full px-2.5 text-[0.75rem]" type="submit">
                    Add task
                  </button>
                </form>
              </>
            ) : null}
          </div>

          <div className="mt-4">
            <HabitEditForm habit={habit} />
          </div>

          <div
            className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t pt-3"
            style={{ borderColor: "var(--border-faint)" }}
          >
            {habit.archivedAt ? (
              <button
                type="button"
                onClick={() => {
                  if (!deleteArmed) {
                    setDeleteArmed(true);
                    return;
                  }
                  const formData = new FormData();
                  formData.set("id", habit.id);
                  void deleteHabitAction(formData);
                  onClose();
                }}
                className="btn-ghost h-8 px-2.5 text-[0.75rem] font-semibold"
                style={{
                  color: "var(--accent-strong)",
                  background: deleteArmed ? "var(--accent-tint)" : undefined,
                }}
              >
                {deleteArmed ? "Sure?" : "Delete permanently"}
              </button>
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
      </div>

      {scheduleOpen ? <ScheduleModal habit={habit} onClose={() => setScheduleOpen(false)} /> : null}
      {logOpen ? <LogProgressModal habit={habit} onClose={() => setLogOpen(false)} /> : null}
    </>
  );
}
