import type { ReactNode } from "react";
import { auth } from "@/auth";
import { summarizeBalances } from "@/lib/finance-accounts";
import { resolveCategory } from "@/lib/finance-categories";
import { formatGoalCategory, summarizeGoal, summarizeGoals } from "@/lib/finance-goals";
import { calculateSpendProjection, projectCategories } from "@/lib/finance-pace";
import { classifyTransaction, formatTransactionType } from "@/lib/finance-types";
import {
  findRecurringCandidates,
  summarizeCashflow,
  summarizeTransactionTypes,
  topCategoriesBySpend,
  topMerchantsBySpend,
} from "@/lib/finance-summary";
import { countTransactions, listAccounts, listGoals, listTransactions } from "@/lib/services/finance";
import { AccountsPanel } from "./accounts-panel";
import { CategorySelect } from "./category-select";
import { ClearButton } from "./clear-button";
import { GoalsPanel } from "./goals-panel";
import { UploadForm } from "./upload-form";

export const dynamic = "force-dynamic";

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatUSDFromCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function summaryCard({
  label,
  value,
  hint,
  valueClassName,
  className,
}: {
  label: string;
  value: string;
  hint: string;
  valueClassName?: string;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none ${className ?? ""}`}>
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">{label}</p>
      <p className={`mt-3 text-2xl font-semibold tracking-tight ${valueClassName ?? "text-zinc-950 dark:text-zinc-50"}`}>{value}</p>
      <p className="mt-1 text-sm text-zinc-500">{hint}</p>
    </div>
  );
}

function sectionCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none ${className ?? ""}`}>
      <div className="flex flex-col gap-1">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">{title}</h2>
        {subtitle ? <p className="text-sm text-zinc-500">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

function typeTone(type: string): string {
  switch (type) {
    case "income":
    case "reimbursement":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20";
    case "credit_card_payment":
    case "transfer":
      return "bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20";
    case "housing":
      return "bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/20";
    case "fee":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20";
    default:
      return "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700";
  }
}

function progressBar(percent: number, tone: "emerald" | "sky" | "amber" = "emerald") {
  const toneClass = {
    emerald: "bg-emerald-500",
    sky: "bg-sky-500",
    amber: "bg-amber-500",
  }[tone];

  return (
    <div className="mt-3 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
      <div className={`${toneClass} h-2 rounded-full transition-all`} style={{ width: `${Math.max(4, Math.min(100, percent))}%` }} />
    </div>
  );
}

function actionPill({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex min-h-10 items-center justify-center rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-sm text-zinc-700 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
    >
      {label}
    </a>
  );
}

function quickStat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "positive" }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm shadow-zinc-950/5 backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:shadow-none">
      <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className={`mt-2 text-lg font-semibold tracking-tight ${tone === "positive" ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-950 dark:text-zinc-50"}`}>{value}</p>
    </div>
  );
}

