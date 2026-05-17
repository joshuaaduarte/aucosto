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
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
  { key: "365d", label: "One year", days: 365 },
  { key: "all", label: "All time", days: null },
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
      return "text-verdigris border-verdigris/30 bg-verdigris-soft";
    case "credit_card_payment":
    case "transfer":
      return "text-ink border-rule bg-paper-deep/60";
    case "housing":
      return "text-ink-soft border-rule bg-paper-deep/40";
    case "fee":
      return "text-oxblood border-oxblood/30 bg-oxblood-soft";
    default:
      return "text-ink-soft border-rule bg-paper-deep/30";
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
  const [view, setView] = useState<ViewKey>("compact");

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
    setView("compact");
  };

  return (
    <div className="space-y-6">
      <div className="rule-t rule-b border-ink/40 py-5 space-y-6">
        {/* Range pills as proper tabs with hairline underline */}
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div className="flex flex-wrap items-baseline gap-x-7 gap-y-2">
            <span className="font-mono text-[0.625rem] uppercase tracking-[0.24em] text-ink-fade">
              Window:
            </span>
            {RANGE_OPTIONS.map((option) => {
              const active = range === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setRange(option.key)}
                  className={`relative font-display text-base italic transition-colors ${
                    active ? "text-ink" : "text-ink-fade hover:text-ink"
                  }`}
                >
                  {option.label}
                  {active && (
                    <span
                      aria-hidden
                      className="absolute -bottom-1.5 left-0 right-0 h-px bg-ink"
                    />
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex items-baseline gap-x-7 font-mono text-[0.625rem] uppercase tracking-[0.22em] text-ink-fade">
            <span>
              View:
            </span>
            <button
              type="button"
              onClick={() => setView("compact")}
              className={`font-display normal-case text-base italic tracking-normal transition-colors ${
                view === "compact" ? "text-ink underline underline-offset-4 decoration-rule" : "text-ink-fade hover:text-ink"
              }`}
            >
              Compact
            </button>
            <button
              type="button"
              onClick={() => setView("cards")}
              className={`font-display normal-case text-base italic tracking-normal transition-colors ${
                view === "cards" ? "text-ink underline underline-offset-4 decoration-rule" : "text-ink-fade hover:text-ink"
              }`}
            >
              Cards
            </button>
          </div>
        </div>

        {/* Tally row */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
          <div className="rule-l border-rule pl-4">
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-ink-fade">
              Showing
            </p>
            <p className="mt-1 font-display text-xl font-medium tabular tracking-[-0.02em] text-ink">
              {filtered.length}
            </p>
          </div>
          <div className="rule-l border-rule pl-4">
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-ink-fade">
              Outflow
            </p>
            <p className="mt-1 font-display text-xl font-medium tabular tracking-[-0.02em] text-oxblood">
              {formatUSDFromCents(filteredSpend)}
            </p>
          </div>
          <label className="rule-l border-rule pl-4">
            <span className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-ink-fade">
              Sort
            </span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="mt-1 block w-full bg-transparent font-serif text-base italic text-ink outline-none"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="largest">Largest first</option>
              <option value="smallest">Smallest first</option>
            </select>
          </label>
          <button
            type="button"
            onClick={resetFilters}
            className="rule-l border-rule pl-4 text-left"
          >
            <span className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-ink-fade">
              Filters
            </span>
            <span className="mt-1 block font-display text-base italic text-ink-fade hover:text-ink">
              Reset all ↺
            </span>
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-3">
          <label className="space-y-1">
            <span className="font-mono text-[0.625rem] uppercase tracking-[0.22em] text-ink-fade">
              Account
            </span>
            <select
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              className="field font-display text-base italic"
            >
              <option value="all">All accounts</option>
              {accountOptions.map((option) => (
                <option key={option} value={option ?? ""}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="font-mono text-[0.625rem] uppercase tracking-[0.22em] text-ink-fade">
              Category
            </span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="field font-display text-base italic"
            >
              <option value="all">All categories</option>
              {FINANCE_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="font-mono text-[0.625rem] uppercase tracking-[0.22em] text-ink-fade">
              Movement
            </span>
            <select
              value={type}
              onChange={(event) =>
                setType(event.target.value as FinanceTransactionType | "all")
              }
              className="field font-display text-base italic"
            >
              <option value="all">All movement</option>
              {FINANCE_TRANSACTION_TYPES.map((option) => (
                <option key={option} value={option}>
                  {formatTransactionType(option)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rule-t rule-b border-rule px-2 py-10 text-center font-serif italic text-ink-fade">
          ❦ No entries match these filters. ❦
        </p>
      ) : view === "compact" ? (
        <>
          {/* Mobile cards */}
          <ul className="md:hidden">
            {filtered.map((transaction) => {
              const transactionType = classifyTransaction(transaction);
              const resolvedCategory = (transaction.category ?? "Other") as FinanceCategory;
              return (
                <li key={transaction.id} className="rule-soft-b border-rule py-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-display text-base text-ink">
                        {transaction.description}
                      </p>
                      <p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-ink-fade">
                        {new Date(transaction.date).toLocaleDateString([], {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                        {transaction.account ? ` · ${transaction.account}` : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 font-mono text-sm tabular ${transaction.amount < 0 ? "text-oxblood" : "text-verdigris"}`}
                    >
                      {formatUSDFromCents(transaction.amount)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between gap-3">
                    <span
                      className={`inline-flex border px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.18em] ${typeTone(transactionType)}`}
                    >
                      {formatTransactionType(transactionType)}
                    </span>
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

          {/* Desktop ledger table */}
          <div className="hidden md:block">
            <div className="rule-b border-ink/60 grid grid-cols-[110px_minmax(220px,1.6fr)_150px_140px_180px_120px] gap-4 py-2 font-mono text-[0.625rem] uppercase tracking-[0.22em] text-ink-fade">
              <span>Date</span>
              <span>Description</span>
              <span>Account</span>
              <span>Movement</span>
              <span>Category</span>
              <span className="text-right">Amount</span>
            </div>
            <ul>
              {filtered.map((transaction) => {
                const transactionType = classifyTransaction(transaction);
                const resolvedCategory = (transaction.category ?? "Other") as FinanceCategory;
                return (
                  <li
                    key={transaction.id}
                    className="rule-soft-b border-rule grid grid-cols-[110px_minmax(220px,1.6fr)_150px_140px_180px_120px] items-baseline gap-4 py-3"
                  >
                    <span className="font-mono text-xs tabular text-ink-fade">
                      {new Date(transaction.date).toLocaleDateString([], {
                        year: "2-digit",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <p className="truncate font-display text-base text-ink">
                      {transaction.description}
                    </p>
                    <span className="truncate font-serif text-sm italic text-ink-fade">
                      {transaction.account ?? "—"}
                    </span>
                    <span
                      className={`inline-flex w-fit border px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.18em] ${typeTone(transactionType)}`}
                    >
                      {formatTransactionType(transactionType)}
                    </span>
                    <CategorySelect
                      id={transaction.id}
                      value={resolvedCategory}
                      description={transaction.description}
                      account={transaction.account}
                    />
                    <span
                      className={`text-right font-mono text-sm tabular ${transaction.amount < 0 ? "text-oxblood" : "text-verdigris"}`}
                    >
                      {formatUSDFromCents(transaction.amount)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      ) : (
        <ul className="grid gap-6 md:grid-cols-2">
          {filtered.map((transaction) => {
            const transactionType = classifyTransaction(transaction);
            const resolvedCategory = (transaction.category ?? "Other") as FinanceCategory;
            return (
              <li
                key={transaction.id}
                className="rule-t border-ink/30 pt-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    className={`inline-flex border px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.18em] ${typeTone(transactionType)}`}
                  >
                    {formatTransactionType(transactionType)}
                  </span>
                  <span
                    className={`font-mono text-sm tabular ${transaction.amount < 0 ? "text-oxblood" : "text-verdigris"}`}
                  >
                    {formatUSDFromCents(transaction.amount)}
                  </span>
                </div>
                <p className="mt-3 font-display text-lg text-ink">
                  {transaction.description}
                </p>
                <p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-ink-fade">
                  {new Date(transaction.date).toLocaleDateString([], {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                  {transaction.account ? ` · ${transaction.account}` : ""}
                </p>
                <div className="mt-3">
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
      )}
    </div>
  );
}
