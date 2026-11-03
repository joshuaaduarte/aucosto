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
          Limits and bills
        </p>
        <h2 className="mt-1 text-[1.25rem] font-semibold tracking-tight" style={{ color: "var(--text)" }}>
          Category limits and recurring bills
        </h2>
      </header>

      <div className="grid gap-12 xl:grid-cols-[1fr_1fr] xl:gap-14">
        <SectionCard
          title="Category limits"
          subtitle={
            data.budgets.length
              ? "Optional limits for categories you want to watch closely."
              : "Optional: a monthly limit for a category you want to watch closely, like eating out."
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
          subtitle="Rent, insurance, subscriptions, registrations. These count as fixed costs, not everyday spending. Marking one paid rolls it to the next due date."
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