export default async function FinancePage() {
  const session = await auth();
  const userId = session!.user.id;

  const monthStart = startOfMonth();
  const [accounts, goals, count, recent, thisMonth, history] = await Promise.all([
    listAccounts(userId),
    listGoals(userId),
    countTransactions(userId),
    listTransactions(userId, { limit: 100 }),
    listTransactions(userId, { since: monthStart, limit: 500 }),
    listTransactions(userId, { limit: 500 }),
  ]);

  const snapshot = summarizeBalances(accounts);
  const goalSnapshot = summarizeGoals(goals);
  const thisMonthSummary = summarizeCashflow(thisMonth);
  const spendProjection = calculateSpendProjection(thisMonth);
  const topMerchants = topMerchantsBySpend(thisMonth, { limit: 5 });
  const topCategories = topCategoriesBySpend(thisMonth, { limit: 5 });
  const categoryProjections = projectCategories(thisMonth, { limit: 3 });
  const typeSummary = summarizeTransactionTypes(thisMonth);
  const recurringCandidates = findRecurringCandidates(history, { limit: 5 });

  const cashAccounts = accounts.filter((account) => !["credit_card", "loan"].includes(account.kind));
  const cardAccounts = accounts.filter((account) => account.kind === "credit_card");
  const loanAccounts = accounts.filter((account) => account.kind === "loan");
  const activeGoals = goals.filter((goal) => goal.status !== "done");
  const nextDueAccounts = [...cardAccounts]
    .filter((account) => account.dueDate)
    .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0))
    .slice(0, 3);
  const topGoal = [...activeGoals]
    .sort((a, b) => {
      const aDate = a.targetDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bDate = b.targetDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (aDate !== bDate) return aDate - bDate;
      return b.targetAmountCents - a.targetAmountCents;
    })[0] ?? null;
  const topGoalSummary = topGoal ? summarizeGoal(topGoal) : null;
  const topProjectedCategory = categoryProjections[0] ?? null;

  return (
    <div className="space-y-6 pb-6 lg:space-y-8">
      <section id="overview" className="space-y-4">
        <div className="rounded-[28px] border border-zinc-200 bg-gradient-to-br from-white via-zinc-50 to-emerald-50/70 p-5 shadow-sm shadow-zinc-950/5 dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-950 dark:to-emerald-950/20 dark:shadow-none lg:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-zinc-500">Finance</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-4xl">A faster read on cash, spending, and what needs attention.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300 sm:text-base">
                Mobile-first by default: the important numbers stay close, actions stay thumb-friendly, and deeper management stays tucked away until you need it.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:min-w-[320px] sm:grid-cols-2">
              {quickStat({ label: "Net worth", value: formatUSDFromCents(snapshot.netWorthCents), tone: snapshot.netWorthCents >= 0 ? "positive" : "default" })}
              {quickStat({ label: "This month", value: formatUSDFromCents(thisMonthSummary.netCents), tone: thisMonthSummary.netCents >= 0 ? "positive" : "default" })}
              {quickStat({ label: "Tracked accounts", value: String(accounts.length) })}
              {quickStat({ label: "Transactions", value: String(count) })}
            </div>
          </div>
        </div>

        <div className="sticky top-0 z-10 -mx-4 border-y border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-zinc-800 dark:bg-zinc-950/90 dark:supports-[backdrop-filter]:bg-zinc-950/80 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-0">
          <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:pb-0">
            {actionPill({ href: "#overview", label: "Overview" })}
            {actionPill({ href: "#planning", label: "Planning" })}
            {actionPill({ href: "#activity", label: "Activity" })}
            {actionPill({ href: "#transactions", label: "Transactions" })}
            {actionPill({ href: "#manage", label: "Manage" })}
            {count > 0 && <ClearButton />}
          </div>
        </div>

        <UploadForm />
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        {sectionCard({
          title: "At a glance",
          subtitle: "Lead with balances first, then let details follow.",
          children: (
            <div className="mt-5 -mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 xl:grid-cols-4">
              {summaryCard({
                label: "Cash",
                value: formatUSDFromCents(snapshot.cashCents),
                hint: `${cashAccounts.length} liquid account${cashAccounts.length === 1 ? "" : "s"}`,
                className: "min-w-[240px] snap-start sm:min-w-0",
              })}
              {summaryCard({
                label: "Long-term",
                value: formatUSDFromCents(snapshot.investmentCents + snapshot.retirementCents),
                hint: "investments + retirement",
                className: "min-w-[240px] snap-start sm:min-w-0",
              })}
              {summaryCard({
                label: "Debt",
                value: formatUSDFromCents(snapshot.cardsOwedCents + snapshot.loansOwedCents),
                hint: loanAccounts.length > 0 ? `${cardAccounts.length} cards · ${loanAccounts.length} loans` : `${cardAccounts.length} tracked card${cardAccounts.length === 1 ? "" : "s"}`,
                className: "min-w-[240px] snap-start sm:min-w-0",
              })}
              {summaryCard({
                label: "Net worth",
                value: formatUSDFromCents(snapshot.netWorthCents),
                hint: "assets minus debts",
                valueClassName: snapshot.netWorthCents >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-950 dark:text-zinc-50",
                className: "min-w-[240px] snap-start sm:min-w-0",
              })}
            </div>
          ),
        })}

        {sectionCard({
          title: "Right now",
          subtitle: "Keep the next useful nudge visible.",
          children: (
            <div className="mt-5 space-y-3">
              <div className="rounded-xl border border-zinc-200 px-4 py-4 dark:border-zinc-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">This month</p>
                    <p className="mt-2 text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{formatUSDFromCents(thisMonthSummary.netCents)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${thisMonthSummary.netCents >= 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"}`}>
                    {thisMonthSummary.netCents >= 0 ? "positive flow" : "watch spend"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-500">net flow after true spending</p>
              </div>
              <div className="rounded-xl border border-zinc-200 px-4 py-4 dark:border-zinc-800">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Next due</p>
                {nextDueAccounts.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {nextDueAccounts.map((account) => (
                      <div key={account.id} className="flex items-center justify-between gap-3 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60">
                        <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{account.name}</span>
                        <span className="font-mono text-xs tabular-nums text-zinc-500">{account.dueDate?.toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-zinc-500">No card due dates tracked yet.</p>
                )}
              </div>
              <div className="rounded-xl border border-zinc-200 px-4 py-4 dark:border-zinc-800">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Top pressure</p>
                {topGoal && topGoalSummary ? (
                  <>
                    <p className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">{topGoal.name}</p>
                    <p className="mt-1 text-sm text-zinc-500">{formatUSDFromCents(topGoalSummary.monthlyNeededCents)} / month needed</p>
                  </>
                ) : topProjectedCategory ? (
                  <>
                    <p className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">{topProjectedCategory.category}</p>
                    <p className="mt-1 text-sm text-zinc-500">{formatUSDFromCents(topProjectedCategory.projectedCents)} projected this month</p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-zinc-500">Add goals or import more activity to surface pressure points.</p>
                )}
              </div>
            </div>
          ),
        })}
      </div>

      {(goals.length > 0 || count > 0) && (
        <section id="planning" className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
          {sectionCard({
            title: "Goals snapshot",
            subtitle: goals.length > 0 ? "Buckets stay visible, but not noisy." : "Add buckets for wedding, emergency fund, vacation, or projects.",
            children: goals.length > 0 ? (
              <>
                <div className="mt-5 -mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 xl:grid-cols-4">
                  {summaryCard({ label: "Funded", value: formatUSDFromCents(goalSnapshot.fundedCents), hint: `${goalSnapshot.activeCount} active bucket${goalSnapshot.activeCount === 1 ? "" : "s"}`, className: "min-w-[220px] snap-start sm:min-w-0" })}
                  {summaryCard({ label: "Target", value: formatUSDFromCents(goalSnapshot.targetCents), hint: `${goalSnapshot.fundedPercent}% funded overall`, className: "min-w-[220px] snap-start sm:min-w-0" })}
                  {summaryCard({ label: "Remaining", value: formatUSDFromCents(goalSnapshot.remainingCents), hint: "left across active goals", className: "min-w-[220px] snap-start sm:min-w-0" })}
                  {summaryCard({ label: "Monthly pace", value: formatUSDFromCents(goalSnapshot.monthlyNeededCents), hint: "needed to stay on track", className: "min-w-[220px] snap-start sm:min-w-0" })}
                </div>
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {activeGoals.slice(0, 4).map((goal) => {
                    const summary = summarizeGoal(goal);
                    return (
                      <div key={goal.id} className="rounded-xl border border-zinc-200 px-4 py-4 dark:border-zinc-800">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">{goal.name}</p>
                          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{formatGoalCategory(goal.category)}</span>
                        </div>
                        <p className="mt-2 text-sm text-zinc-500">{formatUSDFromCents(goal.currentAmountCents)} of {formatUSDFromCents(goal.targetAmountCents)}</p>
                        {progressBar(summary.fundedPercent, summary.fundedPercent >= 60 ? "emerald" : summary.fundedPercent >= 30 ? "sky" : "amber")}
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
              <div className="mt-5 rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-sm text-zinc-500 dark:border-zinc-700">
                Add your first bucket to start tracking wedding, trips, emergency fund, or project savings.
              </div>
            ),
          })}

          {sectionCard({
            title: "Monthly planning",
            subtitle: count > 0 ? "Projection first, category detail second." : "This gets smarter once transactions are imported.",
            children: count > 0 ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-xl bg-zinc-50 px-4 py-4 dark:bg-zinc-800/70">
                  <p className="text-sm text-zinc-500">Projected true spend</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{formatUSDFromCents(spendProjection.projectedCents)}</p>
                  <p className="mt-1 text-sm text-zinc-500">{formatUSDFromCents(Math.round(spendProjection.burnRateCentsPerDay))} / day at the current pace</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {summaryCard({ label: "Spent", value: formatUSDFromCents(thisMonthSummary.spentCents), hint: "true spend so far" })}
                  {summaryCard({ label: "Income", value: formatUSDFromCents(thisMonthSummary.incomeCents), hint: "income + reimbursements", valueClassName: "text-emerald-600 dark:text-emerald-400" })}
                  {summaryCard({ label: "Net flow", value: formatUSDFromCents(thisMonthSummary.netCents), hint: "income minus true spend", valueClassName: thisMonthSummary.netCents >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-950 dark:text-zinc-50" })}
                </div>
                {categoryProjections.length > 0 && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {categoryProjections.map((item) => (
                      <div key={item.category} className="rounded-xl border border-zinc-200 px-4 py-4 dark:border-zinc-800">
                        <p className="truncate text-sm font-medium text-zinc-700 dark:text-zinc-300">{item.category}</p>
                        <p className="mt-1 font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">{formatUSDFromCents(item.projectedCents)}</p>
                        <p className="text-xs text-zinc-500">projected this month</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-sm text-zinc-500 dark:border-zinc-700">
                Import transactions to see monthly pace, projected spend, and category drift.
              </div>
            ),
          })}
        </section>
      )}

      <section id="activity" className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        {count > 0 &&
          sectionCard({
            title: "Money movement mix",
            subtitle: "Separate true spend from transfers, payoffs, and inflows.",
            children: typeSummary.length > 0 ? (
              <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {typeSummary.map((item) => (
                  <li key={item.type} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 px-4 py-4 dark:border-zinc-800">
                    <div className="min-w-0 flex-1">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${typeTone(item.type)}`}>
                        {formatTransactionType(item.type)}
                      </span>
                      <p className="mt-2 text-xs text-zinc-500">{item.count} transaction{item.count === 1 ? "" : "s"}</p>
                    </div>
                    <p className="font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">{formatUSDFromCents(item.amountCents)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-5 text-sm text-zinc-500">Import transactions to see your money movement split.</p>
            ),
          })}

        {sectionCard({
          title: "Watchlist",
          subtitle: "A compact scan for category, merchant, and recurring pressure.",
          children: count > 0 ? (
            <div className="mt-5 space-y-3">
              <div className="rounded-xl border border-zinc-200 px-4 py-4 dark:border-zinc-800">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Top category</p>
                {topCategories[0] ? (
                  <>
                    <p className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">{topCategories[0].category}</p>
                    <p className="mt-1 text-sm text-zinc-500">{formatUSDFromCents(topCategories[0].spendCents)} across {topCategories[0].count} transaction{topCategories[0].count === 1 ? "" : "s"}</p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-zinc-500">No spend yet this month.</p>
                )}
              </div>
              <div className="rounded-xl border border-zinc-200 px-4 py-4 dark:border-zinc-800">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Top merchant</p>
                {topMerchants[0] ? (
                  <>
                    <p className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">{topMerchants[0].merchant}</p>
                    <p className="mt-1 text-sm text-zinc-500">{formatUSDFromCents(topMerchants[0].spendCents)} across {topMerchants[0].count} charge{topMerchants[0].count === 1 ? "" : "s"}</p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-zinc-500">No merchant signal yet.</p>
                )}
              </div>
              <div className="rounded-xl border border-zinc-200 px-4 py-4 dark:border-zinc-800">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Recurring</p>
                {recurringCandidates[0] ? (
                  <>
                    <p className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">{recurringCandidates[0].merchant}</p>
                    <p className="mt-1 text-sm text-zinc-500">{formatUSDFromCents(recurringCandidates[0].amountCents)} · last {recurringCandidates[0].lastDate.toLocaleDateString([], { month: "short", day: "numeric" })}</p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-zinc-500">No strong recurring patterns yet.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-sm text-zinc-500 dark:border-zinc-700">
              Import transactions to populate this watchlist.
            </div>
          ),
        })}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {sectionCard({
          title: "Top categories",
          subtitle: "Where true spend is concentrating this month.",
          children:
            topCategories.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">No spending yet this month.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {topCategories.map((category) => (
                  <li key={category.category} className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 px-3 py-3 text-sm dark:bg-zinc-800/60">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">{category.category}</p>
                      <p className="text-xs text-zinc-500">{category.count} transaction{category.count === 1 ? "" : "s"}</p>
                    </div>
                    <span className="font-mono tabular-nums text-zinc-700 dark:text-zinc-300">{formatUSDFromCents(category.spendCents)}</span>
                  </li>
                ))}
              </ul>
            ),
        })}

        {sectionCard({
          title: "Top merchants",
          subtitle: "The biggest names in this month’s true spend.",
          children:
            topMerchants.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">No spending yet this month.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {topMerchants.map((merchant) => (
                  <li key={merchant.merchant} className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 px-3 py-3 text-sm dark:bg-zinc-800/60">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">{merchant.merchant}</p>
                      <p className="text-xs text-zinc-500">{merchant.count} transaction{merchant.count === 1 ? "" : "s"}</p>
                    </div>
                    <span className="font-mono tabular-nums text-zinc-700 dark:text-zinc-300">{formatUSDFromCents(merchant.spendCents)}</span>
                  </li>
                ))}
              </ul>
            ),
        })}

        {sectionCard({
          title: "Recurring",
          subtitle: "Charges that look like they may repeat automatically.",
          children:
            recurringCandidates.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">No strong recurring patterns yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {recurringCandidates.map((item) => (
                  <li key={`${item.merchant}-${item.amountCents}-${item.account ?? ""}`} className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 px-3 py-3 text-sm dark:bg-zinc-800/60">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">{item.merchant}</p>
                      <p className="text-xs text-zinc-500">
                        {item.count} charges{item.account ? ` · ${item.account}` : ""} · last {item.lastDate.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <span className="font-mono tabular-nums text-zinc-700 dark:text-zinc-300">{formatUSDFromCents(item.amountCents)}</span>
                  </li>
                ))}
              </ul>
            ),
        })}
      </section>

      <section id="manage" className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
        {sectionCard({
          title: "Manage accounts",
          subtitle: "Keep editing available, but secondary to day-to-day review.",
          children: (
            <details className="mt-5 rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <summary className="cursor-pointer list-none text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {accounts.length > 0 ? `Edit ${accounts.length} account${accounts.length === 1 ? "" : "s"} or add another` : "Add your first account"}
              </summary>
              <div className="mt-4">
                <AccountsPanel
                  accounts={accounts.map((account) => ({
                    id: account.id,
                    name: account.name,
                    kind: account.kind,
                    currentBalanceCents: account.currentBalanceCents,
                    statementBalanceCents: account.statementBalanceCents,
                    balanceUpdatedAt: account.balanceUpdatedAt.toISOString(),
                    dueDate: account.dueDate?.toISOString() ?? null,
                    creditLimitCents: account.creditLimitCents,
                  }))}
                />
              </div>
            </details>
          ),
        })}

        {sectionCard({
          title: "Manage goals",
          subtitle: "Keep wedding, vacations, and projects out of your head and in a bucket.",
          children: (
            <details className="mt-5 rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <summary className="cursor-pointer list-none text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {goals.length > 0 ? `Edit ${goals.length} goal bucket${goals.length === 1 ? "" : "s"} or add another` : "Add your first goal bucket"}
              </summary>
              <div className="mt-4">
                <GoalsPanel
                  goals={goals.map((goal) => ({
                    id: goal.id,
                    name: goal.name,
                    owner: goal.owner,
                    category: goal.category,
                    targetAmountCents: goal.targetAmountCents,
                    currentAmountCents: goal.currentAmountCents,
                    targetDate: goal.targetDate?.toISOString() ?? null,
                    monthlyContributionCents: goal.monthlyContributionCents,
                    status: goal.status,
                    notes: goal.notes,
                  }))}
                />
              </div>
            </details>
          ),
        })}
      </section>

      <section id="transactions">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            {count > 0 ? `Recent ${recent.length} of ${count}` : "Transactions"}
          </h2>
          {count > 0 ? <a href="#manage" className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100">Need to edit accounts or goals?</a> : null}
        </div>
        {recent.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 px-5 py-8 text-sm text-zinc-500 dark:border-zinc-700">
            No transactions yet. Import a CSV or statement PDF above.
          </div>
        ) : (
          <ul className="space-y-3">
            {recent.map((t) => {
              const transactionType = classifyTransaction(t);
              return (
                <li key={t.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3 sm:block">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="max-w-full truncate text-sm font-medium text-zinc-900 dark:text-zinc-100 sm:text-base">{t.description}</p>
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${typeTone(transactionType)}`}>
                              {formatTransactionType(transactionType)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-zinc-500">
                            {t.date.toLocaleDateString([], {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                            {t.account ? ` · ${t.account}` : ""}
                          </p>
                        </div>
                        <span className={`font-mono text-base tabular-nums sm:hidden ${t.amount < 0 ? "text-zinc-900 dark:text-zinc-100" : "text-emerald-600 dark:text-emerald-400"}`}>
                          {formatUSDFromCents(t.amount)}
                        </span>
                      </div>
                      <div className="mt-3 max-w-full sm:max-w-[240px]">
                        <CategorySelect id={t.id} value={resolveCategory(t.category, t.description, t.amount)} />
                      </div>
                    </div>
                    <span className={`hidden font-mono text-sm tabular-nums sm:block ${t.amount < 0 ? "text-zinc-900 dark:text-zinc-100" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {formatUSDFromCents(t.amount)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
