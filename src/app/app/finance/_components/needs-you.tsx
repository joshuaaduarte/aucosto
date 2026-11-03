"use client";

// "Needs you": everything on the money side that wants a tap, in one list,
// most urgent first. Replaces the four overview tiles and the long weekly
// check-in on the Overview tab. Each row goes straight to the job; card bills
// can be marked paid right here.

import Link from "next/link";
import { useState, useTransition } from "react";
import { formatUSDFromCents } from "@/lib/money";
import { markCardBillPaid } from "../actions";
import type { NeedsYouItem } from "../_lib/needs-you";

export type { NeedsYouItem };

function fmt(cents: number) {
  return formatUSDFromCents(cents, { maximumFractionDigits: 0 });
}

function exact(cents: number) {
  return formatUSDFromCents(cents);
}

function when(days: number) {
  if (days < 0) return `${-days} ${days === -1 ? "day" : "days"} late`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function NeedsYou({ items }: { items: NeedsYouItem[] }) {
  return (
    <section aria-labelledby="needs-you" className="space-y-2">
      <h2 id="needs-you" className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
        Needs you
      </h2>
      {items.length === 0 ? (
        <p
          className="flex items-center gap-2 rounded-md px-4 py-3 text-[0.875rem]"
          style={{ background: "var(--positive-tint)", color: "var(--text)" }}
        >
          <span aria-hidden style={{ color: "var(--positive)" }}>
            ✓
          </span>
          All caught up. Nothing to sort, pay or check.
        </p>
      ) : (
        <ul className="rounded-md border" style={{ borderColor: "var(--border-soft)" }}>
          {items.map((item, index) => (
            <li
              key={`${item.kind}-${"id" in item ? item.id : index}`}
              className="border-t first:border-t-0"
              style={{ borderColor: "var(--border-faint)" }}
            >
              <Row item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Icon({ glyph, tone }: { glyph: string; tone: "accent" | "attention" | "neutral" }) {
  const bg = tone === "accent" ? "var(--accent-tint)" : tone === "attention" ? "var(--attention-tint)" : "var(--bg-tint-strong)";
  return (
    <span
      aria-hidden
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[0.9375rem]"
      style={{ background: bg }}
    >
      {glyph}
    </span>
  );
}

function LinkRow({
  href,
  glyph,
  tone,
  title,
  hint,
  hintTone,
}: {
  href: string;
  glyph: string;
  tone: "accent" | "attention" | "neutral";
  title: string;
  hint?: string;
  hintTone?: "attention";
}) {
  return (
    <Link href={href} className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-bg-hover sm:px-4">
      <Icon glyph={glyph} tone={tone} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.875rem] font-medium" style={{ color: "var(--text)" }}>
          {title}
        </span>
        {hint ? (
          <span
            className="block truncate text-[0.75rem]"
            style={{ color: hintTone === "attention" ? "var(--attention)" : "var(--text-faint)" }}
          >
            {hint}
          </span>
        ) : null}
      </span>
      <span aria-hidden style={{ color: "var(--text-faint)" }}>
        ›
      </span>
    </Link>
  );
}

function Row({ item }: { item: NeedsYouItem }) {
  switch (item.kind) {
    case "sort":
      return (
        <LinkRow
          href="/app/finance/sort"
          glyph="🏷️"
          tone="accent"
          title={`Sort ${item.count} ${item.count === 1 ? "entry" : "entries"}`}
          hint={item.count > 3 ? "One at a time, about a minute" : "Give them a category"}
        />
      );
    case "card":
      return <CardRow item={item} />;
    case "short":
      return (
        <LinkRow
          href="/app/finance?tab=accounts"
          glyph="⚠️"
          tone="attention"
          title={`Checking is ${fmt(item.cents)} short`}
          hint="For card bills and other bills due in the next two weeks"
          hintTone="attention"
        />
      );
    case "statement":
      return (
        <LinkRow
          href={`/app/finance/check/${item.id}`}
          glyph="🧾"
          tone="neutral"
          title={`Check the ${item.name} statement`}
          hint="Match it against what you logged"
        />
      );
    case "bill":
      return (
        <LinkRow
          href="/app/finance?tab=plan#budgets"
          glyph="📅"
          tone={item.daysUntil <= 1 && !item.autopay ? "attention" : "neutral"}
          title={`${item.name}${item.amountCents != null ? ` ${fmt(item.amountCents)}` : ""}`}
          hint={`${when(item.daysUntil)}${item.autopay ? " · autopay" : ""}`}
          hintTone={item.daysUntil <= 1 && !item.autopay ? "attention" : undefined}
        />
      );
    case "balances":
      return (
        <LinkRow
          href="/app/finance/catch-up?only=invest"
          glyph="📈"
          tone="neutral"
          title="Monthly balance check-in"
          hint={`${item.count} ${item.count === 1 ? "balance hasn't" : "balances haven't"} been updated in a month`}
        />
      );
    case "checkin":
      return (
        <LinkRow
          href="/app/finance?tab=plan#money-date"
          glyph="☕"
          tone="neutral"
          title="Weekly money check-in"
          hint="Ten minutes together: pace, bills, anything odd"
        />
      );
  }
}

function CardRow({ item }: { item: Extract<NeedsYouItem, { kind: "card" }> }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const late = item.daysUntil <= 2;
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
      <Icon glyph="💳" tone={late ? "attention" : "neutral"} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.875rem] font-medium" style={{ color: "var(--text)" }}>
          {item.name} bill <span className="tabular">{exact(item.amountCents)}</span>
        </span>
        <span className="block truncate text-[0.75rem]" style={{ color: error ? "var(--attention)" : late ? "var(--attention)" : "var(--text-faint)" }}>
          {error ?? when(item.daysUntil)}
        </span>
      </span>
      <button
        type="button"
        disabled={pending}
        className="btn-ink shrink-0"
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await markCardBillPaid({
              cardId: item.id,
              fromAccountId: item.fromAccountId,
              amountCents: item.amountCents,
              date: todayKey(),
            });
            if (r && !r.ok) setError(r.error);
          })
        }
      >
        {pending ? "Saving…" : "Paid"}
      </button>
    </div>
  );
}
