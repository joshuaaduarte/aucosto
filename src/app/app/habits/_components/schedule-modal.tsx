"use client";

import { useActionState, useEffect, useRef } from "react";
import type { HabitSummary } from "@/lib/services/habits";
import { type HabitScheduleState, scheduleHabitAction } from "../actions";
import { defaultScheduleStart } from "./habit-card-helpers";

export function ScheduleModal({ habit, onClose }: { habit: HabitSummary; onClose: () => void }) {
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
