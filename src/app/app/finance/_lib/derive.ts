// Pure derivation for the finance dashboard. All inputs are already-fetched
// service-layer rows; output is a tidy view-model the page hands to its
// section components. Kept free of React so it can be unit-tested without a
// renderer.

import {
  findLikelyDuplicateManualAccountIds,
  summarizeBalances,
} from "@/lib/finance-accounts";
import {
  summarizeGoal,
  summarizeGoals,
  type GoalProgress,
} from "@/lib/finance-goals";
import {
  calculateSpendProjection,
  projectCategories,
} from "@/lib/finance-pace";
import {
  findRecurringCandidates,
  summarizeCashflow,
  summarizeTransactionTypes,
  topCategoriesBySpend,
  topMerchantsBySpend,
} from "@/lib/finance-summary";
import {
  daysUntil,
  formatPercentDelta,
  formatSignedUSDFromCents,
  formatUSDFromCents,
  startOfMonth,
  startOfPreviousMonth,
} from "@/lib/money";
import type {
  FinanceAccount,
  FinanceGoal,
  FinanceTransaction,
} from "@/generated/prisma/client";

export type FinanceAlert = {
  title: string;
  body: string;
  tone: "emerald" | "amber" | "sky" | "zinc";
};

export type FinanceDashboard = ReturnType<typeof deriveFinanceDashboard>;

export function deriveFinanceDashboard(input: {
  accounts: FinanceAccount[];
  goals: FinanceGoal[];
  history: FinanceTransaction[];
  count: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const monthStart = startOfMonth(now);
  const previousMonthStart = startOfPreviousMonth(now);

  const duplicateManualAccountIds = findLikelyDuplicateManualAccountIds(input.accounts);
  const duplicateManualAccounts = input.accounts.filter((a) =>
    duplicateManualAccountIds.has(a.id),
  );
  const effectiveAccounts = input.accounts.filter(
    (a) => !duplicateManualAccountIds.has(a.id),
  );

  const thisMonth = input.history.filter((t) => t.date >= monthStart);
  const lastMonth = input.history.filter(
    (t) => t.date >= previousMonthStart && t.date < monthStart,
  );

  const snapshot = summarizeBalances(effectiveAccounts);
  const goalSnapshot = summarizeGoals(input.goals);
  const thisMonthSummary = summarizeCashflow(thisMonth);
  const lastMonthSummary = summarizeCashflow(lastMonth);
  const spendProjection = calculateSpendProjection(thisMonth);
  const topMerchants = topMerchantsBySpend(thisMonth, { limit: 5 });
  const topCategories = topCategoriesBySpend(thisMonth, { limit: 5 });
  const lastMonthTopCategories = topCategoriesBySpend(lastMonth, { limit: 20 });
  const categoryProjections = projectCategories(thisMonth, { limit: 3 });
  const typeSummary = summarizeTransactionTypes(thisMonth);
  const recurringCandidates = findRecurringCandidates(input.history, { limit: 5 });

  const cardAccounts = effectiveAccounts.filter(
    (a) => a.kind === "credit_card" && a.includeInNetWorth,
  );
  const activeGoals = input.goals.filter((g) => g.status !== "done");
  const nextDueAccounts = [...cardAccounts]
    .filter((a) => a.dueDate)
    .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0))
    .slice(0, 3);
  const topGoal =
    [...activeGoals].sort((a, b) => {
      const aDate = a.targetDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bDate = b.targetDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (aDate !== bDate) return aDate - bDate;
      return b.targetAmountCents - a.targetAmountCents;
    })[0] ?? null;
  const topGoalProgress: GoalProgress | null = topGoal ? summarizeGoal(topGoal) : null;
  const topProjectedCategory = categoryProjections[0] ?? null;

  const spendDeltaCents = thisMonthSummary.spentCents - lastMonthSummary.spentCents;
  const netDeltaCents = thisMonthSummary.netCents - lastMonthSummary.netCents;
  const spendDeltaPercent = formatPercentDelta(
    thisMonthSummary.spentCents,
    lastMonthSummary.spentCents,
  );
  const netDeltaPercent = formatPercentDelta(
    thisMonthSummary.netCents,
    lastMonthSummary.netCents,
  );
  const topProjectedCategoryLastMonth = topProjectedCategory
    ? lastMonthTopCategories.find((c) => c.category === topProjectedCategory.category)
    : null;
  const topProjectedCategoryDelta =
    topProjectedCategory && topProjectedCategoryLastMonth
      ? topProjectedCategory.projectedCents - topProjectedCategoryLastMonth.spendCents
      : null;

  const alerts = buildActionableAlerts({
    nextDueAccount: nextDueAccounts[0] ?? null,
    spendDeltaCents,
    spendDeltaPercent,
    thisMonthSpentCents: thisMonthSummary.spentCents,
    topProjectedCategory,
    topProjectedCategoryDelta,
    recurringCandidate: recurringCandidates[0] ?? null,
    topGoal,
    topGoalProgress,
  });

  return {
    monthStart,
    previousMonthStart,
    accounts: input.accounts,
    effectiveAccounts,
    duplicateManualAccounts,
    goals: input.goals,
    activeGoals,
    history: input.history,
    thisMonth,
    lastMonth,
    snapshot,
    goalSnapshot,
    thisMonthSummary,
    lastMonthSummary,
    spendProjection,
    topMerchants,
    topCategories,
    categoryProjections,
    lastMonthTopCategories,
    typeSummary,
    recurringCandidates,
    cardAccounts,
    nextDueAccounts,
    topGoal,
    topGoalProgress,
    topProjectedCategory,
    spendDeltaCents,
    netDeltaCents,
    spendDeltaPercent,
    netDeltaPercent,
    alerts,
    count: input.count,
  };
}

