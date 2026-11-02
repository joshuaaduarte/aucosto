import { redirect } from "next/navigation";
import { getTellerConnectConfig } from "@/lib/teller";
import {
  countTransactions,
  getMoneyDateDone,
  listAccounts,
  listBills,
  listBudgets,
  listGoals,
  listLinkedConnections,
  listTransactions,
} from "@/lib/services/finance";
import { householdMemberNames } from "@/lib/household";
import { findRecurringCandidates } from "@/lib/finance-summary";
import {
  billsDueWithin,
  budgetProgress,
  buildMoneyDateSummary,
  moneyDateWeekKey,
  suggestBillsFromRecurring,
} from "@/lib/finance-planning";
import {
  HouseholdPlanningSection,
  type HouseholdPlanningData,
} from "./_components/household-planning-section";
import { FinanceScopeSwitcher } from "./_components/scope-switcher";
import { requireViewerContext } from "@/lib/viewer-context";
import { InsightsSection } from "./_components/insights-section";
import { ManageSection } from "./_components/manage-section";
import { OverviewSection } from "./_components/overview-section";
import { PlanningSection } from "./_components/planning-section";
import { TransactionsSection } from "./_components/transactions-section";
import { deriveFinanceDashboard } from "./_lib/derive";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const context = await requireViewerContext();
  if (!context.financeVisible) {
    redirect("/app");
  }
  const userId = context.financeUserId;

  const now = new Date();
  const weekKey = moneyDateWeekKey(now);
  const [accounts, goals, linkedConnections, count, history, budgets, bills, moneyDateDone, names] =
    await Promise.all([
      listAccounts(userId),
      listGoals(userId),
      listLinkedConnections(userId),
      countTransactions(userId),
      listTransactions(userId, { limit: 1000 }),
      listBudgets(userId),
      listBills(userId),
      getMoneyDateDone(userId, weekKey).catch(() => null),
      context.householdId ? householdMemberNames(context.householdId) : Promise.resolve({}),
    ]);

  const tellerConfig = getTellerConnectConfig();
  const data = deriveFinanceDashboard({ accounts, goals, history, count });
  const planning = derivePlanning({ budgets, bills, history, now, weekKey, moneyDateDone, names });
  planning.sharedWith = context.financeScope === "household" ? context.householdName : null;

  return (
    <div className="space-y-12 pb-6">
      {context.householdUserId && !context.isDemoMode ? (
        <FinanceScopeSwitcher
          scope={context.financeScope}
          householdName={context.householdName ?? "Household"}
        />
      ) : null}
      <OverviewSection data={data} />
      <Divider />
      <HouseholdPlanningSection data={planning} />
      <Divider />
      <TransactionsSection data={data} />
      <Divider />
      <PlanningSection data={data} />
      <Divider />
      <InsightsSection data={data} />
      <Divider />
      <ManageSection
        data={data}
        tellerConfig={tellerConfig}
        linkedConnections={linkedConnections}
      />
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{ height: 1, background: "var(--border-faint)" }}
      aria-hidden
    />
  );
}

function derivePlanning(input: {
  budgets: Awaited<ReturnType<typeof listBudgets>>;
  bills: Awaited<ReturnType<typeof listBills>>;
  history: Awaited<ReturnType<typeof listTransactions>>;
  now: Date;
  weekKey: string;
  moneyDateDone: { at: Date; actorUserId: string | null } | null;
  names: Record<string, string>;
}): HouseholdPlanningData {
  const progress = budgetProgress(input.budgets, input.history, input.now);
  const idByCategory = new Map(input.budgets.map((b) => [b.category, b.id]));
  const dueSoon = billsDueWithin(input.bills, input.now, 7);
  const recurring = findRecurringCandidates(input.history, { limit: 8 });
  const suggestions = suggestBillsFromRecurring(
    recurring,
    input.bills.map((b) => b.name),
  ).slice(0, 4);
  const toDateInput = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return {
    budgets: progress.map((p) => ({ ...p, id: idByCategory.get(p.category)! })),
    bills: billsDueWithin(input.bills, input.now, 3660),
    billSuggestions: suggestions.map((s) => ({
      name: s.name,
      amount: (s.amountCents / 100).toFixed(2),
      nextDueAt: toDateInput(s.nextDueAt),
    })),
    moneyDate: buildMoneyDateSummary({
      transactions: input.history,
      budgets: progress,
      billsDueSoon: dueSoon.length,
      now: input.now,
    }),
    moneyDateDone: input.moneyDateDone
      ? {
          at: input.moneyDateDone.at,
          by: input.moneyDateDone.actorUserId
            ? (input.names[input.moneyDateDone.actorUserId] ?? null)
            : null,
        }
      : null,
    sharedWith: null,
  };
}
