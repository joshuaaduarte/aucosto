"use client";

import { useActionState, useEffect, useRef } from "react";
import { formatMinutes } from "@/lib/do";
import { startEntry, type StartState } from "./actions";

const initialState: StartState = undefined;

export function StartForm({
  suggestedCategories = [],
  suggestedTasks = [],
  suggestedHabits = [],
}: {
  suggestedCategories?: string[];
  suggestedTasks?: Array<{
    id: string;
    title: string;
    estimatedMinutes: number | null;
  }>;
  suggestedHabits?: Array<{
    id: string;
    title: string;
    targetLabel: string;
  }>;
}) {
  const [state, formAction, pending] = useActionState(
    startEntry,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const categoryRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);
  const doItemIdRef = useRef<HTMLInputElement>(null);
  const habitIdRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pending && !state?.error) {
      formRef.current?.reset();
      if (doItemIdRef.current) {
        doItemIdRef.current.value = "";
      }
      if (habitIdRef.current) {
        habitIdRef.current.value = "";
      }
    }
  }, [pending, state]);

  return (
    <article
      className="rounded-md p-5"
      style={{
        background: "var(--bg-page)",
        border: "1px solid var(--border-soft)",
      }}
    >
      <header className="mb-4">
        <p
          className="text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Start a session
        </p>
        <h2
          className="mt-1 text-[1rem] font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          What are you working on?
        </h2>
      </header>

      <form ref={formRef} action={formAction} className="space-y-4">
        <input ref={doItemIdRef} type="hidden" name="doItemId" />
        <input ref={habitIdRef} type="hidden" name="habitId" />

        <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
          <div className="space-y-1.5">
            <label
              htmlFor="label"
              className="block text-[0.75rem] font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              Session
            </label>
            <input
              ref={labelRef}
              id="label"
              name="label"
              type="text"
              required
              placeholder="What's being worked on?"
              className="field"
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="category"
              className="block text-[0.75rem] font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              Category <span style={{ color: "var(--text-faint)" }}>(optional)</span>
            </label>
            <input
              ref={categoryRef}
              id="category"
              name="category"
              type="text"
              placeholder="deep work, errands..."
              className="field"
            />
          </div>
        </div>

        {suggestedCategories.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="mr-1 text-[0.6875rem] font-medium uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              Recent
            </span>
            {suggestedCategories.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  if (categoryRef.current) {
                    categoryRef.current.value = suggestion;
                  }
                }}
                className="inline-flex items-center rounded px-1.5 py-0.5 text-[0.75rem] font-medium transition-colors"
                style={{
                  background: "var(--bg-tint)",
                  color: "var(--text-muted)",
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {suggestedTasks.length > 0 && (
          <div className="space-y-2">
            <p
              className="text-[0.6875rem] font-medium uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              Suggested from Do
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestedTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => {
                    if (labelRef.current) {
                      labelRef.current.value = task.title;
                    }
                    if (categoryRef.current) {
                      categoryRef.current.value = "do";
                    }
                    if (doItemIdRef.current) {
                      doItemIdRef.current.value = task.id;
                    }
                    if (habitIdRef.current) {
                      habitIdRef.current.value = "";
                    }
                  }}
                  className="inline-flex items-center rounded px-2 py-1 text-[0.75rem] font-medium transition-colors"
                  style={{
                    background: "var(--bg-tint)",
                    color: "var(--text-muted)",
                  }}
                >
                  {task.title}
                  {task.estimatedMinutes
                    ? ` · ${formatMinutes(task.estimatedMinutes)}`
                    : ""}
                </button>
              ))}
            </div>
          </div>
        )}

        {suggestedHabits.length > 0 && (
          <div className="space-y-2">
            <p
              className="text-[0.6875rem] font-medium uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              Suggested habits
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestedHabits.map((habit) => (
                <button
                  key={habit.id}
                  type="button"
                  onClick={() => {
                    if (labelRef.current) {
                      labelRef.current.value = habit.title;
                    }
                    if (categoryRef.current) {
                      categoryRef.current.value = "habit";
                    }
                    if (doItemIdRef.current) {
                      doItemIdRef.current.value = "";
                    }
                    if (habitIdRef.current) {
                      habitIdRef.current.value = habit.id;
                    }
                  }}
                  className="inline-flex items-center rounded px-2 py-1 text-[0.75rem] font-medium transition-colors"
                  style={{
                    background: "var(--bg-tint)",
                    color: "var(--text-muted)",
                  }}
                >
                  {habit.title}
                  {` · ${habit.targetLabel}`}
                </button>
              ))}
            </div>
          </div>
        )}

        {state?.error && (
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
        )}

        <div className="flex items-center justify-end pt-1">
          <button type="submit" disabled={pending} className="btn-ink">
            {pending ? "Starting..." : "Start session"}
          </button>
        </div>
      </form>
    </article>
  );
}
