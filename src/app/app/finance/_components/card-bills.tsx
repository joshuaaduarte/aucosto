"use client";

// Card bills: each card's statement balance and due date, soonest first,
// with one tap to mark it paid (recorded as a move from checking, so it never
// counts as spending). Underneath, one line: what checking can spare after
// the card bills and other bills due in the next two weeks.

import { useActionState, useEffect, useState, useTransition } from "react";
import { formatUSDFromCents } from "@/lib/money";
import { dueLabel } from "@/lib/finance-planning";
import { markCardBillPaid, saveCardStatement } from "../actions";

export type CardBillView = {
  id: string;
  name: string;
  statementBalanceCents: number | null;
  /** "YYYY-MM-DD" or null. */
  dueDay: string | null;
  daysUntil: number | null;
  waitingForStatement: boolean;
  /** Last month's charges and payments, from imports and entries. */
  lastMonth: { label: string; chargedCents: number; paidCents: number } | null;
};

export type SafeView = {
  checkingCents: number;
  cardsDueCents: number;
  billsDueCents: number;
  setAsideCents: number;
  safeCents: number;
  windowDays: number;
};

function fmt(cents: number) {
  return formatUSDFromCents(cents, { maximumFractionDigits: 0 });
}

function exact(cents: number) {
  return formatUSDFromCents(cents);
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shortDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString([], { month: "short", day: "numeric" });
}

export function CardBills({
  cards,
  safe,
  payFrom,
}: {
  cards: CardBillView[];
  safe: SafeView | null;
  /** Account card payments come out of (first checking), if any. */
  payFrom: { id: string; name: string } | null;
}) {
  if (cards.length === 0 && !safe) return null;
  return (
    <section className="rounded-md border p-4 sm:p-5" style={{ borderColor: "var(--border-soft)" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[0.9375rem] font-semibold" style={{ color: "var(--text)" }}>
          Card bills
        </p>
        {payFrom ? (
          <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
            Paid from {payFrom.name}
          </p>
        ) : null}
      </div>
      {cards.length === 0 ? (
        <p className="mt-2 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
          Add your credit cards on the Accounts tab to see their bills here.
        </p>
      ) : (
        <ul className="mt-2">
          {cards.map((card) => (
            <CardRow key={card.id} card={card} payFrom={payFrom} />
          ))}
        </ul>
      )}
      {safe ? (
        <p className="mt-3 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
          <span className="font-semibold tabular" style={{ color: safe.safeCents < 0 ? "var(--accent-strong)" : "var(--text)" }}>
            {safe.safeCents < 0 ? `Short ${fmt(-safe.safeCents)}` : `${fmt(safe.safeCents)} safe`}
          </span>{" "}
          in checking: {fmt(safe.checkingCents)} minus {fmt(safe.cardsDueCents + safe.billsDueCents)} in card
          bills and other bills due in the next {safe.windowDays} days
          {safe.setAsideCents > 0 ? `, and ${fmt(safe.setAsideCents)} set aside in pots` : ""}.
        </p>
      ) : null}
    </section>
  );
}

function CardRow({ card, payFrom }: { card: CardBillView; payFrom: { id: string; name: string } | null }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const due = card.daysUntil !== null && !card.waitingForStatement;
  return (
    <li className="border-b py-2.5" style={{ borderColor: "var(--border-faint)" }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.875rem]" style={{ color: "var(--text)" }}>
            {card.name}
          </p>
          <p className="text-[0.75rem]" style={{ color: due && card.daysUntil! <= 3 ? "var(--accent-strong)" : "var(--text-faint)" }}>
            {due
              ? dueLabel(card.daysUntil!)
              : card.dueDay
                ? `Next due ${shortDay(card.dueDay)}. Add the statement when it arrives.`
                : "Add the statement balance and due date"}
          </p>
          {card.lastMonth ? (
            <p className="text-[0.75rem] tabular" style={{ color: "var(--text-faint)" }}>
              {card.lastMonth.label}: {fmt(card.lastMonth.chargedCents)} charged · {fmt(card.lastMonth.paidCents)} paid
            </p>
          ) : null}
        </div>
        {due ? (
          <span className="text-[0.9375rem] font-medium tabular" style={{ color: "var(--text)" }}>
            {exact(card.statementBalanceCents ?? 0)}
          </span>
        ) : null}
        <div className="flex gap-1.5">
          {due ? (
            <button
              type="button"
              className="btn-ink"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await markCardBillPaid({
                    cardId: card.id,
                    fromAccountId: payFrom?.id ?? null,
                    amountCents: card.statementBalanceCents ?? 0,
                    date: todayKey(),
                  });
                  if (r && !r.ok) setError(r.error);
                })
              }
            >
              {pending ? "Saving…" : "Paid"}
            </button>
          ) : null}
          <button type="button" className="btn-ghost" onClick={() => setEditing(!editing)} aria-expanded={editing}>
            {editing ? "Close" : due ? "Edit" : "Add statement"}
          </button>
        </div>
      </div>
      {editing ? <StatementForm card={card} onDone={() => setEditing(false)} /> : null}
      {error ? (
        <p className="mt-1 text-[0.75rem]" style={{ color: "var(--accent-strong)" }} role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function StatementForm({ card, onDone }: { card: CardBillView; onDone: () => void }) {
  const [state, action, pending] = useActionState(saveCardStatement, undefined);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  return (
    <form action={action} className="mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="cardId" value={card.id} />
      <label className="text-[0.75rem]" style={{ color: "var(--text-muted)" }}>
        Statement balance
        <input
          name="amount"
          inputMode="decimal"
          required
          defaultValue={card.statementBalanceCents != null ? (card.statementBalanceCents / 100).toFixed(2) : ""}
          placeholder="0.00"
          className="field mt-1 block w-[8.5rem] tabular"
        />
      </label>
      <label className="text-[0.75rem]" style={{ color: "var(--text-muted)" }}>
        Due date
        <input type="date" name="dueDate" required defaultValue={card.dueDay ?? ""} className="field mt-1 block" />
      </label>
      <button type="submit" disabled={pending} className="btn-ink">
        {pending ? "Saving…" : "Save"}
      </button>
      {state && !state.ok ? (
        <p className="w-full text-[0.75rem]" style={{ color: "var(--accent-strong)" }} role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
