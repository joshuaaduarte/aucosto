"use client";

import { useActionState, useEffect, useRef } from "react";
import { DO_LANE_LABELS, DO_LANES } from "@/lib/do";
import { createDoItemAction, type DoState } from "./actions";

const initialState: DoState = undefined;

export function DoCreateForm() {
  const [state, formAction, pending] = useActionState(
    createDoItemAction,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state?.error) {
      formRef.current?.reset();
    }
  }, [pending, state]);

  return (
    <section
      className="rounded-md border p-5"
      style={{
        borderColor: "var(--border-soft)",
        background: "var(--bg-page)",
      }}
    >
      <p
        className="text-[0.6875rem] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-faint)" }}
      >
        Add to the Do List
      </p>
      <h2
        className="mt-1 text-[1rem] font-semibold tracking-tight"
        style={{ color: "var(--text)" }}
      >
        Capture it with enough shape to act on it later.
      </h2>

      <form ref={formRef} action={formAction} className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="title"
            className="block text-[0.75rem] font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            Task
          </label>
          <input
            id="title"
            name="title"
            required
            placeholder="Follow up with florist, sketch homepage concept, long run"
            className="field"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <div className="space-y-1.5">
            <label
              htmlFor="lane"
              className="block text-[0.75rem] font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              When
            </label>
            <select id="lane" name="lane" defaultValue="next" className="field">
              {DO_LANES.map((lane) => (
                <option key={lane} value={lane}>
                  {DO_LANE_LABELS[lane]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="estimatedMinutes"
              className="block text-[0.75rem] font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              Estimate
            </label>
            <input
              id="estimatedMinutes"
              name="estimatedMinutes"
              type="number"
              min={5}
              step={5}
              placeholder="45"
              className="field"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="notes"
            className="block text-[0.75rem] font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            Notes <span style={{ color: "var(--text-faint)" }}>(optional)</span>
          </label>
          <input id="notes" name="notes" className="field" />
        </div>

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

        <div className="flex justify-end">
          <button type="submit" disabled={pending} className="btn-ink">
            {pending ? "Saving..." : "Add task"}
          </button>
        </div>
      </form>
    </section>
  );
}
