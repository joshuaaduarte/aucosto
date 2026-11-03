"use client";

// Quick add: log a purchase in a few seconds. Amount first (number pad on a
// phone); everything else is filled in — today's date, the account this
// person used last, and the category that merchant had last time. Category
// can be skipped; it lands in the "to sort" pile for the weekly check-in.
// Saved entries start as "not on a statement yet" until a statement check
// confirms them.

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { FINANCE_CATEGORIES } from "@/lib/finance-categories";
import { filterMerchants, parseAmountInput, type MerchantSuggestion } from "@/lib/finance-entries";
import { addFinanceEntry, deleteFinanceEntry } from "../actions";
import { UndoToast, type UndoToastState } from "./undo-toast";

export type QuickAddAccount = { id: string; name: string };

const SPEND_CATEGORIES = FINANCE_CATEGORIES.filter((c) => c !== "Income");

function localDateKey(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function QuickAdd({
  accounts,
  merchants,
  defaultAccountId,
  autoFocus = false,
}: {
  accounts: QuickAddAccount[];
  merchants: MerchantSuggestion[];
  defaultAccountId: string | null;
  autoFocus?: boolean;
}) {
  const amountRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string>(defaultAccountId ?? "");
  const [direction, setDirection] = useState<"out" | "in">("out");
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
    start(async () => {
      const result = await addFinanceEntry({
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
      setDirection("out");
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
        <div className="flex items-center justify-between gap-2">
          <p className="text-[0.875rem] font-semibold" style={{ color: "var(--text)" }}>
            {direction === "out" ? "Log spending" : "Log money coming in"}
          </p>
          <button
            type="button"
            className="text-[0.75rem] underline-offset-4 hover:underline"
            style={{ color: "var(--text-muted)" }}
            onClick={() => setDirection(direction === "out" ? "in" : "out")}
          >
            {direction === "out" ? "Money in instead?" : "Spending instead?"}
          </button>
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
        </div>

        {suggestions.length > 0 ? (
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
            {SPEND_CATEGORIES.map((c) => {
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
          {accounts.length > 0 ? (
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
