"use client";

import { useActionState, useState, useTransition } from "react";
import { FINANCE_CATEGORIES } from "@/lib/finance-categories";
import { BILL_CADENCES, formatCadence } from "@/lib/finance-planning";
import {
  archiveFinanceBill,
  completeMoneyDate,
  deleteFinanceBudget,
  markFinanceBillPaid,
  saveFinanceBill,
  saveFinanceBudget,
  type PlanningState,
} from "../actions";

function ErrorLine({ state }: { state: PlanningState }) {
  if (!state || state.ok) return null;
  return (
    <p className="text-[0.75rem]" style={{ color: "var(--accent-strong)" }} role="alert">
      {state.error}
    </p>
  );
}

export function BudgetForm({ usedCategories }: { usedCategories: string[] }) {
  const [state, action, pending] = useActionState(saveFinanceBudget, undefined);
  const open = FINANCE_CATEGORIES.filter((c) => c !== "Income");
  return (
    <form action={action} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select name="category" className="field max-w-[11rem]" aria-label="Category" defaultValue={open.find((c) => !usedCategories.includes(c))}>
          {open.map((category) => (
            <option key={category} value={category}>
              {category}
              {usedCategories.includes(category) ? " (update)" : ""}
            </option>
          ))}
        </select>
        <input name="limit" inputMode="decimal" placeholder="$ per month" aria-label="Monthly limit" className="field max-w-[8rem]" required />
        <button type="submit" disabled={pending} className="btn-ghost">
          {pending ? "Saving…" : "Set budget"}
        </button>
      </div>
      <ErrorLine state={state} />
    </form>
  );
}

export function RemoveBudgetButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="text-[0.6875rem] [@media(pointer:coarse)]:opacity-100 opacity-60 hover:opacity-100"
      style={{ color: "var(--text-faint)" }}
      disabled={pending}
      onClick={() => start(async () => void (await deleteFinanceBudget(id)))}
      aria-label="Remove budget"
    >
      Remove
    </button>
  );
}

export function BillForm({
  defaults,
  onDone,
}: {
  defaults?: { name?: string; amount?: string; nextDueAt?: string };
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(async (prev: PlanningState, formData: FormData) => {
    const result = await saveFinanceBill(prev, formData);
    if (result?.ok) onDone?.();
    return result;
  }, undefined);
  return (
    <form action={action} className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <input name="name" required defaultValue={defaults?.name} placeholder="Name (Rent, Car insurance)" aria-label="Bill name" className="field" />
        <input name="amount" inputMode="decimal" defaultValue={defaults?.amount} placeholder="Amount (optional)" aria-label="Amount" className="field" />
        <select name="cadence" defaultValue="monthly" className="field" aria-label="Repeats">
          {BILL_CADENCES.map((cadence) => (
            <option key={cadence} value={cadence}>
              {formatCadence(cadence)}
            </option>
          ))}
        </select>
        <input name="nextDueAt" type="date" required defaultValue={defaults?.nextDueAt} aria-label="Next due" className="field" />
      </div>
      <label className="flex items-center gap-2 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
        <input type="checkbox" name="autopay" /> Paid automatically
      </label>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className="btn-ink">
          {pending ? "Saving…" : "Add bill"}
        </button>
        {onDone ? (
          <button type="button" className="btn-ghost" onClick={onDone}>
            Cancel
          </button>
        ) : null}
      </div>
      <ErrorLine state={state} />
    </form>
  );
}

export function AddBill({
  suggestions,
}: {
  suggestions: Array<{ name: string; amount: string; nextDueAt: string }>;
}) {
  const [open, setOpen] = useState<null | { name?: string; amount?: string; nextDueAt?: string }>(null);
  if (open) return <BillForm key={open.name ?? "new"} defaults={open} onDone={() => setOpen(null)} />;
  return (
    <div className="space-y-2">
      <button type="button" className="btn-ghost" onClick={() => setOpen({})}>
        Add a bill or renewal
      </button>
      {suggestions.length ? (
        <div className="space-y-1">
          <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
            Looks recurring. Track it?
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s.name}
                type="button"
                className="rounded-full border px-2.5 py-1 text-[0.75rem]"
                style={{ borderColor: "var(--border-soft)", color: "var(--text-muted)" }}
                onClick={() => setOpen(s)}
              >
                + {s.name} · ${s.amount}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function BillActions({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        className="btn-ghost"
        disabled={pending}
        onClick={() => start(async () => void (await markFinanceBillPaid(id)))}
      >
        Paid
      </button>
      <button
        type="button"
        className="btn-icon"
        disabled={pending}
        aria-label="Remove bill"
        title="Remove bill"
        onClick={() => {
          if (confirm("Stop tracking this bill?")) start(async () => void (await archiveFinanceBill(id)));
        }}
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden>
          <path d="M3 3l8 8M11 3l-8 8" />
        </svg>
      </button>
    </div>
  );
}

export function MoneyDateDoneButton({ weekKey }: { weekKey: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn-ink"
      disabled={pending}
      onClick={() => start(async () => void (await completeMoneyDate(weekKey)))}
    >
      {pending ? "Saving…" : "Mark this week done"}
    </button>
  );
}
