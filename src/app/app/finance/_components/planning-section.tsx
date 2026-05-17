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
      <header className="rule-t border-ink pt-4">
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.26em] text-ink-fade">
          Section III · Planning
        </p>
        <h2 className="mt-2 font-display text-3xl font-medium italic tracking-[-0.02em] text-ink">
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
              <div className="mt-3 grid grid-cols-2 gap-x-10 gap-y-2 xl:grid-cols-4">
                <SummaryCard
                  label="Funded"
                  value={formatUSDFromCents(goalSnapshot.fundedCents)}
                  hint={`${goalSnapshot.activeCount} active`}
                  valueClassName="text-verdigris"
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
              <ul className="mt-6 divide-y divide-rule-soft">
                {activeGoals.slice(0, 4).map((goal) => {
                  const summary = summarizeGoal(goal);
                  return (
                    <li key={goal.id} className="py-5">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <p className="font-display text-lg text-ink">{goal.name}</p>
                        <span className="font-mono text-[0.625rem] uppercase tracking-[0.22em] text-ink-fade">
                          — {formatGoalCategory(goal.category)}
                        </span>
                      </div>
                      <p className="mt-1 font-serif text-sm italic text-ink-fade">
                        <span className="not-italic font-mono tabular text-ink-soft">
                          {formatUSDFromCents(goal.currentAmountCents)}
                        </span>{" "}
                        of{" "}
                        <span className="not-italic font-mono tabular text-ink-soft">
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
                      <div className="mt-2 flex items-center justify-between gap-3 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-ink-fade">
                        <span>{summary.fundedPercent}% funded</span>
                        <span className="italic font-serif normal-case tracking-normal">
                          {summary.targetDateLabel ?? "no date set"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="mt-5 rule-t rule-b border-rule px-2 py-10 text-center font-serif italic text-ink-fade">
              ❦ Set your first bucket and the planning will begin to take shape. ❦
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
            <div className="mt-3 space-y-6">
              <div className="rule-t border-ink/30 pt-4">
                <p className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-ink-fade">
                  Projected true spend
                </p>
                <p className="mt-3 font-display text-[2.4rem] font-medium leading-none tracking-[-0.03em] tabular text-oxblood">
                  {formatUSDFromCents(spendProjection.projectedCents)}
                </p>
                <p className="mt-2 font-serif text-sm italic text-ink-fade">
                  <span className="not-italic font-mono tabular text-ink-soft">
                    {formatUSDFromCents(Math.round(spendProjection.burnRateCentsPerDay))}
                  </span>{" "}
                  per day at the current pace
                </p>
                {lastMonthSummary.spentCents > 0 ? (
                  <p className="mt-2 font-serif text-sm italic text-ink-fade">
                    against last month’s spend:{" "}
                    <span className="not-italic font-mono tabular text-ink-soft">
                      {formatSignedUSDFromCents(spendDeltaCents)}
                    </span>
                    {spendDeltaPercent ? ` (${spendDeltaPercent})` : ""}
                  </p>
                ) : null}
              </div>
              <div className="grid grid-cols-1 gap-x-10 gap-y-2 sm:grid-cols-3">
                <SummaryCard
                  label="Spent"
                  value={formatUSDFromCents(thisMonthSummary.spentCents)}
                  valueClassName="text-oxblood"
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
                  valueClassName="text-verdigris"
                />
                <SummaryCard
                  label="Net flow"
                  value={formatUSDFromCents(thisMonthSummary.netCents)}
                  hint={
                    lastMonth.length > 0
                      ? `vs last ${formatSignedUSDFromCents(netDeltaCents)}${netDeltaPercent ? ` · ${netDeltaPercent}` : ""}`
                      : "income minus true spend"
                  }
                  valueClassName={thisMonthSummary.netCents >= 0 ? "text-verdigris" : "text-oxblood"}
                />
              </div>
              {categoryProjections.length > 0 && (
                <ul className="rule-soft-t border-rule pt-4 divide-y divide-rule-soft">
                  {categoryProjections.map((item) => {
                    const lastMonthCategory = lastMonthTopCategories.find(
                      (category) => category.category === item.category,
                    );
                    return (
                      <li
                        key={item.category}
                        className="grid grid-cols-[1fr_auto] items-baseline gap-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-display text-base text-ink">
                            {item.category}
                          </p>
                          {lastMonthCategory ? (
                            <p className="font-serif text-xs italic text-ink-fade">
                              {formatSignedUSDFromCents(
                                item.projectedCents - lastMonthCategory.spendCents,
                              )}{" "}
                              vs last month
                            </p>
                          ) : null}
                        </div>
                        <span className="font-mono text-sm tabular text-ink-soft">
                          {formatUSDFromCents(item.projectedCents)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : (
            <p className="mt-5 rule-t rule-b border-rule px-2 py-10 text-center font-serif italic text-ink-fade">
              ❦ Import entries to see pace, projection, and drift. ❦
            </p>
          )}
        </SectionCard>
      </div>
    </section>
  );
}
