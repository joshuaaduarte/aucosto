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
  type HabitCadence,
  type HabitDayPart,
  type HabitGoalUnit,
} from "@/lib/habits";
import { createHabitAction, type HabitState } from "./actions";

const initialState: HabitState = undefined;

export function HabitCreateForm() {
  const [state, formAction, pending] = useActionState(createHabitAction, initialState);
  const [open, setOpen] = useState(false);
  const [cadence, setCadence] = useState<HabitCadence>("daily");
  const [dayPart, setDayPart] = useState<HabitDayPart>("anytime");
  const [goalUnit, setGoalUnit] = useState<HabitGoalUnit>("check");
  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (pending) {
      submittedRef.current = true;
      return;
    }

    if (submittedRef.current && open && !state?.error) {
      submittedRef.current = false;
      const timer = window.setTimeout(() => {
        formRef.current?.reset();
        setCadence("daily");
        setDayPart("anytime");
        setGoalUnit("check");
        setOpen(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [open, pending, state]);

  return (
    <>
      <div className="flex justify-end">
        <button type="button" className="btn-ink" onClick={() => setOpen(true)}>
          New habit
        </button>
      </div>

      <button type="button" className="calendar-fab" onClick={() => setOpen(true)}>
        <span className="calendar-fab__plus" aria-hidden="true">
          +
        </span>
        <span>Add habit</span>
      </button>

      {open ? (
        <div className="calendar-modal-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="habit-create-title"
            className="calendar-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                  New habit
                </p>
                <h2 id="habit-create-title" className="mt-1 text-[1.125rem] font-semibold tracking-tight" style={{ color: "var(--text)" }}>
                  Add something worth repeating
                </h2>
              </div>

              <button
                type="button"
                className="btn-icon h-8 w-8 rounded-full border"
                style={{ borderColor: "var(--border-faint)" }}
                onClick={() => setOpen(false)}
                aria-label="Close add habit modal"
              >
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
              <div className="space-y-1.5">
                <label htmlFor="habit-title" className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                  Habit title
                </label>
                <input id="habit-title" name="title" required className="field" placeholder="Morning run, read 20 pages, no phone after 10" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="habit-bucket" className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                    Bucket
                  </label>
                  <input id="habit-bucket" name="bucket" className="field" placeholder="health, work, marriage" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="habit-dayPart" className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                    Best fit
                  </label>
                  <select
                    id="habit-dayPart"
                    name="dayPart"
                    className="field"
                    value={dayPart}
                    onChange={(event) => setDayPart(event.target.value as HabitDayPart)}
                  >
                    {HABIT_DAY_PARTS.map((option) => (
                      <option key={option} value={option}>
                        {HABIT_DAY_PART_LABELS[option]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label htmlFor="habit-cadence" className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                    Cadence
                  </label>
                  <select id="habit-cadence" name="cadence" className="field" value={cadence} onChange={(event) => setCadence(event.target.value as HabitCadence)}>
                    {HABIT_CADENCES.map((option) => (
                      <option key={option} value={option}>
                        {HABIT_CADENCE_LABELS[option]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="habit-goalUnit" className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                    Track by
                  </label>
                  <select id="habit-goalUnit" name="goalUnit" className="field" value={goalUnit} onChange={(event) => setGoalUnit(event.target.value as HabitGoalUnit)}>
                    {HABIT_GOAL_UNITS.map((option) => (
                      <option key={option} value={option}>
                        {HABIT_GOAL_UNIT_LABELS[option]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="habit-targetCount" className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                    Target
                  </label>
                  <input id="habit-targetCount" name="targetCount" type="number" min={1} step={1} defaultValue={1} className="field" />
                </div>
              </div>

              {cadence === "custom" ? (
                <div className="space-y-2">
                  <p className="text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                    Days
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {HABIT_WEEKDAY_OPTIONS.map((day) => (
                      <label key={day.value} className="pill cursor-pointer gap-2 px-2 py-1">
                        <input type="checkbox" name="daysOfWeek" value={day.value} />
                        <span>{day.short}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-1.5">
                <label htmlFor="habit-default-duration" className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                  Default time block
                </label>
                <input
                  id="habit-default-duration"
                  name="defaultDurationMinutes"
                  type="number"
                  min={5}
                  step={5}
                  className="field"
                  placeholder={goalUnit === "minutes" ? "30" : "45"}
                />
              </div>

              <details className="rounded-[0.9rem] border px-3 py-2.5" style={{ borderColor: "var(--border-faint)" }}>
                <summary className="cursor-pointer list-none text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                  Optional precise timing
                </summary>
                <div className="mt-3 space-y-1.5">
                  <label htmlFor="habit-reminder" className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                    Exact reminder time
                  </label>
                  <input id="habit-reminder" name="reminderTime" type="time" className="field" />
                  <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                    Optional. Leave blank if this habit should stay flexible inside its day part.
                  </p>
                </div>
              </details>

              <div className="space-y-1.5">
                <label htmlFor="habit-notes" className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                  Notes
                </label>
                <input id="habit-notes" name="notes" className="field" placeholder="Why this matters, what good looks like, constraints..." />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="habit-fallback" className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                    Fallback save
                  </label>
                  <input
                    id="habit-fallback"
                    name="fallbackTitle"
                    className="field"
                    placeholder="10-minute Arlo walk, 3-minute shutdown, 10-minute starter block"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="habit-rescue" className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                    Rescue prompt
                  </label>
                  <input
                    id="habit-rescue"
                    name="rescuePrompt"
                    className="field"
                    placeholder="You are late, not cooked. Protect tomorrow now."
                  />
                </div>
              </div>

              {state?.error ? (
                <p className="rounded-md px-3 py-2 text-[0.8125rem]" style={{ background: "var(--accent-tint)", color: "var(--accent-strong)", border: "1px solid var(--accent-tint-strong)" }}>
                  {state.error}
                </p>
              ) : null}

              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <button type="button" className="btn-ghost w-full sm:w-auto" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={pending} className="btn-ink w-full sm:w-auto">
                  {pending ? "Saving..." : "Add habit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
