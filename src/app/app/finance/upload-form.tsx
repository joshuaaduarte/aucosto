"use client";

import { useActionState, useEffect, useRef } from "react";
import { uploadCsv, uploadStatementPdf, type UploadState } from "./actions";

const initialState: UploadState = undefined;

function UploadStatus({ state }: { state: UploadState }) {
  if (!state || !("ok" in state)) return null;

  if (!state.ok) {
    return (
      <p className="mt-3 font-serif text-sm italic text-oxblood">{state.error}</p>
    );
  }

  const sourceLabel =
    state.source === "statement"
      ? `${state.bankLabel ?? "Statement"} import`
      : "CSV import";

  return (
    <p className="mt-3 font-serif text-sm italic text-verdigris">
      {sourceLabel}:{" "}
      <span className="not-italic font-mono tabular text-ink-soft">
        {state.imported > 0 ? `${state.imported} entries posted` : "no new entries"}
      </span>
      {state.deduped > 0 ? (
        <>
          {" · "}
          <span className="not-italic font-mono tabular text-ink-fade">
            {state.deduped}
          </span>{" "}
          duplicates ignored
        </>
      ) : null}
      {state.skipped > 0 ? (
        <>
          {" · "}
          <span className="not-italic font-mono tabular text-ink-fade">
            {state.skipped}
          </span>{" "}
          skipped
        </>
      ) : null}
      .
    </p>
  );
}

function UploadCard({
  title,
  caption,
  accept,
  buttonLabel,
  pendingLabel,
  formRef,
  formAction,
  pending,
  state,
}: {
  title: string;
  caption: string;
  accept: string;
  buttonLabel: string;
  pendingLabel: string;
  formRef: React.RefObject<HTMLFormElement | null>;
  formAction: (formData: FormData) => void;
  pending: boolean;
  state: UploadState;
}) {
  return (
    <form ref={formRef} action={formAction} className="rule-t border-ink/40 pt-4">
      <div className="flex flex-col gap-4">
        <div className="max-w-xl">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-ink-fade">
            {title}
          </p>
          <p className="mt-2 font-serif text-sm italic leading-relaxed text-ink-fade">
            {caption}
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="file"
            name="file"
            accept={accept}
            required
            className="block min-h-11 w-full border border-dashed border-rule bg-paper-deep/40 px-3 py-3 font-serif text-sm text-ink-soft file:mr-4 file:border file:border-ink file:bg-ink file:px-3 file:py-2 file:text-sm file:font-medium file:text-paper hover:file:bg-oxblood hover:file:border-oxblood"
          />
          <button type="submit" disabled={pending} className="btn-ink shrink-0">
            {pending ? pendingLabel : buttonLabel}
          </button>
        </div>
      </div>
      <UploadStatus state={state} />
    </form>
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
    <div className="grid gap-10 xl:grid-cols-2 xl:gap-14">
      <UploadCard
        title="Import a CSV"
        caption="Bring in a bank or card CSV to refresh entries, recurring signals, and spending pace."
        accept=".csv,text/csv"
        buttonLabel="Post entries"
        pendingLabel="Posting…"
        formRef={csvFormRef}
        formAction={csvAction}
        pending={csvPending}
        state={csvState}
      />
      <UploadCard
        title="Import a Statement"
        caption="PDF statements parsed via bank-specific layouts. Current detectors target Chase, Discover, Citi, Wells Fargo, and Apple Card."
        accept=".pdf,application/pdf"
        buttonLabel="Read statement"
        pendingLabel="Reading…"
        formRef={pdfFormRef}
        formAction={pdfAction}
        pending={pdfPending}
        state={pdfState}
      />
    </div>
  );
}