function buildActionableAlerts(input: {
  nextDueAccount: FinanceAccount | null;
  spendDeltaCents: number;
  spendDeltaPercent: string | null;
  thisMonthSpentCents: number;
  topProjectedCategory: { category: string; projectedCents: number } | null;
  topProjectedCategoryDelta: number | null;
  recurringCandidate:
    | { merchant: string; amountCents: number; lastDate: Date }
    | null;
  topGoal: FinanceGoal | null;
  topGoalProgress: GoalProgress | null;
}): FinanceAlert[] {
  const alerts: (FinanceAlert | null)[] = [];

  if (input.nextDueAccount?.dueDate) {
    const due = input.nextDueAccount.dueDate;
    const days = daysUntil(due);
    alerts.push({
      title: `${input.nextDueAccount.name} due ${due.toLocaleDateString([], {
        month: "short",
        day: "numeric",
      })}`,
      body: `${days} day${days === 1 ? "" : "s"} left. Keep the payoff visible before it becomes a fire drill.`,
      tone: "amber",
    });
  }

  if (input.spendDeltaCents > 0) {
    alerts.push({
      title: `True spend is ${formatSignedUSDFromCents(input.spendDeltaCents)} vs last month`,
      body: input.spendDeltaPercent
        ? `${input.spendDeltaPercent} change month over month. Good moment to check where the drift is coming from.`
        : "Month-over-month comparison just started, but spending is already above the last full baseline.",
      tone: "amber",
    });
  } else if (input.thisMonthSpentCents > 0) {
    alerts.push({
      title: `True spend is ${formatSignedUSDFromCents(input.spendDeltaCents)} vs last month`,
      body: input.spendDeltaPercent
        ? `${input.spendDeltaPercent} change month over month. The current pace is calmer than last month.`
        : "Early signal only, but spending is trending lower than last month so far.",
      tone: "emerald",
    });
  }

  if (input.topProjectedCategory) {
    alerts.push({
      title: `${input.topProjectedCategory.category} is leading projected spend`,
      body:
        input.topProjectedCategoryDelta != null
          ? `${formatUSDFromCents(input.topProjectedCategory.projectedCents)} projected this month, ${formatSignedUSDFromCents(input.topProjectedCategoryDelta)} vs last month.`
          : `${formatUSDFromCents(input.topProjectedCategory.projectedCents)} projected this month.`,
      tone: "sky",
    });
  }

  if (input.recurringCandidate) {
    alerts.push({
      title: `${input.recurringCandidate.merchant} looks recurring`,
      body: `${formatUSDFromCents(input.recurringCandidate.amountCents)} with the last charge on ${input.recurringCandidate.lastDate.toLocaleDateString([], {
        month: "short",
        day: "numeric",
      })}. Worth deciding if it still earns its place.`,
      tone: "zinc",
    });
  }

  if (
    input.topGoal &&
    input.topGoalProgress &&
    input.topGoalProgress.monthlyNeededCents > 0
  ) {
    alerts.push({
      title: `${input.topGoal.name} needs ${formatUSDFromCents(input.topGoalProgress.monthlyNeededCents)} / month`,
      body: input.topGoalProgress.targetDateLabel
        ? `That pace is based on the ${input.topGoalProgress.targetDateLabel} target.`
        : "Add a target date if you want the pressure to be more precise.",
      tone: "zinc",
    });
  }

  return alerts.filter((a): a is FinanceAlert => a !== null);
}
