"use client";

// Past CSV / PDF imports, newest first, each with a Remove button that takes
// out only the rows that import added and puts back the hand-logged entries
// it confirmed. Other entries, moves and linked-bank rows are never touched.

import { useState, useTransition } from "react";
import { formatUSDFromCents } from "@/lib/money";
import { undoFinanceImport } from "../actions";

export type ImportBatchView = {
  /** ISO createdAt window the undo deletes. */
  from: string;
  to: string;
  /** e.g. "Nov 3, 2:14 PM". */
  importedLabel: string;
  /** e.g. "Jan 2 – Mar 30, 2025". */
  rangeLabel: string;
  count: number;
  /** Entries you'd logged that this import confirmed instead of copying. */
  confirmed: number;
  accounts: string[];
  spentCents: number;
  incomeCents: number;
};

function fmt(cents: number) {
  return formatUSDFromCents(cents, { maximumFractionDigits: 0 });
}

export function ImportHistory({ batches }: { batches: ImportBatchView[] }) {
  if (batches.length === 0) {
    return (
      <p className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
        No imports yet.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
        Removing an import takes out only the rows that file added. Entries you logged yourself stay, back to
        waiting for the bank.
      </p>
      <ul>
        {batches.map((b) => (
          <BatchRow key={b.from} batch={b} />
        ))}
      </ul>
    </div>
  );
}

function BatchRow({ batch }: { batch: ImportBatchView }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState<number | null>(null);
  const rows = `${batch.count} ${batch.count === 1 ? "row" : "rows"}`;
  const summary = batch.confirmed
    ? `${batch.count} new · ${batch.confirmed} matched what you'd logged`
    : rows;
  return (
    <li className="border-b py-2.5" style={{ borderColor: "var(--border-faint)", opacity: removed !== null ? 0.5 : 1 }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1">
          <p className="text-[0.875rem]" style={{ color: "var(--text)" }}>
            {batch.rangeLabel} · {summary}
          </p>
          <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
            Imported {batch.importedLabel}
            {batch.accounts.length ? ` · ${batch.accounts.join(", ")}` : ""}
          </p>
          <p className="text-[0.75rem] tabular" style={{ color: "var(--text-muted)" }}>
            Counted as {fmt(batch.spentCents)} spent and {fmt(batch.incomeCents)} income
          </p>
        </div>
        {removed !== null ? (
          <span className="text-[0.75rem]" style={{ color: "var(--text-muted)" }}>
            Removed {removed}
          </span>
        ) : (
          <button
            type="button"
            className="btn-ghost"
            disabled={pending}
            onClick={() => {
              if (!confirm(`Remove the ${rows} from this import? Your own entries stay.`)) return;
              start(async () => {
                setError(null);
                const r = await undoFinanceImport({ from: batch.from, to: batch.to });
                if (!r.ok) setError(r.error);
                else setRemoved(r.removed);
              });
            }}
          >
            {pending ? "Removing…" : "Remove"}
          </button>
        )}
      </div>
      {error ? (
        <p className="mt-1 text-[0.75rem]" style={{ color: "var(--accent-strong)" }} role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}
