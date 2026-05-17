import type { LinkedFinanceConnectionSummary } from "@/lib/services/finance";
import type { FinanceDashboard } from "../_lib/derive";
import { AccountsPanel } from "../accounts-panel";
import { GoalsPanel } from "../goals-panel";
import { LinkedConnectionsPanel } from "../linked-connections-panel";
import { SectionCard } from "./ui";

type TellerConfig = {
  enabled: boolean;
  applicationId?: string;
  environment: "sandbox" | "development" | "production";
  reason?: string;
};

export function ManageSection({
  data,
  tellerConfig,
  linkedConnections,
}: {
  data: FinanceDashboard;
  tellerConfig: TellerConfig;
  linkedConnections: LinkedFinanceConnectionSummary[];
}) {
  const { accounts, goals } = data;

  return (
    <section id="manage" className="space-y-4">
      <div>
        <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
          Manage
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          Keep editing available, but secondary to the daily read above.
        </p>
      </div>

      <LinkedConnectionsPanel
        enabled={tellerConfig.enabled}
        applicationId={tellerConfig.applicationId}
        environment={tellerConfig.environment}
        reason={tellerConfig.reason}
        connections={linkedConnections}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
        <SectionCard
          title="Accounts"
          subtitle="Manual and linked accounts, tucked behind a single edit surface."
        >
          <details className="mt-5 rounded-2xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <summary className="cursor-pointer list-none text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {accounts.length > 0
                ? `Edit ${accounts.length} account${accounts.length === 1 ? "" : "s"} or add another`
                : "Add your first account"}
            </summary>
            <div className="mt-4">
              <AccountsPanel
                accounts={accounts.map((account) => ({
                  id: account.id,
                  name: account.name,
                  kind: account.kind,
                  syncSource: account.syncSource,
                  includeInNetWorth: account.includeInNetWorth,
                  includeInCashPosition: account.includeInCashPosition,
                  currentBalanceCents: account.currentBalanceCents,
                  statementBalanceCents: account.statementBalanceCents,
                  balanceUpdatedAt: account.balanceUpdatedAt.toISOString(),
                  dueDate: account.dueDate?.toISOString() ?? null,
                  creditLimitCents: account.creditLimitCents,
                }))}
              />
            </div>
          </details>
        </SectionCard>

        <SectionCard
          title="Goals"
          subtitle="Keep wedding, vacations, and projects out of your head and in a bucket."
        >
          <details className="mt-5 rounded-2xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <summary className="cursor-pointer list-none text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {goals.length > 0
                ? `Edit ${goals.length} goal bucket${goals.length === 1 ? "" : "s"} or add another`
                : "Add your first goal bucket"}
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
        </SectionCard>
      </div>
    </section>
  );
}
