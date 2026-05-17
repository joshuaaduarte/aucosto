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
    <section id="planning" className="grid gap-4 xl:grid-cols-[1fr_1fr]">
      <SectionCard
        title="Goals snapshot"
        subtitle={
          goals.length > 0
            ? "Buckets stay visible, but not noisy."
            : "Add buckets for wedding, emergency fund, vacation, or projects."
        }
      >
        {goals.length > 0 ? (
          <>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                label="Funded"
                value={formatUSDFromCents(goalSnapshot.fundedCents)}
                hint={`${goalSnapshot.activeCount} active bucket${goalSnapshot.activeCount === 1 ? "" : "s"}`}
              />
              <SummaryCard
                label="Target"
                value={formatUSDFromCents(goalSnapshot.targetCents)}
                hint={`${goalSnapshot.fundedPercent}% funded overall`}
              />
              <SummaryCard
                label="Remaining"
                value={formatUSDFromCents(goalSnapshot.remainingCents)}
                hint="left across active goals"
              />
              <SummaryCard
                label="Monthly pace"
                value={formatUSDFromCents(goalSnapshot.monthlyNeededCents)}
                hint="needed to stay on track"
              />
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {activeGoals.slice(0, 4).map((goal) => {
                const summary = summarizeGoal(goal);
                return (
                  <div
                    key={goal.id}
                    className="rounded-[1.4rem] border border-zinc-200 bg-zinc-50/75 px-4 py-4 shadow-sm shadow-zinc-950/5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-zinc-900">{goal.name}</p>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-zinc-600 ring-1 ring-zinc-200">
                        {formatGoalCategory(goal.category)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-500">
                      {formatUSDFromCents(goal.currentAmountCents)} of {formatUSDFromCents(goal.targetAmountCents)}
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
                    <div className="mt-2 flex items-center justify-between gap-3 text-xs text-zinc-500">
                      <span>{summary.fundedPercent}% funded</span>
                      <span>{summary.targetDateLabel ?? "no date"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-sm text-zinc-500">
            Add your first bucket to start tracking wedding, trips, emergency fund, or project savings.
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Monthly planning"
        subtitle={
          count > 0
            ? "Projection first, then compare against last month."
            : "This gets smarter once transactions are imported."
        }
      >
        {count > 0 ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50/90 px-4 py-4 shadow-sm shadow-zinc-950/5">
              <p className="text-sm text-zinc-500">Projected true spend</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
                {formatUSDFromCents(spendProjection.projectedCents)}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                {formatUSDFromCents(Math.round(spendProjection.burnRateCentsPerDay))} / day at the current pace
              </p>
              {lastMonthSummary.spentCents > 0 ? (
                <p className="mt-2 text-sm text-zinc-500">
                  vs last month true spend:{" "}
                  <span className="font-medium text-zinc-700">
                    {formatSignedUSDFromCents(spendDeltaCents)}
                    {spendDeltaPercent ? ` (${spendDeltaPercent})` : ""}
                  </span>
                </p>
              ) : null}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <SummaryCard
                label="Spent"
                value={formatUSDFromCents(thisMonthSummary.spentCents)}
                hint={
                  lastMonthSummary.spentCents > 0
                    ? `vs last month ${formatSignedUSDFromCents(spendDeltaCents)}${spendDeltaPercent ? ` · ${spendDeltaPercent}` : ""}`
                    : "true spend so far"
                }
              />
              <SummaryCard
                label="Income"
                value={formatUSDFromCents(thisMonthSummary.incomeCents)}
                hint="income + reimbursements"
                valueClassName="text-emerald-600"
              />
              <SummaryCard
                label="Net flow"
                value={formatUSDFromCents(thisMonthSummary.netCents)}
                hint={
                  lastMonth.length > 0
                    ? `vs last month ${formatSignedUSDFromCents(netDeltaCents)}${netDeltaPercent ? ` · ${netDeltaPercent}` : ""}`
                    : "income minus true spend"
                }
                valueClassName={
                  thisMonthSummary.netCents >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-zinc-950 dark:text-zinc-50"
                }
              />
            </div>
            {categoryProjections.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {categoryProjections.map((item) => {
                  const lastMonthCategory = lastMonthTopCategories.find(
                    (category) => category.category === item.category,
                  );
                  return (
                    <div
                      key={item.category}
                      className="rounded-2xl border border-zinc-200 px-4 py-4 dark:border-zinc-800"
                    >
                      <p className="truncate text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        {item.category}
                      </p>
                      <p className="mt-1 font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
                        {formatUSDFromCents(item.projectedCents)}
                      </p>
                      <p className="text-xs text-zinc-500">
                        projected this month
                        {lastMonthCategory
                          ? ` · ${formatSignedUSDFromCents(item.projectedCents - lastMonthCategory.spendCents)} vs last month`
                          : ""}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-sm text-zinc-500 dark:border-zinc-700">
            Import transactions to see monthly pace, projected spend, and category drift.
          </div>
        )}
      </SectionCard>
    </section>
  );
}
