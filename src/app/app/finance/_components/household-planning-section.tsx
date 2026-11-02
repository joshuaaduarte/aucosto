import type { FinanceBill } from "@/generated/prisma/client";
import { formatUSDFromCents } from "@/lib/money";
import {
  dueLabel,
  formatCadence,
  type BillDue,
  type BudgetProgress,
  type MoneyDateSummary,
} from "@/lib/finance-planning";
import {
  AddBill,
  BillActions,
  BudgetForm,
  MoneyDateDoneButton,
  RemoveBudgetButton,
} from "./planning-forms";
import { ProgressBar, SectionCard } from "./ui";

export type HouseholdPlanningData = {
  budgets: Array<BudgetProgress & { id: string }>;
  bills: Array<BillDue<FinanceBill>>;
  billSuggestions: Array<{ name: string; amount: string; nextDueAt: string }>;
  moneyDate: MoneyDateSummary;
  moneyDateDone: { at: Date; by: string | null } | null;
  /** Household name when this is the shared space; null for "Just me". */
  sharedWith: string | null;
};

const faint = { color: "var(--text-faint)" } as const;
const muted = { color: "var(--text-muted)" } as const;

export function HouseholdPlanningSection({ data }: { data: HouseholdPlanningData }) {
  return (
    <section id="budgets" className="space-y-10">
      <header>
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={faint}>
          This month
        </p>
        <h2 className="mt-1 text-[1.25rem] font-semibold tracking-tight" style={{ color: "var(--text)" }}>
          Budgets, bills, and the weekly check-in.
        </h2>
      </header>

      <MoneyDate data={data} />

      <div className="grid gap-12 xl:grid-cols-[1fr_1fr] xl:gap-14">
        <SectionCard
          title="Budgets"
          subtitle={
            data.budgets.length
              ? "Monthly limits, with where this month is heading."
              : "Set a monthly limit for the categories you want to watch."
          }
        >
          <ul className="space-y-4">
            {data.budgets.map((budget) => (
              <li key={budget.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[0.875rem] font-medium" style={{ color: "var(--text)" }}>
                    {budget.category}
                  </p>
                  <p className="tabular text-[0.8125rem]" style={muted}>
                    {formatUSDFromCents(budget.spentCents)} of {formatUSDFromCents(budget.limitCents)}
                  </p>
                </div>
                <ProgressBar
                  percent={budget.percentUsed}
                  tone={budget.status === "on_track" ? "emerald" : "amber"}
                />
                <div className="mt-1 flex items-center justify-between gap-3">
                  <p className="text-[0.75rem]" style={budget.status === "on_track" ? faint : { color: "var(--accent-strong)" }}>
                    {budget.status === "over"
                      ? `Over by ${formatUSDFromCents(-budget.remainingCents)}`
                      : budget.status === "at_risk"
                        ? `Heading for ${formatUSDFromCents(budget.projectedCents)} at this pace`
                        : `${formatUSDFromCents(budget.remainingCents)} left, on track`}
                  </p>
                  <RemoveBudgetButton id={budget.id} />
                </div>
              </li>
            ))}
          </ul>
          <div className={data.budgets.length ? "mt-5" : ""}>
            <BudgetForm usedCategories={data.budgets.map((b) => b.category)} />
          </div>
        </SectionCard>

        <SectionCard
          title="Bills and renewals"
          subtitle="Rent, insurance, subscriptions, registrations. Marking one paid rolls it to the next due date."
        >
          {data.bills.length ? (
            <ul className="mb-5 divide-y" style={{ borderColor: "var(--border-faint)" }}>
              {data.bills.map((bill) => (
                <li key={bill.id} className="flex items-center justify-between gap-3 py-2.5" style={{ borderColor: "var(--border-faint)" }}>
                  <div className="min-w-0">
                    <p className="truncate text-[0.875rem]" style={{ color: "var(--text)" }}>
                      {bill.name}
                      {bill.amountCents != null ? (
                        <span className="tabular" style={muted}> · {formatUSDFromCents(bill.amountCents)}</span>
                      ) : null}
                    </p>
                    <p
                      className="text-[0.75rem]"
                      style={bill.daysUntil <= 3 && !bill.autopay ? { color: "var(--accent-strong)" } : faint}
                    >
                      {dueLabel(bill.daysUntil)} ·{" "}
                      {bill.nextDueAt.toLocaleDateString([], { month: "short", day: "numeric" })} ·{" "}
                      {formatCadence(bill.cadence)}
                      {bill.autopay ? " · autopay" : ""}
                    </p>
                  </div>
                  <BillActions id={bill.id} />
                </li>
              ))}
            </ul>
          ) : null}
          <AddBill suggestions={data.billSuggestions} />
        </SectionCard>
      </div>
    </section>
  );
}

function MoneyDate({ data }: { data: HouseholdPlanningData }) {
  const m = data.moneyDate;
  const delta = m.lastSevenDaysSpentCents - m.previousSevenDaysSpentCents;
  const items: string[] = [];
  items.push(
    `${formatUSDFromCents(m.lastSevenDaysSpentCents)} spent in the last 7 days (${delta >= 0 ? "+" : "−"}${formatUSDFromCents(Math.abs(delta))} vs the week before).`,
  );
  if (m.topCategories.length) {
    items.push(
      `Most went to ${m.topCategories.map((c) => `${c.category} (${formatUSDFromCents(c.spentCents)})`).join(", ")}.`,
    );
  }
  if (m.budgetsNeedingAttention.length) {
    items.push(
      `Watch ${m.budgetsNeedingAttention.map((b) => b.category).join(", ")}: ${m.budgetsNeedingAttention.length === 1 ? "it's" : "they're"} over or heading over budget.`,
    );
  }
  if (m.billsComingUp) {
    items.push(`${m.billsComingUp} bill${m.billsComingUp === 1 ? "" : "s"} due in the next 7 days.`);
  }
  if (m.uncategorizedCount) {
    items.push(`${m.uncategorizedCount} transaction${m.uncategorizedCount === 1 ? "" : "s"} this week still need a category.`);
  }

  return (
    <div className="rounded-md border p-5" style={{ borderColor: "var(--border-soft)", background: "var(--bg-page)" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={faint}>
          {data.sharedWith ? "Weekly money date" : "Weekly money check-in"}
        </p>
        {data.moneyDateDone ? (
          <p className="text-[0.75rem]" style={faint}>
            Done {data.moneyDateDone.at.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
            {data.moneyDateDone.by ? ` by ${data.moneyDateDone.by}` : ""}
          </p>
        ) : null}
      </div>
      <ul className="mt-3 space-y-1.5 text-[0.875rem]" style={{ color: "var(--text)" }}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {data.moneyDateDone ? null : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <MoneyDateDoneButton weekKey={m.weekKey} />
          <p className="text-[0.75rem]" style={faint}>
            Ten minutes together: look over this, recategorize, check bills and goals.
          </p>
        </div>
      )}
    </div>
  );
}
