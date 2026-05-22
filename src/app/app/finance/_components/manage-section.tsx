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
      <header>
        <p
          className="text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Manage
        </p>
        <h2
          className="mt-1 text-[1.25rem] font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          Accounts, goals, and connections.
        </h2>
        <p
          className="mt-1 text-[0.875rem]"
          style={{ color: "var(--text-muted)" }}
        >
          Kept out of the way of the daily read.
        </p>
      </header>

      <LinkedConnectionsPanel
        enabled={tellerConfig.enabled}
        applicationId={tellerConfig.applicationId}
        environment={tellerConfig.environment}
        reason={tellerConfig.reason}
        connections={linkedConnections}
      />

      <div className="grid grid-cols-1 gap-10 xl:grid-cols-[1fr_1fr] xl:gap-12">
        <SectionCard title="Accounts" subtitle="Manual and linked accounts in one place.">
          <details
            className="group rounded-md"
            style={{ border: "1px solid var(--border-soft)" }}
          >
            <summary
              className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-[0.875rem] font-medium transition-colors hover:bg-bg-hover"
              style={{ color: "var(--text)" }}
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="transition-transform group-open:rotate-90">
                <path d="m4 3 2.5 2.5L4 8" />
              </svg>
              {accounts.length > 0
                ? `Edit ${accounts.length} account${accounts.length === 1 ? "" : "s"}, or add another`
                : "Add the first account"}
            </summary>
            <div className="px-3 py-3" style={{ borderTop: "1px solid var(--border-faint)" }}>
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
          <details
            className="group rounded-md"
            style={{ border: "1px solid var(--border-soft)" }}
          >
            <summary
              className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-[0.875rem] font-medium transition-colors hover:bg-bg-hover"
              style={{ color: "var(--text)" }}
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="transition-transform group-open:rotate-90">
                <path d="m4 3 2.5 2.5L4 8" />
              </svg>
              {goals.length > 0
                ? `Edit ${goals.length} bucket${goals.length === 1 ? "" : "s"}, or add another`
                : "Add the first bucket"}
            </summary>
            <div className="px-3 py-3" style={{ borderTop: "1px solid var(--border-faint)" }}>
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
