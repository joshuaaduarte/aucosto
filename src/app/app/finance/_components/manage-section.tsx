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
    <section id="manage" className="space-y-10">
      <header className="rule-t border-ink pt-4">
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.26em] text-ink-fade">
          Section V · Editorial Office
        </p>
        <h2 className="mt-2 font-display text-3xl font-medium italic tracking-[-0.02em] text-ink">
          Accounts, goals, and the press connections.
        </h2>
        <p className="mt-2 font-serif text-sm italic text-ink-fade">
          Kept out of the way of the daily read, available when needed.
        </p>
      </header>

      <LinkedConnectionsPanel
        enabled={tellerConfig.enabled}
        applicationId={tellerConfig.applicationId}
        environment={tellerConfig.environment}
        reason={tellerConfig.reason}
        connections={linkedConnections}
      />

      <div className="grid grid-cols-1 gap-12 xl:grid-cols-[1fr_1fr] xl:gap-14">
        <SectionCard title="Accounts" subtitle="Manual and linked accounts in one place.">
          <details className="mt-4 rule-t rule-b border-rule">
            <summary className="cursor-pointer list-none py-4 font-display text-lg italic text-ink hover:text-oxblood">
              {accounts.length > 0
                ? `Edit ${accounts.length} account${accounts.length === 1 ? "" : "s"}, or add another  →`
                : "Add the first account  →"}
            </summary>
            <div className="py-4">
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

        <SectionCard title="Goals" subtitle="Wedding, vacations, projects — kept in their bucket.">
          <details className="mt-4 rule-t rule-b border-rule">
            <summary className="cursor-pointer list-none py-4 font-display text-lg italic text-ink hover:text-oxblood">
              {goals.length > 0
                ? `Edit ${goals.length} bucket${goals.length === 1 ? "" : "s"}, or add another  →`
                : "Add the first bucket  →"}
            </summary>
            <div className="py-4">
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
