"use client";

import { useActionState, useEffect, useRef } from "react";
import { uploadCsv, type UploadState } from "./actions";

const initialState: UploadState = undefined;

export function UploadForm() {
  const [state, formAction, pending] = useActionState(uploadCsv, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "ok" in state && state.ok) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">Import activity</p>
          <p className="mt-2 text-sm text-zinc-500">
            Bring in a bank or card CSV to refresh transaction history, recurring signals, and spending pace.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="block w-full text-sm text-zinc-700 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-zinc-900 hover:file:bg-zinc-200 dark:text-zinc-300 dark:file:bg-zinc-800 dark:file:text-zinc-100 dark:hover:file:bg-zinc-700"
          />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-zinc-900 px-6 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {pending ? "Importing…" : "Import CSV"}
          </button>
        </div>
      </div>
      {state && "ok" in state && state.ok && (
        <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">
          {state.imported > 0 ? `Imported ${state.imported} transactions` : "No new transactions imported"}
          {state.deduped > 0 ? ` · ${state.deduped} duplicates ignored` : ""}
          {state.skipped > 0 ? ` · ${state.skipped} skipped` : ""}.
        </p>
      )}
      {state && "ok" in state && !state.ok && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
