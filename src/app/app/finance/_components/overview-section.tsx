import { formatUSDFromCents } from "@/lib/money";
import type { FinanceDashboard } from "../_lib/derive";
import { QuickStat, SectionCard, SummaryCard } from "./ui";
import { ClearButton } from "../clear-button";
import { UploadForm } from "../upload-form";

export function OverviewSection({ data }: { data: FinanceDashboard }) {
  const {
    snapshot,
    thisMonthSummary,
    spendProjection,
    cardAccounts,
    duplicateManualAccounts,
    nextDueAccounts,
    topGoal,
    topGoalProgress,
    topProjectedCategory,
    alerts,
    count,
  } = data;

  return (
    <>
      <section id="overview" className="space-y-10">
        {/* Section masthead */}
        <header className="grid gap-10 lg:grid-cols-[1.55fr_1fr] lg:gap-14">
          <div className="lg:rule-r lg:border-rule lg:pr-14">
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.28em] text-ink-fade">
              Section III · The Ledger
            </p>
            <h1 className="mt-5 font-display font-medium leading-[0.92] tracking-[-0.045em] text-ink text-[2.6rem] sm:text-[3.6rem] lg:text-[4.4rem]">
              The coin,{" "}
              <span className="italic text-oxblood">in plain accounting</span>.
            </h1>
            <p className="mt-6 max-w-xl font-serif text-[1.05rem] leading-[1.75] italic text-ink-soft">
              What is on hand, what is owed, what is pacing where. The numbers
              are reconciled at the close of each post; the figures below are
              the latest reading.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-6">
            <QuickStat
              label="Net worth"
              value={formatUSDFromCents(snapshot.netWorthCents)}
              tone={snapshot.netWorthCents >= 0 ? "positive" : "default"}
            />
            <QuickStat
              label="Cash on hand"
              value={formatUSDFromCents(snapshot.cashCents)}
              tone={snapshot.cashCents >= 0 ? "positive" : "default"}
            />
            <QuickStat
              label="This month"
              value={formatUSDFromCents(thisMonthSummary.netCents)}
              tone={thisMonthSummary.netCents >= 0 ? "positive" : "default"}
            />
            <QuickStat
              label="Projected"
              value={formatUSDFromCents(spendProjection.projectedCents)}
            />
          </div>
        </header>

        {/* Table of contents row */}
        <nav
          className="rule-t rule-b border-ink/40 -mx-5 sm:mx-0 sticky top-0 z-20 bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/80"
          aria-label="Ledger sections"
        >
          <div className="no-scrollbar flex items-center gap-x-7 overflow-x-auto px-5 py-3 sm:px-0 sm:flex-wrap">
            <span className="font-mono text-[0.625rem] uppercase tracking-[0.24em] text-ink-fade shrink-0">
              Contents:
            </span>
            <a href="#overview" className="font-serif text-sm italic text-ink hover:text-oxblood underline-offset-4 decoration-rule shrink-0">i. Overview</a>
            <a href="#transactions" className="font-serif text-sm italic text-ink-fade hover:text-ink hover:underline underline-offset-4 decoration-rule shrink-0">ii. Daily accounts</a>
            <a href="#planning" className="font-serif text-sm italic text-ink-fade hover:text-ink hover:underline underline-offset-4 decoration-rule shrink-0">iii. Planning</a>
            <a href="#insights" className="font-serif text-sm italic text-ink-fade hover:text-ink hover:underline underline-offset-4 decoration-rule shrink-0">iv. Patterns</a>
            <a href="#manage" className="font-serif text-sm italic text-ink-fade hover:text-ink hover:underline underline-offset-4 decoration-rule shrink-0">v. Manage</a>
            {count > 0 && (
              <span className="ml-auto shrink-0">
                <ClearButton />
              </span>
            )}
          </div>
        </nav>

        <UploadForm />
      </section>

      {duplicateManualAccounts.length > 0 ? (
        <aside className="rule-t rule-b border-oxblood/60 bg-oxblood-soft px-5 py-4">
          <p className="font-display text-lg italic text-oxblood">
            ❦ Likely duplicate entries set aside from the totals.
          </p>
          <p className="mt-2 font-serif text-sm leading-relaxed text-ink-soft">
            <span className="italic text-ink-fade">In question:</span>{" "}
            {duplicateManualAccounts.map((a) => a.name).join(", ")}. They remain
            below should you wish to rename, edit, or strike them.
          </p>
        </aside>
      ) : null}

      <section className="grid gap-12 xl:grid-cols-[1.15fr_0.85fr] xl:gap-14">
        <SectionCard
          title="The Snapshot"
          subtitle="Lead with the balances that change today's decisions."
        >
          <div className="mt-3 grid grid-cols-1 gap-x-10 gap-y-2 sm:grid-cols-2">
            <SummaryCard
              label="Available cash"
              value={formatUSDFromCents(snapshot.cashCents)}
              hint={`${snapshot.cashAccountCount} included account${snapshot.cashAccountCount === 1 ? "" : "s"}`}
            />
            <SummaryCard
              label="Cards owed"
              value={formatUSDFromCents(snapshot.cardsOwedCents)}
              hint={`${cardAccounts.length} tracked card${cardAccounts.length === 1 ? "" : "s"}`}
              valueClassName="text-oxblood"
            />
            <SummaryCard
              label="Long-term"
              value={formatUSDFromCents(snapshot.investmentCents + snapshot.retirementCents)}
              hint="investments + retirement"
            />
            <SummaryCard
              label="Net worth"
              value={formatUSDFromCents(snapshot.netWorthCents)}
              hint={`${snapshot.netWorthAccountCount} included account${snapshot.netWorthAccountCount === 1 ? "" : "s"}`}
              valueClassName={snapshot.netWorthCents >= 0 ? "text-verdigris" : "text-oxblood"}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="The Watchlist"
          subtitle="The next useful nudge, kept in plain sight."
        >
          <div className="mt-3 space-y-0">
            {alerts.length > 0 ? (
              alerts.map((alert) => (
                <div
                  key={alert.title}
                  className="grid grid-cols-[auto_1fr] items-baseline gap-3 rule-soft-b border-rule py-4"
                >
                  <span
                    aria-hidden
                    className={`h-2 w-2 mt-1.5 rounded-full ${
                      alert.tone === "amber"
                        ? "bg-aged-gold"
                        : alert.tone === "emerald"
                          ? "bg-verdigris"
                          : alert.tone === "sky"
                            ? "bg-ink-soft"
                            : "bg-ink-ghost"
                    }`}
                  />
                  <div>
                    <p className="font-display text-base text-ink">{alert.title}</p>
                    <p className="mt-0.5 font-serif text-sm italic leading-relaxed text-ink-fade">
                      {alert.body}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="font-serif text-sm italic text-ink-fade py-4">
                Import more activity or add due dates and goals to surface
                sharper nudges.
              </p>
            )}

            <div className="mt-5 grid grid-cols-1 gap-x-8 sm:grid-cols-3">
              <QuickStat
                label="Net flow"
                value={formatUSDFromCents(thisMonthSummary.netCents)}
                tone={thisMonthSummary.netCents >= 0 ? "positive" : "default"}
              />
              <QuickStat
                label="Next due"
                value={
                  nextDueAccounts[0]?.dueDate
                    ? nextDueAccounts[0].dueDate.toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })
                    : "—"
                }
              />
              <QuickStat
                label="Top pressure"
                value={topGoal?.name ?? topProjectedCategory?.category ?? "—"}
              />
            </div>
            <p className="mt-3 font-serif text-xs italic text-ink-fade">
              {topGoalProgress
                ? `${formatUSDFromCents(topGoalProgress.monthlyNeededCents)} per month needed`
                : topProjectedCategory
                  ? `${formatUSDFromCents(topProjectedCategory.projectedCents)} projected this month`
                  : "Add goals or more activity to refine."}
            </p>
          </div>
        </SectionCard>
      </section>
    </>
  );
}
