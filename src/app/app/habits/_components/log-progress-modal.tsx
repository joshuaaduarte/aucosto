"use client";

import { useActionState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { formatHabitQuantity, type HabitGoalUnit } from "@/lib/habits";
import type { HabitSummary } from "@/lib/services/habits";
import { type HabitLogState, logHabitAction } from "../actions";
import { MetricTile } from "./stat-tiles";
import { useBodyScrollLock } from "../../_components/use-body-scroll-lock";

export function LogProgressModal({ habit, onClose }: { habit: HabitSummary; onClose: () => void }) {
  useBodyScrollLock();
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

  // Portal to <body>: ancestor transforms/filters (e.g. animated page
  // sections) would otherwise become the containing block for this
  // fixed-position backdrop and drag the modal into the document flow,
  // letting the bottom-fixed tab/timer bars render over it.
  return createPortal(
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
              inputMode="numeric"
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
    </div>,
    document.body,
  );
}
