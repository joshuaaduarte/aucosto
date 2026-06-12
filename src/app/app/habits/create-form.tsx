"use client";

// Quick habit creation: title + when + how to track, under 30 seconds.
// Cadence, buckets, durations, reminders, notes, and rescue plans all live
// behind "More options" — sensible defaults otherwise (daily, anytime).

import { useActionState, useEffect, useRef, useState } from "react";
import {
  HABIT_CADENCE_LABELS,
  HABIT_CADENCES,
  HABIT_DAY_PART_LABELS,
  HABIT_DAY_PARTS,
  HABIT_WEEKDAY_OPTIONS,
  type HabitCadence,
  type HabitDayPart,
  type HabitGoalUnit,
} from "@/lib/habits";
import { createHabitAction, type HabitState } from "./actions";
import { useBodyScrollLock } from "../_components/use-body-scroll-lock";

const initialState: HabitState = undefined;

const GOAL_UNIT_OPTIONS: Array<{ value: HabitGoalUnit; label: string; hint: string }> = [
  { value: "check", label: "✓ Just check it off", hint: "done / not done" },
  { value: "count", label: "Count", hint: "e.g. 8 glasses" },
  { value: "minutes", label: "Minutes", hint: "pairs with the timer" },
];

export function HabitCreateForm() {
  const [state, formAction, pending] = useActionState(createHabitAction, initialState);
  const [open, setOpen] = useState(false);
  useBodyScrollLock(open);
  const [cadence, setCadence] = useState<HabitCadence>("daily");
  const [dayPart, setDayPart] = useState<HabitDayPart>("anytime");
  const [goalUnit, setGoalUnit] = useState<HabitGoalUnit>("check");
  const [target, setTarget] = useState("1");
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
        setTarget("1");
        setOpen(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [open, pending, state]);

  const pickUnit = (unit: HabitGoalUnit) => {
    setGoalUnit(unit);
    setTarget(unit === "minutes" ? "15" : unit === "count" ? "3" : "1");
  };

  return (
    <>
      <div className="flex justify-end">
        <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>
          New custom habit
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
              <input type="hidden" name="dayPart" value={dayPart} />
              <input type="hidden" name="goalUnit" value={goalUnit} />
              <input type="hidden" name="targetCount" value={target} />

              <div className="space-y-1.5">
                <label htmlFor="habit-title" className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                  Habit
                </label>
                <input
                  id="habit-title"
                  name="title"
                  required
                  className="field"
                  placeholder="🏃 Morning run · 📖 Read 20 pages · 📵 No phone after 10"
                />
                <p className="text-[0.72rem]" style={{ color: "var(--text-faint)" }}>
                  Tip: start with an emoji — it becomes the habit&apos;s icon.
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                  When
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {HABIT_DAY_PARTS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setDayPart(option)}
                      aria-pressed={dayPart === option}
                      className="rounded-full px-3 py-1.5 text-[0.78rem] font-medium transition-colors"
                      style={{
                        background: dayPart === option ? "var(--bg-tint-strong)" : "var(--bg-tint)",
                        color: dayPart === option ? "var(--text)" : "var(--text-muted)",
                      }}
                    >
                      {HABIT_DAY_PART_LABELS[option]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                  Track by
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {GOAL_UNIT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => pickUnit(option.value)}
                      aria-pressed={goalUnit === option.value}
                      className="rounded-full px-3 py-1.5 text-[0.78rem] font-medium transition-colors"
                      style={{
                        background: goalUnit === option.value ? "var(--bg-tint-strong)" : "var(--bg-tint)",
                        color: goalUnit === option.value ? "var(--text)" : "var(--text-muted)",
                      }}
                      title={option.hint}
                    >
                      {option.label}
                    </button>
                  ))}
                  {goalUnit !== "check" ? (
                    <span className="inline-flex items-center gap-1.5">
                      <input
                        aria-label="Daily target"
                        type="number"
                        min={1}
                        step={goalUnit === "minutes" ? 5 : 1}
                        value={target}
                        onChange={(event) => setTarget(event.target.value)}
                        className="field h-9 w-20"
                      />
                      <span className="text-[0.78rem]" style={{ color: "var(--text-faint)" }}>
                        {goalUnit === "minutes" ? "min/day" : "per day"}
                      </span>
                    </span>
                  ) : null}
                </div>
              </div>

              <details className="rounded-[0.9rem] border px-3 py-2.5" style={{ borderColor: "var(--border-faint)" }}>
                <summary className="cursor-pointer list-none text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                  More options — cadence, fallback save, reminders…
                </summary>
                <div className="mt-3 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label htmlFor="habit-cadence" className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                        Cadence
                      </label>
                      <select
                        id="habit-cadence"
                        name="cadence"
                        className="field"
                        value={cadence}
                        onChange={(event) => setCadence(event.target.value as HabitCadence)}
                      >
                        {HABIT_CADENCES.map((option) => (
                          <option key={option} value={option}>
                            {HABIT_CADENCE_LABELS[option]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="habit-bucket" className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                        Bucket (sets the color)
                      </label>
                      <input id="habit-bucket" name="bucket" className="field" placeholder="exercise, reading, wellness…" />
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

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label htmlFor="habit-default-duration" className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                        Timer length (minutes)
                      </label>
                      <input
                        id="habit-default-duration"
                        name="defaultDurationMinutes"
                        type="number"
                        min={5}
                        step={5}
                        className="field"
                        placeholder="30"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="habit-reminder" className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                        Reminder time
                      </label>
                      <input id="habit-reminder" name="reminderTime" type="time" className="field" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="habit-notes" className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                      Why this matters
                    </label>
                    <input id="habit-notes" name="notes" className="field" placeholder="One line on why this is worth repeating" />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label htmlFor="habit-fallback" className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                        Fallback save
                      </label>
                      <input id="habit-fallback" name="fallbackTitle" className="field" placeholder="Smallest version that still counts" />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="habit-rescue" className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                        Rescue prompt
                      </label>
                      <input id="habit-rescue" name="rescuePrompt" className="field" placeholder="What to tell yourself on a bad day" />
                    </div>
                  </div>
                </div>
              </details>

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
