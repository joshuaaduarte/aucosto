"use client";

import { useActionState, useRef, useEffect } from "react";
import { startEntry, type StartState } from "./actions";

const initialState: StartState = undefined;

export function StartForm() {
  const [state, formAction, pending] = useActionState(
    startEntry,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state?.error) {
      formRef.current?.reset();
    }
  }, [pending, state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <div className="flex-1 space-y-1">
        <label
          htmlFor="label"
          className="block text-xs font-medium text-zinc-500"
        >
          What are you doing?
        </label>
        <input
          id="label"
          name="label"
          type="text"
          required
          placeholder="e.g. deep work on aucosto"
          className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500 dark:focus:border-zinc-100 dark:focus:ring-zinc-100"
        />
      </div>
      <div className="space-y-1 sm:w-40">
        <label
          htmlFor="category"
          className="block text-xs font-medium text-zinc-500"
        >
          Category
        </label>
        <input
          id="category"
          name="category"
          type="text"
          placeholder="optional"
          className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500 dark:focus:border-zinc-100 dark:focus:ring-zinc-100"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-6 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "Starting…" : "Start"}
      </button>
      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400 sm:basis-full">
          {state.error}
        </p>
      )}
    </form>
  );
}
