"use client";

import { useActionState, useState } from "react";
import {
  saveFinanceAccountPlan,
  saveFlexibleBudget,
  updateFinanceBalance,
  type PlanningState,
} from "../actions";

function Status({ state }: { state: PlanningState }) {
  if (!state) return null;
  if (!state.ok) {
    return (
      <p className="text-[0.75rem]" style={{ color: "var(--accent-strong)" }} role="alert">
        {state.error}
      </p>
    );
  }
  return state.message ? (
    <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }} role="status">
      {state.message}
    </p>
  ) : null;
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function FlexibleLimitForm({
  suggestedCents,
  currentCents,
  label = "Save",
}: {
  suggestedCents?: number | null;
  currentCents?: number | null;
  label?: string;
}) {
  const [state, action, pending] = useActionState(saveFlexibleBudget, undefined);
  const initial = currentCents ?? suggestedCents ?? null;
  return (
    <form action={action} className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative">
          <span className="sr-only">Monthly spending money</span>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }}>
            $
          </span>
          <input
            name="limit"
            inputMode="decimal"
            required
            defaultValue={initial ? String(Math.round(initial / 100)) : ""}
            placeholder="2000"
            className="field w-[9rem] pl-7 tabular"
          />
        </label>
        <span className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
          a month
        </span>
        <button type="submit" disabled={pending} className="btn-ink">
          {pending ? "Saving…" : label}
        </button>
      </div>
      <Status state={state} />
    </form>
  );
}

export function UpdateBalanceForm({
  accountId,
  currentCents,
  owed,
  onDone,
}: {
  accountId: string;
  currentCents: number;
  owed: boolean;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(async (prev: PlanningState, formData: FormData) => {
    const result = await updateFinanceBalance(prev, formData);
    if (result?.ok) onDone?.();
    return result;
  }, undefined);
  return (
    <form action={action} className="space-y-1.5">
      <input type="hidden" name="accountId" value={accountId} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative">
          <span className="sr-only">{owed ? "Amount owed" : "Balance"}</span>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }}>
            $
          </span>
          <input
            name="balance"
            inputMode="decimal"
            required
            autoFocus
            defaultValue={(currentCents / 100).toFixed(2)}
            className="field w-[9.5rem] pl-7 tabular"
          />
        </label>
        <input type="date" name="asOf" defaultValue={todayKey()} className="field max-w-[10rem]" aria-label="As of" />
        <button type="submit" disabled={pending} className="btn-ink">
          {pending ? "Saving…" : "Save"}
        </button>
        {onDone ? (
          <button type="button" className="btn-ghost" onClick={onDone}>
            Cancel
          </button>
        ) : null}
      </div>
      <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
        {owed ? "What you owe today, from the app or statement." : "Today's balance, from the bank's app or website."}
      </p>
      <Status state={state} />
    </form>
  );
}

export function UpdateBalanceButton(props: { accountId: string; currentCents: number; owed: boolean }) {
  const [open, setOpen] = useState(false);
  if (open) return <UpdateBalanceForm {...props} onDone={() => setOpen(false)} />;
  return (
    <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>
      Update balance
    </button>
  );
}

export function AccountPlanForm({
  accountId,
  monthlyCents,
  rateBps,
  owed,
}: {
  accountId: string;
  monthlyCents: number;
  rateBps: number;
  owed: boolean;
}) {
  const [state, action, pending] = useActionState(saveFinanceAccountPlan, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="accountId" value={accountId} />
      <label className="flex items-center gap-1.5 text-[0.75rem]" style={{ color: "var(--text-muted)" }}>
        {owed ? "Pay" : "Add"} $
        <input
          name="monthly"
          inputMode="decimal"
          defaultValue={monthlyCents ? String(Math.round(monthlyCents / 100)) : ""}
          placeholder="0"
          className="field w-[6rem] tabular"
          aria-label={owed ? "Monthly payment" : "Monthly contribution"}
        />
        /mo
      </label>
      <label className="flex items-center gap-1.5 text-[0.75rem]" style={{ color: "var(--text-muted)" }}>
        {owed ? "Interest" : "Grows"}
        <input
          name="rate"
          inputMode="decimal"
          defaultValue={rateBps ? String(rateBps / 100) : ""}
          placeholder="0"
          className="field w-[4.5rem] tabular"
          aria-label={owed ? "Yearly interest rate" : "Yearly growth rate"}
        />
        %/yr
      </label>
      <button type="submit" disabled={pending} className="btn-ghost">
        {pending ? "Saving…" : "Save"}
      </button>
      <Status state={state} />
    </form>
  );
}
