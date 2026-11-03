// The weekly money date as a short guided list: each line is one thing to
// do, with a link straight to where you do it. About 15 minutes together.

import Link from "next/link";
import { formatUSDFromCents } from "@/lib/money";
import { dueLabel, type MoneyDateSummary } from "@/lib/finance-planning";
import { MoneyDateDoneButton } from "./planning-forms";

type Step = { text: string; href?: string; done?: boolean };

function fmt(cents: number) {
  return formatUSDFromCents(cents, { maximumFractionDigits: 0 });
}

export function WeeklyCheckIn({
  moneyDate,
  done,
  shared,
  toSortCount,
  pendingCount,
  paceLine,
  statementsDue,
  staleBalances,
  billsDue,
  cardsDue = [],
  checkInDue = false,
  safeShortCents = 0,
}: {
  moneyDate: MoneyDateSummary;
  done: { at: Date; by: string | null } | null;
  shared: boolean;
  toSortCount: number;
  pendingCount: number;
  paceLine: string;
  statementsDue: Array<{ id: string; name: string }>;
  staleBalances: Array<{ id: string; name: string }>;
  billsDue: Array<{ id: string; name: string; amountCents: number | null; daysUntil: number; autopay: boolean }>;
  cardsDue?: Array<{ id: string; name: string; amountCents: number; daysUntil: number }>;
  checkInDue?: boolean;
  safeShortCents?: number;
}) {
  const delta = moneyDate.lastSevenDaysSpentCents - moneyDate.previousSevenDaysSpentCents;
  const steps: Step[] = [
    toSortCount
      ? { text: `Sort ${toSortCount} ${toSortCount === 1 ? "entry" : "entries"} with no category`, href: "/app/finance?tab=spending&filter=to_sort" }
      : { text: "Everything has a category", done: true },
    {
      text: `${paceLine}. Last 7 days: ${fmt(moneyDate.lastSevenDaysSpentCents)} (${delta >= 0 ? "+" : "−"}${fmt(Math.abs(delta))} vs the week before)${
        moneyDate.topCategories.length ? `, mostly ${moneyDate.topCategories.map((c) => c.category).join(", ")}` : ""
      }.`,
    },
  ];
  if (moneyDate.budgetsNeedingAttention.length) {
    steps.push({
      text: `Watch ${moneyDate.budgetsNeedingAttention.map((b) => b.category).join(", ")}: over or heading over its limit`,
      href: "/app/finance?tab=plan",
    });
  }
  for (const bill of billsDue) {
    steps.push({
      text: `${bill.name}${bill.amountCents != null ? ` (${fmt(bill.amountCents)})` : ""}: ${dueLabel(bill.daysUntil).toLowerCase()}${bill.autopay ? ", paid automatically" : ""}`,
      href: "/app/finance?tab=plan",
    });
  }
  for (const card of cardsDue) {
    steps.push({
      text: `${card.name} card bill (${fmt(card.amountCents)}): ${dueLabel(card.daysUntil).toLowerCase()}`,
      href: "/app/finance",
    });
  }
  if (safeShortCents > 0) {
    steps.push({
      text: `Checking is ${fmt(safeShortCents)} short of the bills due in the next two weeks. Move money in before they're due.`,
      href: "/app/finance",
    });
  }
  for (const account of statementsDue) {
    steps.push({ text: `Check the ${account.name} statement`, href: `/app/finance/check/${account.id}` });
  }
  if (staleBalances.length || checkInDue) {
    steps.push({
      text: staleBalances.length
        ? `Monthly check-in: update ${staleBalances.map((a) => a.name).join(", ")}`
        : "Monthly check-in: update savings and investment balances",
      href: "/app/finance/catch-up?only=invest",
    });
  }
  if (pendingCount && !statementsDue.length) {
    steps.push({ text: `${pendingCount} logged ${pendingCount === 1 ? "entry is" : "entries are"} waiting for the next statement`, done: true });
  }
  steps.push({ text: "Pick one thing to do differently next week" });

  return (
    <section className="rounded-md border p-5" style={{ borderColor: "var(--border-soft)" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[0.9375rem] font-semibold" style={{ color: "var(--text)" }}>
          {shared ? "Weekly money date" : "Weekly money check-in"}
        </p>
        <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
          {done
            ? `Done ${done.at.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}${done.by ? ` by ${done.by}` : ""}`
            : "About 15 minutes"}
        </p>
      </div>
      <ol className="mt-3 space-y-2">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-2.5 text-[0.875rem]" style={{ color: step.done ? "var(--text-faint)" : "var(--text)" }}>
            <span
              aria-hidden
              className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.6875rem]"
              style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
            >
              {step.done ? "✓" : i + 1}
            </span>
            {step.href ? (
              <Link href={step.href} className="underline-offset-4 hover:underline">
                {step.text} →
              </Link>
            ) : (
              <span>{step.text}</span>
            )}
          </li>
        ))}
      </ol>
      {done ? null : (
        <div className="mt-4">
          <MoneyDateDoneButton weekKey={moneyDate.weekKey} />
        </div>
      )}
    </section>
  );
}
