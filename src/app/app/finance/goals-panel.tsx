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

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block font-mono text-[0.625rem] uppercase tracking-[0.22em] text-ink-fade">
      {children}
    </span>
  );
}

function GoalRow({ goal }: { goal: GoalView }) {
  const [state, formAction, pending] = useActionState(saveFinanceGoal, initialState);
  const summary = summarizeGoal({
    targetAmountCents: goal.targetAmountCents,
    currentAmountCents: goal.currentAmountCents,
    targetDate: goal.targetDate ? new Date(goal.targetDate) : null,
    monthlyContributionCents: goal.monthlyContributionCents,
  });

  return (
    <form action={formAction} className="rule-t border-ink/40 pt-5 pb-6">
      <input type="hidden" name="id" value={goal.id} />
      <header className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="font-display text-xl text-ink">{goal.name}</p>
            <span className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-ink-fade">
              — {formatGoalCategory(goal.category)} · {formatGoalOwner(goal.owner)}
            </span>
          </div>
          <p className="mt-1 font-serif text-sm italic text-ink-fade">
            <span className="not-italic font-mono tabular text-ink-soft">
              {summary.fundedPercent}%
            </span>{" "}
            funded ·{" "}
            <span className="not-italic font-mono tabular text-ink-soft">
              {formatUSDFromCents(summary.remainingCents)}
            </span>{" "}
            remaining
            {summary.targetDateLabel ? ` · target ${summary.targetDateLabel}` : ""}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="font-mono text-base tabular text-ink">
            {formatUSDFromCents(goal.currentAmountCents)} / {formatUSDFromCents(goal.targetAmountCents)}
          </p>
          {summary.monthlyNeededCents > 0 && (
            <p className="mt-0.5 font-serif text-xs italic text-ink-fade">
              <span className="not-italic font-mono tabular text-ink-fade">
                {formatUSDFromCents(summary.monthlyNeededCents)}
              </span>{" "}
              per month needed
            </p>
          )}
        </div>
      </header>
      <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1">
          <Label>Name</Label>
          <input name="name" defaultValue={goal.name} required className="field" />
        </label>
        <label className="space-y-1">
          <Label>Owner</Label>
          <select name="owner" defaultValue={goal.owner} className="field">
            {FINANCE_GOAL_OWNERS.map((owner) => <option key={owner} value={owner}>{formatGoalOwner(owner)}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <Label>Category</Label>
          <select name="category" defaultValue={goal.category} className="field">
            {FINANCE_GOAL_CATEGORIES.map((category) => <option key={category} value={category}>{formatGoalCategory(category)}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <Label>Status</Label>
          <select name="status" defaultValue={goal.status} className="field">
            {FINANCE_GOAL_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <Label>Target amount</Label>
          <input name="targetAmount" defaultValue={toMoneyInput(goal.targetAmountCents)} required inputMode="decimal" className="field font-mono tabular" />
        </label>
        <label className="space-y-1">
          <Label>Currently saved</Label>
          <input name="currentAmount" defaultValue={toMoneyInput(goal.currentAmountCents)} inputMode="decimal" className="field font-mono tabular" />
        </label>
        <label className="space-y-1">
          <Label>Target date</Label>
          <input type="date" name="targetDate" defaultValue={toDateInput(goal.targetDate)} className="field font-mono tabular" />
        </label>
        <label className="space-y-1">
          <Label>Planned monthly</Label>
          <input name="monthlyContribution" defaultValue={toMoneyInput(goal.monthlyContributionCents)} inputMode="decimal" className="field font-mono tabular" />
        </label>
      </div>
      <label className="mt-4 block space-y-1">
        <Label>Notes</Label>
        <textarea
          name="notes"
          defaultValue={goal.notes ?? ""}
          rows={2}
          className="field min-h-[88px] resize-y"
        />
      </label>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {state && !state.ok ? <p className="font-serif text-sm italic text-oxblood">{state.error}</p> : <span />}
        <button type="submit" disabled={pending} className="btn-ink w-full sm:w-auto">
          {pending ? "Saving…" : "Save the bucket  ✎"}
        </button>
      </div>
    </form>
  );
}

export function GoalsPanel({ goals }: { goals: GoalView[] }) {
  const [state, formAction, pending] = useActionState(saveFinanceGoal, initialState);

  return (
    <div>
      {goals.map((goal) => <GoalRow key={goal.id} goal={goal} />)}

      <form action={formAction} className="rule-t rule-b border-dashed border-rule mt-2 py-6">
        <div>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-ink-fade">
            Open a new bucket
          </p>
          <h3 className="mt-1 font-display text-xl italic text-ink">
            Set aside for what is coming.
          </h3>
          <p className="mt-1 font-serif text-sm italic text-ink-fade">
            Wedding, emergency, vacation, projects — name it, set the target.
          </p>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1">
            <Label>Name</Label>
            <input name="name" placeholder="Wedding" required className="field" />
          </label>
          <label className="space-y-1">
            <Label>Owner</Label>
            <select name="owner" defaultValue={"shared" as FinanceGoalOwner} className="field">
              {FINANCE_GOAL_OWNERS.map((owner) => <option key={owner} value={owner}>{formatGoalOwner(owner)}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <Label>Category</Label>
            <select name="category" defaultValue={"general" as FinanceGoalCategory} className="field">
              {FINANCE_GOAL_CATEGORIES.map((category) => <option key={category} value={category}>{formatGoalCategory(category)}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <Label>Status</Label>
            <select name="status" defaultValue={"active" as FinanceGoalStatus} className="field">
              {FINANCE_GOAL_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <Label>Target amount</Label>
            <input name="targetAmount" required inputMode="decimal" placeholder="0.00" className="field font-mono tabular" />
          </label>
          <label className="space-y-1">
            <Label>Currently saved</Label>
            <input name="currentAmount" inputMode="decimal" placeholder="0.00" className="field font-mono tabular" />
          </label>
          <label className="space-y-1">
            <Label>Target date</Label>
            <input type="date" name="targetDate" className="field font-mono tabular" />
          </label>
          <label className="space-y-1">
            <Label>Planned monthly</Label>
            <input name="monthlyContribution" inputMode="decimal" placeholder="optional" className="field font-mono tabular" />
          </label>
        </div>
        <label className="mt-4 block space-y-1">
          <Label>Notes</Label>
          <textarea name="notes" rows={2} placeholder="Optional context or budget notes" className="field min-h-[88px] resize-y" />
        </label>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {state && !state.ok ? <p className="font-serif text-sm italic text-oxblood">{state.error}</p> : <span />}
          <button type="submit" disabled={pending} className="btn-ink w-full sm:w-auto">
            {pending ? "Opening bucket…" : "Open the bucket  +"}
          </button>
        </div>
      </form>
    </div>
  );
}
