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
    <div className="rounded-[1.75rem] border border-zinc-200/80 bg-white/90 p-5 shadow-[0_24px_70px_-50px_rgba(24,24,27,0.32)] dark:border-zinc-800/80 dark:bg-zinc-900/90 dark:shadow-none sm:p-6">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            Start tracking
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-2xl">
            Capture the next block before the day drifts.
          </h2>
        </div>
        <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
          One timer at a time. Starting a new one stops the previous session automatically.
        </p>
      </div>

      <form
        ref={formRef}
        action={formAction}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end">
          <div className="space-y-1.5">
            <label
              htmlFor="label"
              className="block text-xs font-medium uppercase tracking-[0.16em] text-zinc-500"
            >
              What are you doing?
            </label>
            <input
              id="label"
              name="label"
              type="text"
              required
              placeholder="e.g. deep work on aucosto"
              className="block min-h-12 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500 dark:focus:border-zinc-100 dark:focus:ring-zinc-100"
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="category"
              className="block text-xs font-medium uppercase tracking-[0.16em] text-zinc-500"
            >
              Category
            </label>
            <input
              ref={categoryRef}
              id="category"
              name="category"
              type="text"
              placeholder="optional"
              className="block min-h-12 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500 dark:focus:border-zinc-100 dark:focus:ring-zinc-100"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-zinc-900 px-6 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {pending ? "Starting…" : "Start timer"}
          </button>
        </div>

        {suggestedCategories.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
            {suggestedCategories.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  if (categoryRef.current) categoryRef.current.value = suggestion;
                }}
                className="inline-flex min-h-10 items-center rounded-full border border-zinc-200 bg-zinc-50 px-3.5 text-sm text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        {state?.error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}
      </form>
    </div>
  );
}
