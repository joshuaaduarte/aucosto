"use client";

import { useActionState, useEffect, useRef } from "react";
import { uploadCsv, uploadStatementPdf, type UploadState } from "./actions";

const initialState: UploadState = undefined;

function UploadStatus({ state }: { state: UploadState }) {
  if (!state || !("ok" in state)) return null;

  if (!state.ok) {
    return <p className="mt-3 text-sm text-red-600 dark:text-red-400">{state.error}</p>;
  }

  const sourceLabel = state.source === "statement" ? `${state.bankLabel ?? "Statement PDF"} import` : "CSV import";

  return (
    <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">
      {sourceLabel}: {state.imported > 0 ? `imported ${state.imported} transactions` : "no new transactions imported"}
      {state.deduped > 0 ? ` · ${state.deduped} duplicates ignored` : ""}
      {state.skipped > 0 ? ` · ${state.skipped} skipped` : ""}.
    </p>
  );
}

export function UploadForm() {
  const [csvState, csvAction, csvPending] = useActionState(uploadCsv, initialState);
  const [pdfState, pdfAction, pdfPending] = useActionState(uploadStatementPdf, initialState);
  const csvFormRef = useRef<HTMLFormElement>(null);
  const pdfFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (csvState?.ok) csvFormRef.current?.reset();
  }, [csvState]);

  useEffect(() => {
    if (pdfState?.ok) pdfFormRef.current?.reset();
  }, [pdfState]);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <form
        ref={csvFormRef}
        action={csvAction}
        className="rounded-[1.5rem] border border-zinc-200/80 bg-white/90 p-5 shadow-[0_20px_60px_-45px_rgba(24,24,27,0.32)] dark:border-zinc-800/80 dark:bg-zinc-900/90 dark:shadow-none"
      >
        <div className="flex flex-col gap-4">
          <div className="max-w-xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">Import CSV</p>
            <p className="mt-2 text-sm text-zinc-500">
              Bring in a bank or card CSV to refresh transaction history, recurring signals, and spending pace.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="file"
              name="file"
              accept=".csv,text/csv"
              required
              className="block min-h-11 w-full rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-3 py-3 text-sm text-zinc-700 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-zinc-900 hover:file:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-300 dark:file:bg-zinc-800 dark:file:text-zinc-100 dark:hover:file:bg-zinc-700"
            />
            <button
              type="submit"
              disabled={csvPending}
              className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-xl bg-zinc-900 px-6 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-700 disabled:opacity-50 sm:w-auto dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {csvPending ? "Importing…" : "Import CSV"}
            </button>
          </div>
        </div>
        <UploadStatus state={csvState} />
      </form>

      <form
        ref={pdfFormRef}
        action={pdfAction}
        className="rounded-[1.5rem] border border-zinc-200/80 bg-white/90 p-5 shadow-[0_20px_60px_-45px_rgba(24,24,27,0.32)] dark:border-zinc-800/80 dark:bg-zinc-900/90 dark:shadow-none"
      >
        <div className="flex flex-col gap-4">
          <div className="max-w-xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">Import statement PDF</p>
            <p className="mt-2 text-sm text-zinc-500">
              New foundation for PDF statements with bank-specific parsing hooks. Current detectors target Chase, Discover, Citi, Wells Fargo, and Apple Card layouts.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="file"
              name="file"
              accept=".pdf,application/pdf"
              required
              className="block min-h-11 w-full rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-3 py-3 text-sm text-zinc-700 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-zinc-900 hover:file:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-300 dark:file:bg-zinc-800 dark:file:text-zinc-100 dark:hover:file:bg-zinc-700"
            />
            <button
              type="submit"
              disabled={pdfPending}
              className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-xl bg-zinc-900 px-6 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-700 disabled:opacity-50 sm:w-auto dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {pdfPending ? "Reading…" : "Import PDF"}
            </button>
          </div>
        </div>
        <UploadStatus state={pdfState} />
      </form>
    </div>
  );
}
