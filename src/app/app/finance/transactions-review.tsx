"use client";

import { useMemo, useState } from "react";
import { FINANCE_CATEGORIES, type FinanceCategory } from "@/lib/finance-categories";
import {
  FINANCE_TRANSACTION_TYPES,
  classifyTransaction,
  formatTransactionType,
  type FinanceTransactionType,
} from "@/lib/finance-types";
import { CategorySelect } from "./category-select";

type TransactionView = {
  id: string;
  date: string;
  amount: number;
  description: string;
  account: string | null;
  category: string | null;
};

type RangeKey = "30d" | "90d" | "365d" | "all";
type SortKey = "newest" | "oldest" | "largest" | "smallest";
type ViewKey = "cards" | "compact";

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string; days: number | null }> = [
  { key: "30d", label: "30d", days: 30 },
  { key: "90d", label: "90d", days: 90 },
  { key: "365d", label: "1y", days: 365 },
  { key: "all", label: "All", days: null },
];

function formatUSDFromCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function typeTone(type: string): string {
  switch (type) {
    case "income":
    case "reimbursement":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20";
    case "credit_card_payment":
    case "transfer":
      return "bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20";
    case "housing":
      return "bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/20";
    case "fee":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20";
    default:
      return "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700";
  }
}

function isWithinRange(date: Date, range: RangeKey): boolean {
  const option = RANGE_OPTIONS.find((item) => item.key === range);
  if (!option || option.days == null) return true;
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - option.days + 1);
  return date >= cutoff;
}

