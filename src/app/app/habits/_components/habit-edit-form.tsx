"use client";

import { useState } from "react";
import {
  HABIT_CADENCE_LABELS,
  HABIT_CADENCES,
  HABIT_DAY_PART_LABELS,
  HABIT_DAY_PARTS,
  HABIT_GOAL_UNIT_LABELS,
  HABIT_GOAL_UNITS,
  HABIT_WEEKDAY_OPTIONS,
  parseHabitDays,
} from "@/lib/habits";
import type { HabitSummary } from "@/lib/services/habits";
import { updateHabitAction } from "../actions";

/** Clamp minutes-since-midnight to a 24-hour HH:MM string for <input type="time">. */
function clampClock24(totalMinutes: number): string {
  const value = Math.max(0, Math.min(1439, Math.round(totalMinutes)));
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/** Parse an HH:MM string to minutes-since-midnight, or null if malformed. */
function parseClock24(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (hours < 0 || hours > 23 || mins < 0 || mins > 59) return null;
  return hours * 60 + mins;
}

export function HabitEditForm({ habit }: { habit: HabitSummary }) {
  const [showWindow, setShowWindow] = useState(
    Boolean(habit.windowStart || habit.windowEnd),
  );
  const [windowStart, setWindowStart] = useState(habit.windowStart ?? "");
  const [windowEnd, setWindowEnd] = useState(habit.windowEnd ?? "");

  // Enabling the window pre-fills ±1h around the reminder (the default range).
  const toggleWindow = () => {
    setShowWindow((prev) => {
      const next = !prev;
      if (next && !windowStart && !windowEnd) {
        const base = parseClock24(habit.reminderTime);
        if (base !== null) {
          setWindowStart(clampClock24(base - 60));
          setWindowEnd(clampClock24(base + 60));
        }
      }
      return next;
    });
  };

  return (
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

        {/* Flexible time window — the acceptable range around the reminder. */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={toggleWindow}
            aria-pressed={showWindow}
            className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            <span aria-hidden>{showWindow ? "−" : "+"}</span> Add time window
          </button>
          {showWindow ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor={`window-start-${habit.id}`} className="block text-[0.72rem]" style={{ color: "var(--text-faint)" }}>
                    Earliest start
                  </label>
                  <input
                    id={`window-start-${habit.id}`}
                    name="windowStart"
                    type="time"
                    className="field"
                    value={windowStart}
                    onChange={(event) => setWindowStart(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor={`window-end-${habit.id}`} className="block text-[0.72rem]" style={{ color: "var(--text-faint)" }}>
                    Latest end
                  </label>
                  <input
                    id={`window-end-${habit.id}`}
                    name="windowEnd"
                    type="time"
                    className="field"
                    value={windowEnd}
                    onChange={(event) => setWindowEnd(event.target.value)}
                  />
                </div>
              </div>
              <p className="text-[0.72rem]" style={{ color: "var(--text-faint)" }}>
                Shows as a soft band on the calendar — the reminder stays the ideal slot inside it.
              </p>
            </>
          ) : null}
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
  );
}
