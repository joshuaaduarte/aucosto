import { formatUSDFromCents } from "@/lib/money";
import type { FinanceDashboard } from "../_lib/derive";
import { ActionPill, QuickStat, SectionCard, SummaryCard } from "./ui";
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
      <section id="overview" className="space-y-4">
        <div className="rounded-[2.1rem] border border-zinc-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(250,250,248,0.96)),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_32%)] p-5 shadow-[0_28px_90px_-52px_rgba(24,24,27,0.22)] lg:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                Finance
              </p>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
                Start with the money read that actually changes decisions.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600 sm:text-base">
                See cash, spend pressure, and next actions first. Review transactions quickly. Tuck deeper account management out of the way until you need it.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:min-w-[340px]">
              <QuickStat
                label="Net worth"
                value={formatUSDFromCents(snapshot.netWorthCents)}
                tone={snapshot.netWorthCents >= 0 ? "positive" : "default"}
              />
              <QuickStat
                label="Cash"
                value={formatUSDFromCents(snapshot.cashCents)}
                tone={snapshot.cashCents >= 0 ? "positive" : "default"}
              />
              <QuickStat
                label="This month"
                value={formatUSDFromCents(thisMonthSummary.netCents)}
                tone={thisMonthSummary.netCents >= 0 ? "positive" : "default"}
              />
              <QuickStat
                label="Projected spend"
                value={formatUSDFromCents(spendProjection.projectedCents)}
              />
            </div>
          </div>
        </div>

        <div className="sticky top-[88px] z-20 -mx-4 border-y border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-0">
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:pb-0">
            <ActionPill href="#overview" label="Overview" />
            <ActionPill href="#transactions" label="Review" />
            <ActionPill href="#planning" label="Planning" />
            <ActionPill href="#insights" label="Insights" />
            <ActionPill href="#manage" label="Manage" />
            {count > 0 && <ClearButton />}
          </div>
        </div>

        <UploadForm />
      </section>

      {duplicateManualAccounts.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-5 py-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
          <p className="font-medium">
            I found likely duplicate manual accounts and excluded them from totals.
          </p>
          <p className="mt-1 text-amber-800 dark:text-amber-200">
            {duplicateManualAccounts.map((a) => a.name).join(", ")}. They still appear below so you can rename, edit, or delete them.
          </p>
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Snapshot" subtitle="Lead with the balances that matter most right now.">
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SummaryCard
              label="Available cash"
              value={formatUSDFromCents(snapshot.cashCents)}
              hint={`${snapshot.cashAccountCount} included account${snapshot.cashAccountCount === 1 ? "" : "s"}`}
            />
            <SummaryCard
              label="Cards owed"
              value={formatUSDFromCents(snapshot.cardsOwedCents)}
              hint={`${cardAccounts.length} tracked card${cardAccounts.length === 1 ? "" : "s"}`}
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
              valueClassName={snapshot.netWorthCents >= 0 ? "text-emerald-600" : "text-zinc-950"}
            />
          </div>
        </SectionCard>

        <SectionCard title="Watchlist" subtitle="Keep the next useful nudge visible.">
          <div className="mt-5 space-y-3">
            {alerts.length > 0 ? (
              alerts.map((alert) => (
                <div
                  key={alert.title}
                  className={`rounded-[1.4rem] border px-4 py-4 shadow-sm shadow-zinc-950/5 ${
                    alert.tone === "amber"
                      ? "border-amber-200 bg-amber-50/75"
                      : alert.tone === "emerald"
                        ? "border-emerald-200 bg-emerald-50/75"
                        : alert.tone === "sky"
                          ? "border-sky-200 bg-sky-50/75"
                          : "border-zinc-200 bg-zinc-50/75"
                  }`}
                >
                  <div className="flex gap-3">
                    <span
                      className={`mt-1.5 h-2.5 w-2.5 rounded-full ${
                        alert.tone === "amber"
                          ? "bg-amber-500"
                          : alert.tone === "emerald"
                            ? "bg-emerald-500"
                            : alert.tone === "sky"
                              ? "bg-sky-500"
                              : "bg-zinc-400"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{alert.title}</p>
                      <p className="mt-1 text-sm text-zinc-500">{alert.body}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-zinc-200 px-4 py-4 dark:border-zinc-800">
                <p className="text-sm text-zinc-500">
                  Import more activity or add due dates and goals to surface sharper finance nudges.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-[1.4rem] border border-zinc-200/80 bg-zinc-50/90 px-4 py-4 shadow-sm shadow-zinc-950/5">
                <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Net flow</p>
                <p className="mt-2 text-lg font-semibold text-zinc-950">
                  {formatUSDFromCents(thisMonthSummary.netCents)}
                </p>
                <p className="mt-1 text-xs text-zinc-500">after true spending</p>
              </div>
              <div className="rounded-[1.4rem] border border-zinc-200/80 bg-zinc-50/90 px-4 py-4 shadow-sm shadow-zinc-950/5">
                <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Next due</p>
                <p className="mt-2 text-lg font-semibold text-zinc-950">
                  {nextDueAccounts[0]?.dueDate
                    ? nextDueAccounts[0].dueDate.toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })
                    : "—"}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {nextDueAccounts[0]?.name ?? "No due dates tracked yet"}
                </p>
              </div>
              <div className="rounded-[1.4rem] border border-zinc-200/80 bg-zinc-50/90 px-4 py-4 shadow-sm shadow-zinc-950/5">
                <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Top pressure</p>
                <p className="mt-2 text-lg font-semibold text-zinc-950">
                  {topGoal?.name ?? topProjectedCategory?.category ?? "Waiting for more signal"}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {topGoalProgress
                    ? `${formatUSDFromCents(topGoalProgress.monthlyNeededCents)} / month needed`
                    : topProjectedCategory
                      ? `${formatUSDFromCents(topProjectedCategory.projectedCents)} projected`
                      : "Add goals or more activity"}
                </p>
              </div>
            </div>
          </div>
        </SectionCard>
      </section>
    </>
  );
}