export function TransactionsReview({ transactions }: { transactions: TransactionView[] }) {
  const [range, setRange] = useState<RangeKey>("90d");
  const [account, setAccount] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [type, setType] = useState<FinanceTransactionType | "all">("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [view, setView] = useState<ViewKey>("cards");

  const accountOptions = useMemo(() => {
    return Array.from(
      new Set(transactions.map((transaction) => transaction.account).filter(Boolean)),
    ).sort((a, b) => String(a).localeCompare(String(b)));
  }, [transactions]);

  const filtered = useMemo(() => {
    const next = transactions.filter((transaction) => {
      const transactionDate = new Date(transaction.date);
      const transactionType = classifyTransaction(transaction);
      const resolvedCategory = transaction.category ?? "Other";

      if (!isWithinRange(transactionDate, range)) return false;
      if (account !== "all" && transaction.account !== account) return false;
      if (category !== "all" && resolvedCategory !== category) return false;
      if (type !== "all" && transactionType !== type) return false;
      return true;
    });

    next.sort((a, b) => {
      switch (sort) {
        case "oldest":
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case "largest":
          return Math.abs(b.amount) - Math.abs(a.amount);
        case "smallest":
          return Math.abs(a.amount) - Math.abs(b.amount);
        case "newest":
        default:
          return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
    });

    return next;
  }, [account, category, range, sort, transactions, type]);

  const filteredSpend = useMemo(
    () =>
      filtered
        .filter((transaction) => transaction.amount < 0)
        .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0),
    [filtered],
  );

  const resetFilters = () => {
    setRange("90d");
    setAccount("all");
    setCategory("all");
    setType("all");
    setSort("newest");
    setView("cards");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
                Review transactions
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                Filter by time, account, category, or money movement type, then review in cards or a tighter desktop table.
              </p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setRange(option.key)}
                  className={`inline-flex min-h-10 items-center rounded-full px-3.5 text-sm transition-colors ${
                    range === option.key
                      ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
                      : "border border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950/70">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Showing</p>
              <p className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">{filtered.length}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950/70">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Spend</p>
              <p className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">{formatUSDFromCents(filteredSpend)}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950/70">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Sort</p>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className="mt-1 w-full bg-transparent text-sm text-zinc-700 outline-none dark:text-zinc-300"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="largest">Largest first</option>
                <option value="smallest">Smallest first</option>
              </select>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950/70">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">View</p>
              <div className="mt-1 flex gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => setView("cards")}
                  className={view === "cards" ? "font-medium text-zinc-950 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"}
                >
                  Cards
                </button>
                <div className="hidden items-center gap-2 md:flex">
                  <span className="text-zinc-300">/</span>
                  <button
                    type="button"
                    onClick={() => setView("compact")}
                    className={view === "compact" ? "font-medium text-zinc-950 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"}
                  >
                    Compact
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="text-zinc-500">Account</span>
            <select value={account} onChange={(event) => setAccount(event.target.value)} className="block min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
              <option value="all">All accounts</option>
              {accountOptions.map((option) => (
                <option key={option} value={option ?? ""}>{option}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-zinc-500">Category</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="block min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
              <option value="all">All categories</option>
              {FINANCE_CATEGORIES.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-zinc-500">Type</span>
            <select value={type} onChange={(event) => setType(event.target.value as FinanceTransactionType | "all")} className="block min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
              <option value="all">All movement</option>
              {FINANCE_TRANSACTION_TYPES.map((option) => (
                <option key={option} value={option}>{formatTransactionType(option)}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button type="button" onClick={resetFilters} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-700 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-100">
              Reset filters
            </button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 px-5 py-8 text-sm text-zinc-500 dark:border-zinc-700">
          No transactions match these filters.
        </div>
      ) : view === "compact" ? (
        <>
          <ul className="space-y-3 md:hidden">
            {filtered.map((transaction) => {
              const transactionType = classifyTransaction(transaction);
              const resolvedCategory = (transaction.category ?? "Other") as FinanceCategory;
              return (
                <li key={transaction.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{transaction.description}</p>
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${typeTone(transactionType)}`}>
                            {formatTransactionType(transactionType)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">
                          {new Date(transaction.date).toLocaleDateString([], {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                          {transaction.account ? ` · ${transaction.account}` : ""}
                        </p>
                      </div>
                      <span className={`font-mono text-sm tabular-nums ${transaction.amount < 0 ? "text-zinc-900 dark:text-zinc-100" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {formatUSDFromCents(transaction.amount)}
                      </span>
                    </div>
                    <CategorySelect
                      id={transaction.id}
                      value={resolvedCategory}
                      description={transaction.description}
                      account={transaction.account}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm shadow-zinc-950/5 md:block dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
            <div className="hidden grid-cols-[120px_minmax(220px,1.6fr)_150px_160px_180px_120px] gap-3 border-b border-zinc-200 px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-zinc-500 md:grid dark:border-zinc-800">
              <span>Date</span>
              <span>Description</span>
              <span>Account</span>
              <span>Type</span>
              <span>Category</span>
              <span className="text-right">Amount</span>
            </div>
            <ul>
              {filtered.map((transaction) => {
                const transactionType = classifyTransaction(transaction);
                const resolvedCategory = (transaction.category ?? "Other") as FinanceCategory;
                return (
                  <li key={transaction.id} className="border-t border-zinc-200 first:border-t-0 dark:border-zinc-800">
                    <div className="grid gap-3 px-4 py-4 md:grid-cols-[120px_minmax(220px,1.6fr)_150px_160px_180px_120px] md:items-center">
                      <span className="text-sm text-zinc-500">
                        {new Date(transaction.date).toLocaleDateString([], {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{transaction.description}</p>
                      </div>
                      <span className="truncate text-sm text-zinc-500">{transaction.account ?? "—"}</span>
                      <div>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${typeTone(transactionType)}`}>
                          {formatTransactionType(transactionType)}
                        </span>
                      </div>
                      <CategorySelect
                        id={transaction.id}
                        value={resolvedCategory}
                        description={transaction.description}
                        account={transaction.account}
                      />
                      <span className={`text-right font-mono text-sm tabular-nums ${transaction.amount < 0 ? "text-zinc-900 dark:text-zinc-100" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {formatUSDFromCents(transaction.amount)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      ) : (
        <ul className="space-y-3">
          {filtered.map((transaction) => {
            const transactionType = classifyTransaction(transaction);
            const resolvedCategory = (transaction.category ?? "Other") as FinanceCategory;
            return (
              <li key={transaction.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3 sm:block">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="max-w-full truncate text-sm font-medium text-zinc-900 dark:text-zinc-100 sm:text-base">{transaction.description}</p>
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${typeTone(transactionType)}`}>
                            {formatTransactionType(transactionType)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">
                          {new Date(transaction.date).toLocaleDateString([], {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                          {transaction.account ? ` · ${transaction.account}` : ""}
                        </p>
                      </div>
                      <span className={`font-mono text-base tabular-nums sm:hidden ${transaction.amount < 0 ? "text-zinc-900 dark:text-zinc-100" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {formatUSDFromCents(transaction.amount)}
                      </span>
                    </div>
                    <div className="mt-3 max-w-full sm:max-w-[340px]">
                      <CategorySelect
                        id={transaction.id}
                        value={resolvedCategory}
                        description={transaction.description}
                        account={transaction.account}
                      />
                    </div>
                  </div>
                  <span className={`hidden font-mono text-sm tabular-nums sm:block ${transaction.amount < 0 ? "text-zinc-900 dark:text-zinc-100" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {formatUSDFromCents(transaction.amount)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
