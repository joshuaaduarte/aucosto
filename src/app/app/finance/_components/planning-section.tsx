import { formatGoalCategory } from "@/lib/finance-goals";
import { summarizeGoal } from "@/lib/finance-goals";
import { formatSignedUSDFromCents, formatUSDFromCents } from "@/lib/money";
import type { FinanceDashboard } from "../_lib/derive";
import { ProgressBar, SectionCard, SummaryCard } from "./ui";

export function PlanningSection({ data }: { data: FinanceDashboard }) {
  const {
    goals,
    activeGoals,
    goalSnapshot,
    count,
    spendProjection,
    lastMonthSummary,
    lastMonth,
    thisMonthSummary,
    spendDeltaCents,
    spendDeltaPercent,
    netDeltaCents,
    netDeltaPercent,
    categoryProjections,
    lastMonthTopCategories,
  } = data;

  return (
    <section id="planning" className="space-y-10">
      <header>
        <p
          className="text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Planning
        </p>
        <h2
          className="mt-1 text-[1.25rem] font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          The figures, looking forward.
        </h2>
      </header>

      <div className="grid gap-12 xl:grid-cols-[1fr_1fr] xl:gap-14">
        <SectionCard
          title="The Goals"
          subtitle={
            goals.length > 0
              ? "Buckets are kept in view, but not in noise."
              : "Set aside buckets for the wedding, the trip, the cushion."
          }
        >
          {goals.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-x-8 gap-y-5 xl:grid-cols-4">
                <SummaryCard
                  label="Funded"
                  value={formatUSDFromCents(goalSnapshot.fundedCents)}
                  hint={`${goalSnapshot.activeCount} active`}
                />
                <SummaryCard
                  label="Target"
                  value={formatUSDFromCents(goalSnapshot.targetCents)}
                  hint={`${goalSnapshot.fundedPercent}% funded`}
                />
                <SummaryCard
                  label="Remaining"
                  value={formatUSDFromCents(goalSnapshot.remainingCents)}
                  hint="left across active goals"
                />
                <SummaryCard
                  label="Monthly pace"
                  value={formatUSDFromCents(goalSnapshot.monthlyNeededCents)}
                  hint="to stay on track"
                />
              </div>
              <ul className="mt-6 space-y-4">
                {activeGoals.slice(0, 4).map((goal) => {
                  const summary = summarizeGoal(goal);
                  return (
                    <li
                      key={goal.id}
                      className="rounded-md px-3 py-3"
                      style={{ background: "var(--bg-tint)" }}
                    >
                      <div className="flex flex-wrap items-baseline gap-2">
                        <p
                          className="text-[0.9375rem] font-semibold tracking-tight"
                          style={{ color: "var(--text)" }}
                        >
                          {goal.name}
                        </p>
                        <span
                          className="inline-flex items-center rounded px-1.5 py-0.5 text-[0.625rem] font-medium"
                          style={{
                            background: "var(--bg-tint-strong)",
                            color: "var(--text-muted)",
                          }}
                        >
                          {formatGoalCategory(goal.category)}
                        </span>
                      </div>
                      <p
                        className="mt-1 text-[0.8125rem]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <span className="tabular font-medium">
                          {formatUSDFromCents(goal.currentAmountCents)}
                        </span>{" "}
                        of{" "}
                        <span className="tabular font-medium">
                          {formatUSDFromCents(goal.targetAmountCents)}
                        </span>
                      </p>
                      <ProgressBar
                        percent={summary.fundedPercent}
                        tone={
                          summary.fundedPercent >= 60
                            ? "emerald"
                            : summary.fundedPercent >= 30
                              ? "sky"
                              : "amber"
                        }
                      />
                      <div
                        className="mt-2 flex items-center justify-between gap-3 text-[0.6875rem] font-medium uppercase tracking-wider"
                        style={{ color: "var(--text-faint)" }}
                      >
                        <span>{summary.fundedPercent}% funded</span>
                        <span className="normal-case tracking-normal">
                          {summary.targetDateLabel ?? "no date set"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p
              className="rounded-md py-8 text-center text-[0.875rem]"
              style={{
                color: "var(--text-muted)",
                border: "1px dashed var(--border)",
              }}
            >
              Set your first bucket and the planning will begin to take shape.
            </p>
          )}
        </SectionCard>

        <SectionCard
          title="The Monthly Outlook"
          subtitle={
            count > 0
              ? "Projection first; comparison against the prior month after."
              : "Outlook sharpens once entries are imported."
          }
        >
          {count > 0 ? (
            <div className="space-y-6">
              <div
                className="rounded-md p-4"
                style={{
                  background: "var(--bg-tint)",
                  border: "1px solid var(--border-faint)",
                }}
              >
                <p
                  className="text-[0.6875rem] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-faint)" }}
                >
                  Projected true spend
                </p>
                <p
                  className="mt-1 text-[1.875rem] font-semibold tracking-tight tabular"
                  style={{
                    color: "var(--text)",
                    letterSpacing: "-0.025em",
                  }}
                >
                  {formatUSDFromCents(spendProjection.projectedCents)}
                </p>
                <p
                  className="mt-1 text-[0.8125rem]"
                  style={{ color: "var(--text-muted)" }}
                >
                  <span className="tabular font-medium">
                    {formatUSDFromCents(Math.round(spendProjection.burnRateCentsPerDay))}
                  </span>{" "}
                  per day at the current pace
                </p>
                {lastMonthSummary.spentCents > 0 && (
                  <p
                    className="mt-1 text-[0.8125rem]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    vs last month spend:{" "}
                    <span className="tabular font-medium">
                      {formatSignedUSDFromCents(spendDeltaCents)}
                    </span>
                    {spendDeltaPercent ? ` (${spendDeltaPercent})` : ""}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-3">
                <SummaryCard
                  label="Spent"
                  value={formatUSDFromCents(thisMonthSummary.spentCents)}
                  hint={
                    lastMonthSummary.spentCents > 0
                      ? `vs last ${formatSignedUSDFromCents(spendDeltaCents)}${spendDeltaPercent ? ` · ${spendDeltaPercent}` : ""}`
                      : "true spend so far"
                  }
                />
                <SummaryCard
                  label="Income"
                  value={formatUSDFromCents(thisMonthSummary.incomeCents)}
                  hint="income + reimbursements"
                />
                <SummaryCard
                  label="Net flow"
                  value={formatUSDFromCents(thisMonthSummary.netCents)}
                  hint={
                    lastMonth.length > 0
                      ? `vs last ${formatSignedUSDFromCents(netDeltaCents)}${netDeltaPercent ? ` · ${netDeltaPercent}` : ""}`
                      : "income minus true spend"
                  }
                />
              </div>
              {categoryProjections.length > 0 && (
                <ul className="pt-4" style={{ borderTop: "1px solid var(--border-faint)" }}>
                  {categoryProjections.map((item) => {
                    const lastMonthCategory = lastMonthTopCategories.find(
                      (category) => category.category === item.category,
                    );
                    return (
                      <li
                        key={item.category}
                        className="grid grid-cols-[1fr_auto] items-baseline gap-4 py-2"
                        style={{ borderTop: "1px solid var(--border-faint)" }}
                      >
                        <div className="min-w-0">
                          <p
                            className="truncate text-[0.875rem] font-medium"
                            style={{ color: "var(--text)" }}
                          >
                            {item.category}
                          </p>
                          {lastMonthCategory && (
                            <p
                              className="text-[0.75rem]"
                              style={{ color: "var(--text-faint)" }}
                            >
                              {formatSignedUSDFromCents(
                                item.projectedCents - lastMonthCategory.spendCents,
                              )}{" "}
                              vs last month
                            </p>
                          )}
                        </div>
                        <span
                          className="text-[0.8125rem] tabular font-medium"
                          style={{ color: "var(--text)" }}
                        >
                          {formatUSDFromCents(item.projectedCents)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : (
            <p
              className="rounded-md py-8 text-center text-[0.875rem]"
              style={{
                color: "var(--text-muted)",
                border: "1px dashed var(--border)",
              }}
            >
              Import entries to see pace, projection, and drift.
            </p>
          )}
        </SectionCard>
      </div>
    </section>
  );
}
