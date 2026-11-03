"use client";

// One screen to type in today's balances. Two uses:
//  - Catch up (after a gap): every account, plus "stop waiting on older
//    entries" so the months you skipped don't hang around as to-dos.
//  - Monthly check-in: savings, 401k and brokerage only, with each change
//    split into what you put in and what the market did.
// Blank rows are left as they are.

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatUSDFromCents } from "@/lib/money";
import { formatAccountKind } from "@/lib/finance-accounts";
import { catchUpFinance } from "../actions";

export type CheckInRowView = {
  id: string;
  name: string;
  kind: string;
  balanceCents: number;
  /** Plain words, e.g. "Sep 30". */
  updatedLabel: string;
  daysSinceUpdate: number;
  addedSinceCents: number;
  owed: boolean;
};

function fmt(cents: number) {
  return formatUSDFromCents(cents);
}

function signed(cents: number) {
  if (cents === 0) return "$0";
  return `${cents > 0 ? "+" : "−"}${formatUSDFromCents(Math.abs(cents), { maximumFractionDigits: 0 })}`;
}

function parseBalance(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!/^-?\d*\.?\d{0,2}$/.test(cleaned) || cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  return Math.round(Number(cleaned) * 100);
}

export function BalanceCheckIn({
  rows,
  mode,
  confirmBefore,
}: {
  rows: CheckInRowView[];
  mode: "catch_up" | "monthly";
  /** Catch up only: older waiting entries to stop asking about. */
  confirmBefore: { day: string; label: string; count: number } | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [confirmOld, setConfirmOld] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const typed = Object.values(values).filter((v) => v.trim() !== "").length;

  const save = () => {
    setError(null);
    for (const row of rows) {
      const v = values[row.id]?.trim();
      if (v && parseBalance(v) === null) {
        setError(`Check ${row.name}: use a number like 1520.40.`);
        return;
      }
    }
    start(async () => {
      const result = await catchUpFinance({
        balances: rows.map((r) => ({ accountId: r.id, balance: values[r.id] ?? "" })),
        confirmBefore: mode === "catch_up" && confirmOld && confirmBefore?.count ? confirmBefore.day : null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const parts = [`Updated ${result.updated} ${result.updated === 1 ? "balance" : "balances"}`];
      if (result.confirmed) parts.push(`cleared ${result.confirmed} older ${result.confirmed === 1 ? "entry" : "entries"}`);
      setDone(`${parts.join(" and ")}.`);
      setValues({});
      router.refresh();
    });
  };

  if (done) {
    return (
      <div className="space-y-3 rounded-md border p-5" style={{ borderColor: "var(--border-soft)" }}>
        <p className="text-[0.9375rem] font-semibold" style={{ color: "var(--text)" }}>
          {done}
        </p>
        <p className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
          {mode === "catch_up"
            ? "You're caught up. From here, log spending as it happens and check statements once a month."
            : "Net worth is up to date. See you next month."}
        </p>
        <Link href="/app/finance" className="btn-ink inline-flex">
          Back to Finance
        </Link>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-md py-10 text-center text-[0.875rem]" style={{ color: "var(--text-muted)", border: "1px dashed var(--border)" }}>
        {mode === "monthly"
          ? "No savings, investment or retirement accounts yet. Add them on the Accounts tab."
          : "No accounts yet. Add them on the Accounts tab."}
      </p>
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <ul className="divide-y rounded-md border" style={{ borderColor: "var(--border-soft)" }}>
        {rows.map((row) => {
          const value = values[row.id] ?? "";
          const next = value.trim() ? parseBalance(value) : null;
          const change = next !== null ? next - row.balanceCents : null;
          const market = change !== null ? change - row.addedSinceCents : null;
          return (
            <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3" style={{ borderColor: "var(--border-faint)" }}>
              <div className="min-w-[10rem] flex-1">
                <p className="text-[0.875rem] font-medium" style={{ color: "var(--text)" }}>
                  {row.name}
                </p>
                <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                  {formatAccountKind(row.kind)} · {row.owed ? "owed " : ""}
                  {fmt(row.balanceCents)} on {row.updatedLabel}
                  {row.daysSinceUpdate > 30 ? ` (${row.daysSinceUpdate} days ago)` : ""}
                </p>
                {mode === "monthly" && change !== null ? (
                  <p className="text-[0.75rem] tabular" style={{ color: "var(--text-muted)" }}>
                    {signed(change)} since then: {signed(row.addedSinceCents)} you put in, {signed(market ?? 0)} growth
                  </p>
                ) : mode === "monthly" && row.addedSinceCents > 0 ? (
                  <p className="text-[0.75rem] tabular" style={{ color: "var(--text-faint)" }}>
                    You&rsquo;ve put in {fmt(row.addedSinceCents)} since then
                  </p>
                ) : null}
              </div>
              <label className="relative">
                <span className="sr-only">New balance for {row.name}</span>
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }}>
                  $
                </span>
                <input
                  value={value}
                  onChange={(e) => setValues({ ...values, [row.id]: e.target.value })}
                  inputMode="decimal"
                  placeholder={(row.balanceCents / 100).toFixed(2)}
                  className="field w-[9.5rem] pl-7 tabular"
                />
              </label>
            </li>
          );
        })}
      </ul>

      {mode === "catch_up" && confirmBefore && confirmBefore.count > 0 ? (
        <label className="flex items-start gap-2.5 text-[0.8125rem]" style={{ color: "var(--text)" }}>
          <input type="checkbox" checked={confirmOld} onChange={(e) => setConfirmOld(e.target.checked)} className="mt-0.5" />
          <span>
            Start fresh from {confirmBefore.label}: stop waiting on {confirmBefore.count} older{" "}
            {confirmBefore.count === 1 ? "entry" : "entries"} that never met a statement. Nothing is deleted.
          </span>
        </label>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn-ink">
          {pending ? "Saving…" : typed ? `Save ${typed} ${typed === 1 ? "balance" : "balances"}` : "Save"}
        </button>
        <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
          Leave a row blank to keep it as it is. Cards and loans: type what you owe.
        </p>
      </div>
      {error ? (
        <p className="text-[0.75rem]" style={{ color: "var(--accent-strong)" }} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
