import { redirect } from "next/navigation";
import { getTellerConnectConfig } from "@/lib/teller";
import {
  countTransactions,
  listAccounts,
  listGoals,
  listLinkedConnections,
  listTransactions,
} from "@/lib/services/finance";
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
  const userId = context.effectiveUserId;

  const [accounts, goals, linkedConnections, count, history] = await Promise.all([
    listAccounts(userId),
    listGoals(userId),
    listLinkedConnections(userId),
    countTransactions(userId),
    listTransactions(userId, { limit: 1000 }),
  ]);

  const tellerConfig = getTellerConnectConfig();
  const data = deriveFinanceDashboard({ accounts, goals, history, count });

  return (
    <div className="space-y-14 pb-6 lg:space-y-20">
      <OverviewSection data={data} />

      <div className="fleuron text-ink-fade">
        <span aria-hidden>❦ The Daily Accounts ❦</span>
      </div>

      <TransactionsSection data={data} />

      <div className="fleuron text-ink-fade">
        <span aria-hidden>❧</span>
      </div>

      <PlanningSection data={data} />

      <div className="fleuron text-ink-fade">
        <span aria-hidden>✣</span>
      </div>

      <InsightsSection data={data} />

      <div className="fleuron text-ink-fade">
        <span aria-hidden>❧</span>
      </div>

      <ManageSection
        data={data}
        tellerConfig={tellerConfig}
        linkedConnections={linkedConnections}
      />
    </div>
  );
}
