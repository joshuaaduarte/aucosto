"use client";

// Quick add: log a purchase in a few seconds. Amount first (number pad on a
// phone); everything else is filled in — today's date, the account this
// person used last, and the category that merchant had last time. Category
// can be skipped; it lands in the "to sort" pile for the weekly check-in.
// Saved entries start as "not on a statement yet" until a statement check
// confirms them. "Moved" logs money going between two of your own accounts
// (a card payment, a deposit into Robinhood): never spending.

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { filterMerchants, parseAmountInput, type MerchantSuggestion } from "@/lib/finance-entries";
import { addFinanceEntry, addFinanceMove, deleteFinanceEntry } from "../actions";
import { UndoToast, type UndoToastState } from "./undo-toast";

export type QuickAddAccount = { id: string; name: string; kind?: string };

type Mode = "out" | "in" | "move";

function localDateKey(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function QuickAdd({
  accounts,
  merchants,
  defaultAccountId,
  categories,
  autoFocus = false,
}: {
  accounts: QuickAddAccount[];
  merchants: MerchantSuggestion[];
  defaultAccountId: string | null;
  /** Built-in spending categories, then your own (spendCategoryChoices). */
  categories: string[];
  autoFocus?: boolean;
}) {
  const amountRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const choices = useMemo(() => [...categories, ...added.filter((c) => !categories.includes(c))], [categories, added]);
  const [accountId, setAccountId] = useState<string>(defaultAccountId ?? "");
  const [direction, setDirection] = useState<Mode>("out");
  const [fromId, setFromId] = useState<string>(
    accounts.find((a) => a.kind === "checking")?.id ?? accounts[0]?.id ?? "",
  );
  const [toId, setToId] = useState<string>(
    accounts.find((a) => a.kind === "credit_card")?.id ??
      accounts.find((a) => a.id !== (accounts.find((x) => x.kind === "checking")?.id ?? accounts[0]?.id))?.id ??
      "",
  );
  const [dateMode, setDateMode] = useState<"today" | "yesterday" | "other">("today");
  const [otherDate, setOtherDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<UndoToastState>(null);
  const [pending, start] = useTransition();

  const suggestions = useMemo(() => filterMerchants(merchants, description), [merchants, description]);
  const closeToast = useCallback(() => setToast(null), []);

  const pickMerchant = (m: MerchantSuggestion) => {
    setDescription(m.description);
    if (m.category) setCategory(m.category);
    if (m.financeAccountId && accounts.some((a) => a.id === m.financeAccountId)) setAccountId(m.financeAccountId);
  };

  const submit = () => {
    setError(null);
    if (parseAmountInput(amount) === null) {
      setError("Enter an amount, like 12.50.");
      amountRef.current?.focus();
      return;
    }
    const date =
      dateMode === "today" ? localDateKey(0) : dateMode === "yesterday" ? localDateKey(-1) : otherDate;
    if (!date) {
      setError("Pick a date.");
      return;
    }
    if (direction === "move" && (!fromId || !toId || fromId === toId)) {
      setError("Pick two different accounts.");
      return;
    }
    start(async () => {
      const result =
        direction === "move"
          ? await addFinanceMove({ amount, fromAccountId: fromId, toAccountId: toId, date })
          : await addFinanceEntry({
              amount,
              direction,
              description,
              category: direction === "in" ? "Income" : category,
              accountId: accountId || null,
              date,
            });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAmount("");
      setDescription("");
      setCategory(null);
      if (direction !== "move") setDirection("out");
      setDateMode("today");
      setToast({
        id: Date.now(),
        message: result.summary,
        onUndo: async () => {
          await deleteFinanceEntry(result.id);
        },
      });
      amountRef.current?.focus();
    });
  };

  return (
    <div
      id="quick-add"
      className="rounded-md border p-4 sm:p-5"
      style={{ borderColor: "var(--border-soft)", background: "var(--bg-page)" }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[0.875rem] font-semibold" style={{ color: "var(--text)" }}>
            {direction === "out" ? "Log spending" : direction === "in" ? "Log money coming in" : "Move money"}
          </p>
          <div className="flex gap-1" role="radiogroup" aria-label="Kind of entry">
            {(
              [
                ["out", "Spent"],
                ["in", "Received"],
                ["move", "Moved"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={direction === mode}
                onClick={() => {
                  setDirection(mode);
                  setError(null);
                }}
                disabled={mode === "move" && accounts.length < 2}
                className="rounded px-2 py-1 text-[0.75rem]"
                style={{
                  background: direction === mode ? "var(--bg-tint-strong)" : "transparent",
                  color: direction === mode ? "var(--text)" : "var(--text-muted)",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <label className="relative w-[8.5rem] shrink-0">
            <span className="sr-only">Amount</span>
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[1.125rem]"
              style={{ color: "var(--text-faint)" }}
            >
              $
            </span>
            <input
              ref={amountRef}
              autoFocus={autoFocus}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              enterKeyHint="next"
              placeholder="0.00"
              className="field w-full pl-7 text-[1.125rem] font-semibold tabular"
              aria-label="Amount"
            />
          </label>
          {direction === "move" ? (
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <select
                value={fromId}
                onChange={(e) => setFromId(e.target.value)}
                className="field min-w-0 flex-1 text-[0.8125rem]"
                aria-label="From account"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <span aria-hidden style={{ color: "var(--text-faint)" }}>
                →
              </span>
              <select
                value={toId}
                onChange={(e) => setToId(e.target.value)}
                className="field min-w-0 flex-1 text-[0.8125rem]"
                aria-label="To account"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
          <label className="min-w-0 flex-1">
            <span className="sr-only">{direction === "out" ? "Where" : "From"}</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={direction === "out" ? "Where? (optional)" : "From? (optional)"}
              enterKeyHint="done"
              autoComplete="off"
              className="field w-full"
              aria-label={direction === "out" ? "Where" : "From"}
            />
          </label>
          )}
        </div>

        {suggestions.length > 0 && direction !== "move" ? (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((m) => (
              <button
                key={m.description}
                type="button"
                onClick={() => pickMerchant(m)}
                className="rounded-full border px-2.5 py-1 text-[0.75rem]"
                style={{ borderColor: "var(--border-soft)", color: "var(--text-muted)" }}
              >
                {m.description}
                {m.category ? ` · ${m.category}` : ""}
              </button>
            ))}
          </div>
        ) : null}

        {direction === "out" ? (
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label="Category">
            {choices.map((c) => {
              const active = category === c;
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setCategory(active ? null : c)}
                  className="shrink-0 rounded-full border px-2.5 py-1 text-[0.75rem]"
                  style={{
                    borderColor: active ? "var(--text)" : "var(--border-soft)",
                    background: active ? "var(--text)" : "transparent",
                    color: active ? "var(--bg-page)" : "var(--text-muted)",
                  }}
                >
                  {c}
                </button>
              );
            })}
            {newCategory === null ? (
              <button
                type="button"
                onClick={() => setNewCategory("")}
                className="shrink-0 rounded-full border border-dashed px-2.5 py-1 text-[0.75rem]"
                style={{ borderColor: "var(--border-soft)", color: "var(--text-muted)" }}
              >
                + New
              </button>
            ) : (
              <input
                autoFocus
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setNewCategory("");
                    e.currentTarget.blur();
                  }
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
                onBlur={() => {
                  const name = newCategory.trim().replace(/\s+/g, " ").slice(0, 40);
                  if (name) {
                    const existing = choices.find((c) => c.toLowerCase() === name.toLowerCase());
                    if (!existing) setAdded([...added, name]);
                    setCategory(existing ?? name);
                  }
                  setNewCategory(null);
                }}
                placeholder="New category"
                aria-label="New category"
                className="field w-[9rem] shrink-0 py-1 text-[0.75rem]"
              />
            )}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1" role="radiogroup" aria-label="Date">
            {(["today", "yesterday", "other"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={dateMode === mode}
                onClick={() => setDateMode(mode)}
                className="rounded px-2 py-1 text-[0.75rem]"
                style={{
                  background: dateMode === mode ? "var(--bg-tint-strong)" : "transparent",
                  color: dateMode === mode ? "var(--text)" : "var(--text-muted)",
                }}
              >
                {mode === "today" ? "Today" : mode === "yesterday" ? "Yesterday" : "Other day"}
              </button>
            ))}
          </div>
          {dateMode === "other" ? (
            <input
              type="date"
              value={otherDate}
              onChange={(e) => setOtherDate(e.target.value)}
              className="field max-w-[10rem]"
              aria-label="Date"
            />
          ) : null}
          {accounts.length > 0 && direction !== "move" ? (
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="field max-w-[12rem] text-[0.8125rem]"
              aria-label="Account"
            >
              <option value="">No account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          ) : null}
          <button type="submit" disabled={pending} className="btn-ink ml-auto">
            {pending ? "Saving…" : "Log it"}
          </button>
        </div>

        {error ? (
          <p className="text-[0.75rem]" style={{ color: "var(--accent-strong)" }} role="alert">
            {error}
          </p>
        ) : direction === "move" ? (
          <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
            For card payments, moves to savings and deposits into Robinhood. Never counts as spending.
          </p>
        ) : category === null && direction === "out" && amount ? (
          <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
            No category is fine. It waits in &ldquo;To sort&rdquo; for your weekly check-in.
          </p>
        ) : null}
      </form>
      <UndoToast toast={toast} onClose={closeToast} />
    </div>
  );
}
