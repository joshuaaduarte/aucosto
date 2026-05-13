"use client";

import { useActionState, useRef, useEffect } from "react";
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
    <form ref={formRef} action={formAction} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
          className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-6 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Importing…" : "Import"}
        </button>
      </div>
      {state && "ok" in state && state.ok && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          Imported {state.imported} transactions
          {state.skipped > 0 ? ` · ${state.skipped} skipped` : ""}.
        </p>
      )}
      {state && "ok" in state && !state.ok && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
