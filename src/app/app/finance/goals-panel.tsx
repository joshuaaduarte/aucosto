"use client";

import { useActionState } from "react";
import {
  FINANCE_GOAL_CATEGORIES,
  FINANCE_GOAL_OWNERS,
  FINANCE_GOAL_STATUSES,
  formatGoalCategory,
  formatGoalOwner,
  summarizeGoal,
  type FinanceGoalCategory,
  type FinanceGoalOwner,
  type FinanceGoalStatus,
} from "@/lib/finance-goals";
import { saveFinanceGoal, type GoalState } from "./actions";

type GoalView = {
  id: string;
  name: string;
  owner: string;
  category: string;
  targetAmountCents: number;
  currentAmountCents: number;
  targetDate: string | null;
  monthlyContributionCents: number | null;
  status: string;
  notes: string | null;
};

function formatUSDFromCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function toMoneyInput(cents: number | null): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

function toDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

const initialState: GoalState = undefined;
const fieldClassName = "block min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm";
const buttonClassName = "inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-800 disabled:opacity-50";

function GoalRow({ goal }: { goal: GoalView }) {
  const [state, formAction, pending] = useActionState(saveFinanceGoal, initialState);
  const summary = summarizeGoal({
    targetAmountCents: goal.targetAmountCents,
    currentAmountCents: goal.currentAmountCents,
    targetDate: goal.targetDate ? new Date(goal.targetDate) : null,
    monthlyContributionCents: goal.monthlyContributionCents,
  });

  return (
    <form action={formAction} className="rounded-[1.4rem] border border-zinc-200 bg-zinc-50/60 p-4 shadow-sm shadow-zinc-950/5">
      <input type="hidden" name="id" value={goal.id} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-zinc-900">{goal.name}</p>
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-zinc-600 ring-1 ring-zinc-200">{formatGoalCategory(goal.category)}</span>
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-zinc-600 ring-1 ring-zinc-200">{formatGoalOwner(goal.owner)}</span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">{summary.fundedPercent}% funded · {formatUSDFromCents(summary.remainingCents)} left{summary.targetDateLabel ? ` · target ${summary.targetDateLabel}` : ""}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="font-mono text-sm tabular-nums text-zinc-900">{formatUSDFromCents(goal.currentAmountCents)} / {formatUSDFromCents(goal.targetAmountCents)}</p>
          {summary.monthlyNeededCents > 0 && <p className="text-xs text-zinc-500">{formatUSDFromCents(summary.monthlyNeededCents)} / month needed</p>}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1 text-sm">
          <span className="text-zinc-500">Name</span>
          <input name="name" defaultValue={goal.name} required className={fieldClassName} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-zinc-500">Owner</span>
          <select name="owner" defaultValue={goal.owner} className={fieldClassName}>
            {FINANCE_GOAL_OWNERS.map((owner) => <option key={owner} value={owner}>{formatGoalOwner(owner)}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-zinc-500">Category</span>
          <select name="category" defaultValue={goal.category} className={fieldClassName}>
            {FINANCE_GOAL_CATEGORIES.map((category) => <option key={category} value={category}>{formatGoalCategory(category)}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-zinc-500">Status</span>
          <select name="status" defaultValue={goal.status} className={fieldClassName}>
            {FINANCE_GOAL_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-zinc-500">Target amount</span>
          <input name="targetAmount" defaultValue={toMoneyInput(goal.targetAmountCents)} required inputMode="decimal" className={fieldClassName} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-zinc-500">Currently saved</span>
          <input name="currentAmount" defaultValue={toMoneyInput(goal.currentAmountCents)} inputMode="decimal" className={fieldClassName} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-zinc-500">Target date</span>
          <input type="date" name="targetDate" defaultValue={toDateInput(goal.targetDate)} className={fieldClassName} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-zinc-500">Planned monthly</span>
          <input name="monthlyContribution" defaultValue={toMoneyInput(goal.monthlyContributionCents)} inputMode="decimal" className={fieldClassName} />
        </label>
      </div>
      <label className="mt-3 block space-y-1 text-sm">
        <span className="text-zinc-500">Notes</span>
        <textarea name="notes" defaultValue={goal.notes ?? ""} rows={2} className={`${fieldClassName} min-h-[88px] resize-y`} />
      </label>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {state && !state.ok ? <p className="text-sm text-red-600">{state.error}</p> : <span />}
        <button type="submit" disabled={pending} className={`${buttonClassName} w-full sm:w-auto`}>
          {pending ? "Saving…" : "Save goal"}
        </button>
      </div>
    </form>
  );
}

export function GoalsPanel({ goals }: { goals: GoalView[] }) {
  const [state, formAction, pending] = useActionState(saveFinanceGoal, initialState);

  return (
    <div className="space-y-4">
      {goals.map((goal) => <GoalRow key={goal.id} goal={goal} />)}

      <form action={formAction} className="rounded-[1.4rem] border border-dashed border-zinc-300 bg-white/70 p-4">
        <div>
          <h3 className="text-sm font-medium text-zinc-900">Add goal bucket</h3>
          <p className="mt-1 text-sm text-zinc-500">Track future-facing buckets like wedding, emergency fund, vacation, or projects.</p>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="text-zinc-500">Name</span>
            <input name="name" placeholder="Wedding" required className={fieldClassName} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-zinc-500">Owner</span>
            <select name="owner" defaultValue={"shared" as FinanceGoalOwner} className={fieldClassName}>
              {FINANCE_GOAL_OWNERS.map((owner) => <option key={owner} value={owner}>{formatGoalOwner(owner)}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-zinc-500">Category</span>
            <select name="category" defaultValue={"general" as FinanceGoalCategory} className={fieldClassName}>
              {FINANCE_GOAL_CATEGORIES.map((category) => <option key={category} value={category}>{formatGoalCategory(category)}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-zinc-500">Status</span>
            <select name="status" defaultValue={"active" as FinanceGoalStatus} className={fieldClassName}>
              {FINANCE_GOAL_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-zinc-500">Target amount</span>
            <input name="targetAmount" required inputMode="decimal" placeholder="0.00" className={fieldClassName} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-zinc-500">Currently saved</span>
            <input name="currentAmount" inputMode="decimal" placeholder="0.00" className={fieldClassName} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-zinc-500">Target date</span>
            <input type="date" name="targetDate" className={fieldClassName} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-zinc-500">Planned monthly</span>
            <input name="monthlyContribution" inputMode="decimal" placeholder="optional" className={fieldClassName} />
          </label>
        </div>
        <label className="mt-3 block space-y-1 text-sm">
          <span className="text-zinc-500">Notes</span>
          <textarea name="notes" rows={2} placeholder="Optional context or budget notes" className={`${fieldClassName} min-h-[88px] resize-y`} />
        </label>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {state && !state.ok ? <p className="text-sm text-red-600">{state.error}</p> : <span />}
          <button type="submit" disabled={pending} className={`${buttonClassName} w-full sm:w-auto`}>
            {pending ? "Adding…" : "Add goal"}
          </button>
        </div>
      </form>
    </div>
  );
}
