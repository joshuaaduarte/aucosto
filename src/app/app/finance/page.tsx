import type { ReactNode } from "react";
import { auth } from "@/auth";
import { formatAccountKind, summarizeBalances } from "@/lib/finance-accounts";
import { resolveCategory } from "@/lib/finance-categories";
import { formatGoalCategory, formatGoalOwner, summarizeGoal, summarizeGoals } from "@/lib/finance-goals";
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
import { GoalsPanel } from "./goals-panel";
import { CategorySelect } from "./category-select";
import { ClearButton } from "./clear-button";
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
}: {
  label: string;
  value: string;
  hint: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
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
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
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
  const cashAccounts = accounts.filter((account) => account.kind !== "credit_card");
  const cardAccounts = accounts.filter((account) => account.kind === "credit_card");

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight">Finance</h1>
          <p className="mt-2 text-zinc-500">
            Import your account activity, track where your balances actually stand,
            and keep an eye on how the month is moving.
          </p>
        </div>
        {count > 0 && <ClearButton />}
      </div>

      <UploadForm />

      {accounts.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCard({
            label: "Cash",
            value: formatUSDFromCents(snapshot.cashCents),
            hint: `${cashAccounts.length} tracked cash account${cashAccounts.length === 1 ? "" : "s"}`,
          })}
          {summaryCard({
            label: "Long-term",
            value: formatUSDFromCents(snapshot.investmentCents + snapshot.retirementCents),
            hint: "investments + retirement",
          })}
          {summaryCard({
            label: "Cards owed",
            value: formatUSDFromCents(snapshot.cardsOwedCents),
            hint: `${cardAccounts.length} tracked card${cardAccounts.length === 1 ? "" : "s"}`,
          })}
          {summaryCard({
            label: "Net worth",
            value: formatUSDFromCents(snapshot.netWorthCents),
            hint: "cash + long-term minus debts",
            valueClassName:
              snapshot.netWorthCents >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-zinc-950 dark:text-zinc-50",
          })}
        </div>
      )}

      {goals.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCard({
            label: "Goals funded",
            value: formatUSDFromCents(goalSnapshot.fundedCents),
            hint: `${goalSnapshot.activeCount} active bucket${goalSnapshot.activeCount === 1 ? "" : "s"}`,
          })}
          {summaryCard({
            label: "Goals target",
            value: formatUSDFromCents(goalSnapshot.targetCents),
            hint: `${goalSnapshot.fundedPercent}% funded overall`,
          })}
          {summaryCard({
            label: "Still needed",
            value: formatUSDFromCents(goalSnapshot.remainingCents),
            hint: "remaining across active goals",
          })}
          {summaryCard({
            label: "Goal pace",
            value: formatUSDFromCents(goalSnapshot.monthlyNeededCents),
            hint: "monthly contribution needed",
          })}
        </div>
      )}

      {count > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCard({
            label: "Spent",
            value: formatUSDFromCents(thisMonthSummary.spentCents),
            hint: "true spend this month",
          })}
          {summaryCard({
            label: "Income",
            value: formatUSDFromCents(thisMonthSummary.incomeCents),
            hint: "income + reimbursements",
            valueClassName: "text-emerald-600 dark:text-emerald-400",
          })}
          {summaryCard({
            label: "Net flow",
            value: formatUSDFromCents(thisMonthSummary.netCents),
            hint: "income minus true spend",
            valueClassName:
              thisMonthSummary.netCents >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-zinc-950 dark:text-zinc-50",
          })}
          {summaryCard({
            label: "Projected spend",
            value: formatUSDFromCents(spendProjection.projectedCents),
            hint: "month-end at current pace",
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        {sectionCard({
          title: "Accounts",
          subtitle:
            accounts.length > 0
              ? "Manual balances for now. Keep these fresh and the snapshot stays honest."
              : "Add the balances you care about so finance can show where you actually stand.",
          children: (
            <div className="mt-5 space-y-4">
              {accounts.length > 0 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {accounts.map((account) => (
                    <div key={account.id} className="rounded-lg border border-zinc-200 px-3 py-3 dark:border-zinc-800">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">{account.name}</p>
                          <p className="text-xs text-zinc-500">
                            {formatAccountKind(account.kind)} · updated {account.balanceUpdatedAt.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                        <p className="font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
                          {formatUSDFromCents(account.currentBalanceCents)}
                        </p>
                      </div>
                      {(account.dueDate || account.creditLimitCents != null) && (
                        <div className="mt-2 text-xs text-zinc-500">
                          {account.dueDate ? `due ${account.dueDate.toLocaleDateString([], { month: "short", day: "numeric" })}` : null}
                          {account.dueDate && account.creditLimitCents != null ? " · " : null}
                          {account.creditLimitCents != null ? `${formatUSDFromCents(account.creditLimitCents)} limit` : null}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
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
          ),
        })}

        {sectionCard({
          title: "Position + pace",
          subtitle: "Where you stand now, plus where this month is trending.",
          children: count > 0 ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-lg bg-zinc-50 px-4 py-4 dark:bg-zinc-800/70">
                <p className="text-sm text-zinc-500">Projected true spend</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                  {formatUSDFromCents(spendProjection.projectedCents)}
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  {formatUSDFromCents(Math.round(spendProjection.burnRateCentsPerDay))} / day at the current pace
                </p>
              </div>
              {categoryProjections.length > 0 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                  {categoryProjections.map((item) => (
                    <div key={item.category} className="rounded-lg border border-zinc-200 px-3 py-3 dark:border-zinc-800">
                      <p className="truncate text-sm font-medium text-zinc-700 dark:text-zinc-300">{item.category}</p>
                      <p className="mt-1 font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
                        {formatUSDFromCents(item.projectedCents)}
                      </p>
                      <p className="text-xs text-zinc-500">projected</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-zinc-300 px-4 py-8 text-sm text-zinc-500 dark:border-zinc-700">
              Once you import transactions, this panel will show spend pacing and projections.
            </div>
          ),
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        {sectionCard({
          title: "Goal buckets",
          subtitle:
            goals.length > 0
              ? "Forward-looking buckets for wedding, emergency fund, trips, and projects."
              : "Add buckets so finance can start planning ahead instead of only reporting history.",
          children: (
            <div className="mt-5 space-y-4">
              {goals.length > 0 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {goals.map((goal) => {
                    const summary = summarizeGoal(goal);
                    return (
                      <div key={goal.id} className="rounded-lg border border-zinc-200 px-3 py-3 dark:border-zinc-800">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">{goal.name}</p>
                          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{formatGoalCategory(goal.category)}</span>
                          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{formatGoalOwner(goal.owner)}</span>
                        </div>
                        <p className="mt-2 font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
                          {formatUSDFromCents(goal.currentAmountCents)} / {formatUSDFromCents(goal.targetAmountCents)}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {summary.fundedPercent}% funded · {formatUSDFromCents(summary.remainingCents)} left{summary.targetDateLabel ? ` · ${summary.targetDateLabel}` : ""}
                        </p>
                        {summary.monthlyNeededCents > 0 && (
                          <p className="mt-1 text-xs text-zinc-500">{formatUSDFromCents(summary.monthlyNeededCents)} / month needed</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
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
          ),
        })}

        {sectionCard({
          title: "Forward planning",
          subtitle: "The part that will eventually feed groceries, trips, and project decisions.",
          children: (
            <div className="mt-5 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
              <div className="rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">1. Capture where money lives</p>
                <p className="mt-1 text-zinc-500">Checking, savings, investments, retirement, and debt all belong here now.</p>
              </div>
              <div className="rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">2. Fund buckets intentionally</p>
                <p className="mt-1 text-zinc-500">Wedding, emergency fund, vacation, and project buckets can now track targets and monthly pace.</p>
              </div>
              <div className="rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">3. Unlock safe-to-spend later</p>
                <p className="mt-1 text-zinc-500">Once balances, goals, and recurring obligations are stable, aucosto can estimate what is safe to spend without hurting long-term plans.</p>
              </div>
            </div>
          ),
        })}
      </div>

      {count > 0 && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          {sectionCard({
            title: "Spending pace",
            subtitle: `${spendProjection.daysElapsed} of ${spendProjection.daysInMonth} days elapsed this month`,
            children: (
              <>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <p className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                    {formatUSDFromCents(Math.round(spendProjection.burnRateCentsPerDay))}
                    <span className="ml-2 text-sm font-normal text-zinc-500">/ day</span>
                  </p>
                  <div className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:bg-zinc-800/70 dark:text-zinc-300">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">Projected month-end:</span>{" "}
                    {formatUSDFromCents(spendProjection.projectedCents)}
                  </div>
                </div>
                {categoryProjections.length > 0 && (
                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {categoryProjections.map((item) => (
                      <div key={item.category} className="rounded-lg border border-zinc-200 px-3 py-3 dark:border-zinc-800">
                        <p className="truncate text-sm font-medium text-zinc-700 dark:text-zinc-300">{item.category}</p>
                        <p className="mt-1 font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
                          {formatUSDFromCents(item.projectedCents)}
                        </p>
                        <p className="text-xs text-zinc-500">projected</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ),
          })}

          {typeSummary.length > 0 &&
            sectionCard({
              title: "Money movement mix",
              subtitle: "A cleaner split between real spend, payoffs, transfers, and inflows.",
              children: (
                <ul className="mt-5 space-y-3">
                  {typeSummary.map((item) => (
                    <li key={item.type} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-3 dark:border-zinc-800">
                      <div className="min-w-0 flex-1">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${typeTone(item.type)}`}>
                          {formatTransactionType(item.type)}
                        </span>
                        <p className="mt-2 text-xs text-zinc-500">{item.count} transaction{item.count === 1 ? "" : "s"}</p>
                      </div>
                      <p className="font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
                        {formatUSDFromCents(item.amountCents)}
                      </p>
                    </li>
                  ))}
                </ul>
              ),
            })}
        </div>
      )}

      {count > 0 && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {sectionCard({
            title: "Top categories",
            subtitle: "Where true spend is concentrating this month.",
            children:
              topCategories.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-500">No spending yet this month.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {topCategories.map((category) => (
                    <li key={category.category} className="flex items-center justify-between gap-3 text-sm">
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
                    <li key={merchant.merchant} className="flex items-center justify-between gap-3 text-sm">
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
                    <li key={`${item.merchant}-${item.amountCents}-${item.account ?? ""}`} className="flex items-center justify-between gap-3 text-sm">
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
        </div>
      )}

      <div>
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
          {count > 0 ? `Recent ${recent.length} of ${count}` : "Transactions"}
        </h2>
        {recent.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 px-5 py-8 text-sm text-zinc-500 dark:border-zinc-700">
            No transactions yet. Import a CSV above.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white shadow-sm shadow-zinc-950/5 dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
            {recent.map((t) => {
              const transactionType = classifyTransaction(t);
              return (
                <li
                  key={t.id}
                  className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {t.description}
                      </p>
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
                    <div className="mt-3 max-w-[220px]">
                      <CategorySelect
                        id={t.id}
                        value={resolveCategory(t.category, t.description, t.amount)}
                      />
                    </div>
                  </div>
                  <span
                    className={`font-mono text-sm tabular-nums ${
                      t.amount < 0
                        ? "text-zinc-900 dark:text-zinc-100"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {formatUSDFromCents(t.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
