"use client";

// Schedule a task straight from its card: creates a linked calendar block
// (sourceTool "do") prefilled with the task title and estimate, and marks
// the task scheduled. Completing the block later syncs back to the task.

import { useActionState, useEffect, useRef, useState } from "react";
import { fillIsoWindowFields } from "@/lib/wall-clock";
import { scheduleDoItemAction, type ScheduleDoItemState } from "./actions";
import { useBodyScrollLock } from "../_components/use-body-scroll-lock";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function defaultWindow(estimatedMinutes: number | null) {
  const start = new Date();
  // Next quarter-hour, at least 5 minutes out.
  start.setMinutes(start.getMinutes() + 5);
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0);
  const end = new Date(start.getTime() + (estimatedMinutes ?? 30) * 60000);
  return {
    date: start.toLocaleDateString("en-CA"),
    start: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    end: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
  };
}

export function ScheduleTaskModal({
  item,
  onClose,
}: {
  item: { id: string; title: string; estimatedMinutes: number | null };
  onClose: () => void;
}) {
  useBodyScrollLock();
  const [state, formAction, pending] = useActionState<ScheduleDoItemState, FormData>(
    scheduleDoItemAction,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);
  const [defaults] = useState(() => defaultWindow(item.estimatedMinutes));

  useEffect(() => {
    if (pending) {
      submittedRef.current = true;
      return;
    }
    if (submittedRef.current && !state?.error) {
      submittedRef.current = false;
      const timer = window.setTimeout(() => onClose(), 0);
      return () => window.clearTimeout(timer);
    }
  }, [onClose, pending, state]);

  return (
    <div className="calendar-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`do-schedule-title-${item.id}`}
        className="calendar-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className="text-[0.6875rem] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              Schedule task
            </p>
            <h2
              id={`do-schedule-title-${item.id}`}
              className="mt-1 text-[1.125rem] font-semibold tracking-tight"
              style={{ color: "var(--text)" }}
            >
              Protect time for {item.title}
            </h2>
          </div>
          <button
            type="button"
            className="btn-icon h-8 w-8 rounded-full border"
            style={{ borderColor: "var(--border-faint)" }}
            onClick={onClose}
            aria-label="Close schedule modal"
          >
            x
          </button>
        </div>

        <form
          ref={formRef}
          action={formAction}
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            fillIsoWindowFields(event.currentTarget);
            submittedRef.current = true;
          }}
        >
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="title" value={item.title} />
          <input type="hidden" name="startsAtIso" defaultValue="" />
          <input type="hidden" name="endsAtIso" defaultValue="" />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <label
                htmlFor={`do-schedule-date-${item.id}`}
                className="block text-[0.75rem] font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                Date
              </label>
              <input
                id={`do-schedule-date-${item.id}`}
                name="date"
                type="date"
                required
                defaultValue={defaults.date}
                className="field"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor={`do-schedule-start-${item.id}`}
                className="block text-[0.75rem] font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                Start
              </label>
              <input
                id={`do-schedule-start-${item.id}`}
                name="start"
                type="time"
                required
                defaultValue={defaults.start}
                className="field"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor={`do-schedule-end-${item.id}`}
                className="block text-[0.75rem] font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                End
              </label>
              <input
                id={`do-schedule-end-${item.id}`}
                name="end"
                type="time"
                required
                defaultValue={defaults.end}
                className="field"
              />
            </div>
          </div>

          <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
            {item.estimatedMinutes
              ? `Prefilled from the ${item.estimatedMinutes}m estimate.`
              : "No estimate on the task — defaulting to 30 minutes."}
          </p>

          {state?.error ? (
            <p
              className="rounded-md px-3 py-2 text-[0.8125rem]"
              style={{
                background: "var(--accent-tint)",
                color: "var(--accent-strong)",
                border: "1px solid var(--accent-tint-strong)",
              }}
            >
              {state.error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button type="button" className="btn-ghost w-full sm:w-auto" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className="btn-ink w-full sm:w-auto">
              {pending ? "Scheduling..." : "Add to calendar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
