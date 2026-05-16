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
const fieldClassName = "block min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const buttonClassName = "inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";
const checkboxClassName = "h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

function AccountRow({ account }: { account: AccountView }) {
  const [state, formAction, pending] = useActionState(saveFinanceAccount, initialState);

  return (
    <form action={formAction} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <input type="hidden" name="id" value={account.id} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">{account.name}</p>
            {account.syncSource === "teller" ? (
              <span className="rounded-full bg-sky-50 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
                linked
              </span>
            ) : null}
          </div>
          <p className="text-xs text-zinc-500">{formatAccountKind(account.kind)} · updated {new Date(account.balanceUpdatedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</p>
        </div>
        <p className="font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">{formatUSDFromCents(account.currentBalanceCents)}</p>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1 text-sm">
          <span className="text-zinc-500">Name</span>
          <input name="name" defaultValue={account.name} required className={fieldClassName} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-zinc-500">Kind</span>
          <select name="kind" defaultValue={account.kind} className={fieldClassName}>
            {FINANCE_ACCOUNT_KINDS.map((kind) => (
              <option key={kind} value={kind}>{formatAccountKind(kind)}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-zinc-500">Current balance</span>
          <input name="currentBalance" defaultValue={toMoneyInput(account.currentBalanceCents)} required inputMode="decimal" className={fieldClassName} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-zinc-500">Balance as of</span>
          <input type="date" name="balanceUpdatedAt" defaultValue={toDateInput(account.balanceUpdatedAt)} required className={fieldClassName} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-zinc-500">Statement balance</span>
          <input name="statementBalance" defaultValue={toMoneyInput(account.statementBalanceCents)} inputMode="decimal" className={fieldClassName} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-zinc-500">Due date</span>
          <input type="date" name="dueDate" defaultValue={toDateInput(account.dueDate)} className={fieldClassName} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-zinc-500">Credit limit</span>
          <input name="creditLimit" defaultValue={toMoneyInput(account.creditLimitCents)} inputMode="decimal" className={fieldClassName} />
        </label>
        <label className="flex items-center gap-3 rounded-xl border border-zinc-200 px-3 py-3 text-sm dark:border-zinc-800">
          <input type="checkbox" name="includeInCashPosition" defaultChecked={account.includeInCashPosition} className={checkboxClassName} />
          <span>
            <span className="block font-medium text-zinc-900 dark:text-zinc-100">Include in cash position</span>
            <span className="block text-xs text-zinc-500">Count this toward available cash.</span>
          </span>
        </label>
        <label className="flex items-center gap-3 rounded-xl border border-zinc-200 px-3 py-3 text-sm dark:border-zinc-800">
          <input type="checkbox" name="includeInNetWorth" defaultChecked={account.includeInNetWorth} className={checkboxClassName} />
          <span>
            <span className="block font-medium text-zinc-900 dark:text-zinc-100">Include in net worth</span>
            <span className="block text-xs text-zinc-500">Count this as an asset or debt in totals.</span>
          </span>
        </label>
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {state && !state.ok ? <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p> : <span />}
        <button type="submit" disabled={pending} className={`${buttonClassName} w-full sm:w-auto`}>
          {pending ? "Saving…" : "Save account"}
        </button>
      </div>
    </form>
  );
}

export function AccountsPanel({ accounts }: { accounts: AccountView[] }) {
  const [state, formAction, pending] = useActionState(saveFinanceAccount, initialState);

  return (
    <div className="space-y-4">
      {accounts.map((account) => (
        <AccountRow key={account.id} account={account} />
      ))}

      <form action={formAction} className="rounded-xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <div>
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Add account</h3>
          <p className="mt-1 text-sm text-zinc-500">Manual-first for now: keep current balances fresh, then we can automate later.</p>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="text-zinc-500">Name</span>
            <input name="name" placeholder="Chase Checking • 0637" required className={fieldClassName} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-zinc-500">Kind</span>
            <select name="kind" defaultValue={"checking" as FinanceAccountKind} className={fieldClassName}>
              {FINANCE_ACCOUNT_KINDS.map((kind) => (
                <option key={kind} value={kind}>{formatAccountKind(kind)}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-zinc-500">Current balance</span>
            <input name="currentBalance" required inputMode="decimal" placeholder="0.00" className={fieldClassName} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-zinc-500">Balance as of</span>
            <input type="date" name="balanceUpdatedAt" required className={fieldClassName} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-zinc-500">Statement balance</span>
            <input name="statementBalance" inputMode="decimal" placeholder="optional" className={fieldClassName} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-zinc-500">Due date</span>
            <input type="date" name="dueDate" className={fieldClassName} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-zinc-500">Credit limit</span>
            <input name="creditLimit" inputMode="decimal" placeholder="optional" className={fieldClassName} />
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-zinc-200 px-3 py-3 text-sm dark:border-zinc-800">
            <input type="checkbox" name="includeInCashPosition" defaultChecked className={checkboxClassName} />
            <span>
              <span className="block font-medium text-zinc-900 dark:text-zinc-100">Include in cash position</span>
              <span className="block text-xs text-zinc-500">Best for checking, savings, and cash.</span>
            </span>
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-zinc-200 px-3 py-3 text-sm dark:border-zinc-800">
            <input type="checkbox" name="includeInNetWorth" defaultChecked className={checkboxClassName} />
            <span>
              <span className="block font-medium text-zinc-900 dark:text-zinc-100">Include in net worth</span>
              <span className="block text-xs text-zinc-500">Turn this off for excluded or duplicated accounts.</span>
            </span>
          </label>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {state && !state.ok ? <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p> : <span />}
          <button type="submit" disabled={pending} className={`${buttonClassName} w-full sm:w-auto`}>
            {pending ? "Adding…" : "Add account"}
          </button>
        </div>
      </form>
    </div>
  );
}
