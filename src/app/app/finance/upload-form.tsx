"use client";

import { useActionState, useEffect, useRef } from "react";
import { formatUSDFromCents } from "@/lib/money";
import { uploadCsv, uploadStatementPdf, type UploadState } from "./actions";

const initialState: UploadState = undefined;

export type ImportAccountOption = { id: string; name: string };

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
        {state.imported > 0 ? `${state.imported} new entries` : "no new entries"}
      </span>
      {state.matched ? (
        <>
          {" · "}
          <span className="not-italic font-mono tabular text-ink-soft">{state.matched}</span> matched what you&rsquo;d
          already logged
          {state.adjusted ? ` (${state.adjusted} with the bank’s amount, like a tip)` : ""}
        </>
      ) : null}
      {state.deduped > 0 ? (
        <>
          {" · "}
          <span className="not-italic font-mono tabular text-ink-fade">
            {state.deduped}
          </span>{" "}
          duplicates ignored
        </>
      ) : null}
      {state.flipped ? (
        <>
          {" · "}purchases on this card were listed as positive, so they were turned into spending
        </>
      ) : null}
      {state.balanceCheck ? (
        state.balanceCheck.diffCents === 0 ? (
          <>{" · "}adds up: the file&rsquo;s balance on {state.balanceCheck.day} matches yours</>
        ) : (
          <>
            {" · "}
            <span className="not-italic font-semibold">
              doesn&rsquo;t add up by {formatUSDFromCents(Math.abs(state.balanceCheck.diffCents))} on{" "}
              {state.balanceCheck.day}
            </span>
            : a month may be missing between this file and your balance, or a row is off
          </>
        )
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
  accounts,
}: {
  accounts: ImportAccountOption[];
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
        {accounts.length > 0 ? (
          <label className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
            Which account is this file from?
            <select name="accountId" defaultValue="" className="field mt-1 block w-full sm:w-auto">
              <option value="">Not sure / several accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
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

export function UploadForm({ accounts = [] }: { accounts?: ImportAccountOption[] }) {
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
        accounts={accounts}
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
        accounts={accounts}
        pending={pdfPending}
        state={pdfState}
      />
    </div>
  );
}
