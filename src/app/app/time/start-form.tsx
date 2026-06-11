"use client";

import { useActionState, useEffect, useRef } from "react";
import { startEntry, type StartState } from "./actions";

const initialState: StartState = undefined;

export function StartForm({
  suggestedCategories = [],
  quickStart,
}: {
  suggestedCategories?: string[];
  quickStart?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(
    startEntry,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const categoryRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pending && !state?.error) {
      formRef.current?.reset();
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
          What are you doing right now?
        </h2>
      </header>

      {quickStart ? (
        <>
          <div className="mb-4">{quickStart}</div>
          <p
            className="mb-3 border-t pt-3 text-[0.6875rem] font-medium uppercase tracking-wider"
            style={{
              color: "var(--text-faint)",
              borderColor: "var(--border-faint)",
            }}
          >
            Or type your own
          </p>
        </>
      ) : null}

      <form ref={formRef} action={formAction} className="space-y-4">
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
