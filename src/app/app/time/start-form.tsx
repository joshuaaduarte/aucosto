"use client";

import { useActionState, useEffect, useRef } from "react";
import { startEntry, type StartState } from "./actions";

const initialState: StartState = undefined;

export function StartForm({
  suggestedCategories = [],
}: {
  suggestedCategories?: string[];
}) {
  const [state, formAction, pending] = useActionState(
    startEntry,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const categoryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pending && !state?.error) {
      formRef.current?.reset();
    }
  }, [pending, state]);

  return (
    <article className="rule-t rule-b border-ink py-8 sm:py-10">
      <header className="mb-7 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.26em] text-ink-fade">
            Open a fresh dispatch
          </p>
          <h2 className="mt-1.5 font-display text-3xl font-medium italic tracking-[-0.02em] text-ink sm:text-4xl">
            Set the column.
          </h2>
        </div>
        <p className="max-w-sm font-serif text-sm italic text-ink-fade">
          One press at a time. Opening a new column closes any prior dispatch in
          progress.
        </p>
      </header>

      <form ref={formRef} action={formAction} className="space-y-6">
        <div className="grid gap-x-10 gap-y-6 md:grid-cols-[1.6fr_1fr]">
          <div>
            <label
              htmlFor="label"
              className="block font-mono text-[0.625rem] uppercase tracking-[0.22em] text-ink-fade"
            >
              The matter at hand
            </label>
            <input
              id="label"
              name="label"
              type="text"
              required
              placeholder="What is being worked on?"
              className="field font-display text-xl"
            />
          </div>
          <div>
            <label
              htmlFor="category"
              className="block font-mono text-[0.625rem] uppercase tracking-[0.22em] text-ink-fade"
            >
              Column (optional)
            </label>
            <input
              ref={categoryRef}
              id="category"
              name="category"
              type="text"
              placeholder="e.g. deep work, errands…"
              className="field font-display text-xl italic"
            />
          </div>
        </div>

        {suggestedCategories.length > 0 ? (
          <div className="rule-soft-t border-rule pt-4">
            <p className="mb-3 font-mono text-[0.625rem] uppercase tracking-[0.22em] text-ink-fade">
              Recently used columns
            </p>
            <div className="no-scrollbar flex flex-wrap gap-x-5 gap-y-2">
              {suggestedCategories.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    if (categoryRef.current) categoryRef.current.value = suggestion;
                  }}
                  className="font-serif text-sm italic text-ink-fade transition-colors hover:text-ink hover:underline underline-offset-4 decoration-rule"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {state?.error && (
          <p className="font-serif text-sm italic text-oxblood">
            {state.error}
          </p>
        )}

        <div className="rule-soft-t border-rule pt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <button type="submit" disabled={pending} className="btn-ink">
            {pending ? "Opening dispatch…" : "Open the dispatch  →"}
          </button>
        </div>
      </form>
    </article>
  );
}
