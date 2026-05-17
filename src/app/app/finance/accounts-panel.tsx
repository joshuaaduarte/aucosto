"use client";

import { useActionState } from "react";
import { FINANCE_ACCOUNT_KINDS, formatAccountKind, type FinanceAccountKind } from "@/lib/finance-accounts";
import { saveFinanceAccount, type AccountState } from "./actions";

type AccountView = {
  id: string;
  name: string;
  kind: string;
  syncSource?: string;
  includeInNetWorth: boolean;
  includeInCashPosition: boolean;
  currentBalanceCents: number;
  statementBalanceCents: number | null;
  balanceUpdatedAt: string;
  dueDate: string | null;
  creditLimitCents: number | null;
};

function formatUSDFromCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function toDateInput(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}

function toMoneyInput(cents: number | null): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

const initialState: AccountState = undefined;

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block font-mono text-[0.625rem] uppercase tracking-[0.22em] text-ink-fade">
      {children}
    </span>
  );
}

function AccountRow({ account }: { account: AccountView }) {
  const [state, formAction, pending] = useActionState(saveFinanceAccount, initialState);

  return (
    <form action={formAction} className="rule-t border-ink/40 pt-5 pb-6">
      <input type="hidden" name="id" value={account.id} />
      <header className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="font-display text-xl text-ink">{account.name}</p>
            {account.syncSource === "teller" ? (
              <span className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-verdigris">
                · linked
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 font-serif text-sm italic text-ink-fade">
            {formatAccountKind(account.kind)} ·{" "}
            <span className="not-italic font-mono tabular text-ink-fade">
              updated {new Date(account.balanceUpdatedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </p>
        </div>
        <p className="font-mono text-lg tabular text-ink">
          {formatUSDFromCents(account.currentBalanceCents)}
        </p>
      </header>
      <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1">
          <Label>Name</Label>
          <input name="name" defaultValue={account.name} required className="field" />
        </label>
        <label className="space-y-1">
          <Label>Kind</Label>
          <select name="kind" defaultValue={account.kind} className="field">
            {FINANCE_ACCOUNT_KINDS.map((kind) => (
              <option key={kind} value={kind}>{formatAccountKind(kind)}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <Label>Current balance</Label>
          <input name="currentBalance" defaultValue={toMoneyInput(account.currentBalanceCents)} required inputMode="decimal" className="field font-mono tabular" />
        </label>
        <label className="space-y-1">
          <Label>Balance as of</Label>
          <input type="date" name="balanceUpdatedAt" defaultValue={toDateInput(account.balanceUpdatedAt)} required className="field font-mono tabular" />
        </label>
        <label className="space-y-1">
          <Label>Statement balance</Label>
          <input name="statementBalance" defaultValue={toMoneyInput(account.statementBalanceCents)} inputMode="decimal" className="field font-mono tabular" />
        </label>
        <label className="space-y-1">
          <Label>Due date</Label>
          <input type="date" name="dueDate" defaultValue={toDateInput(account.dueDate)} className="field font-mono tabular" />
        </label>
        <label className="space-y-1">
          <Label>Credit limit</Label>
          <input name="creditLimit" defaultValue={toMoneyInput(account.creditLimitCents)} inputMode="decimal" className="field font-mono tabular" />
        </label>
        <label className="flex items-baseline gap-3">
          <input type="checkbox" name="includeInCashPosition" defaultChecked={account.includeInCashPosition} className="mt-1 accent-oxblood" />
          <span>
            <span className="block font-display text-sm italic text-ink">Include in cash position</span>
            <span className="block font-serif text-xs italic text-ink-fade">Count toward available cash.</span>
          </span>
        </label>
        <label className="flex items-baseline gap-3">
          <input type="checkbox" name="includeInNetWorth" defaultChecked={account.includeInNetWorth} className="mt-1 accent-oxblood" />
          <span>
            <span className="block font-display text-sm italic text-ink">Include in net worth</span>
            <span className="block font-serif text-xs italic text-ink-fade">Count as an asset or debt in totals.</span>
          </span>
        </label>
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {state && !state.ok ? <p className="font-serif text-sm italic text-oxblood">{state.error}</p> : <span />}
        <button type="submit" disabled={pending} className="btn-ink w-full sm:w-auto">
          {pending ? "Saving…" : "Save changes  ✎"}
        </button>
      </div>
    </form>
  );
}

export function AccountsPanel({ accounts }: { accounts: AccountView[] }) {
  const [state, formAction, pending] = useActionState(saveFinanceAccount, initialState);

  return (
    <div>
      {accounts.map((account) => (
        <AccountRow key={account.id} account={account} />
      ))}

      <form action={formAction} className="rule-t rule-b border-dashed border-rule mt-2 py-6">
        <div>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-ink-fade">
            Open a new account
          </p>
          <h3 className="mt-1 font-display text-xl italic text-ink">
            Add a new line to the register.
          </h3>
          <p className="mt-1 font-serif text-sm italic text-ink-fade">
            Manual-first; balances kept current by hand for now.
          </p>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1">
            <Label>Name</Label>
            <input name="name" placeholder="Chase Checking • 0637" required className="field" />
          </label>
          <label className="space-y-1">
            <Label>Kind</Label>
            <select name="kind" defaultValue={"checking" as FinanceAccountKind} className="field">
              {FINANCE_ACCOUNT_KINDS.map((kind) => (
                <option key={kind} value={kind}>{formatAccountKind(kind)}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <Label>Current balance</Label>
            <input name="currentBalance" required inputMode="decimal" placeholder="0.00" className="field font-mono tabular" />
          </label>
          <label className="space-y-1">
            <Label>Balance as of</Label>
            <input type="date" name="balanceUpdatedAt" required className="field font-mono tabular" />
          </label>
          <label className="space-y-1">
            <Label>Statement balance</Label>
            <input name="statementBalance" inputMode="decimal" placeholder="optional" className="field font-mono tabular" />
          </label>
          <label className="space-y-1">
            <Label>Due date</Label>
            <input type="date" name="dueDate" className="field font-mono tabular" />
          </label>
          <label className="space-y-1">
            <Label>Credit limit</Label>
            <input name="creditLimit" inputMode="decimal" placeholder="optional" className="field font-mono tabular" />
          </label>
          <label className="flex items-baseline gap-3">
            <input type="checkbox" name="includeInCashPosition" defaultChecked className="mt-1 accent-oxblood" />
            <span>
              <span className="block font-display text-sm italic text-ink">In cash position</span>
              <span className="block font-serif text-xs italic text-ink-fade">For checking, savings, cash.</span>
            </span>
          </label>
          <label className="flex items-baseline gap-3">
            <input type="checkbox" name="includeInNetWorth" defaultChecked className="mt-1 accent-oxblood" />
            <span>
              <span className="block font-display text-sm italic text-ink">In net worth</span>
              <span className="block font-serif text-xs italic text-ink-fade">Turn off for excluded or duplicate accounts.</span>
            </span>
          </label>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {state && !state.ok ? <p className="font-serif text-sm italic text-oxblood">{state.error}</p> : <span />}
          <button type="submit" disabled={pending} className="btn-ink w-full sm:w-auto">
            {pending ? "Opening account…" : "Open the account  +"}
          </button>
        </div>
      </form>
    </div>
  );
}
