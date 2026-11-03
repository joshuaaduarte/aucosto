import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTellerConnectConfig } from "@/lib/teller";
import {
  countTransactions,
  getMoneyDateDone,
  listAccountPlans,
  listAccounts,
  listBalanceSnapshots,
  listBills,
  listBudgets,
  listGoals,
  listImportBatches,
  listLinkedConnections,
  listPaychecks,
  listStatementChecks,
  listTransactions,
  hasShortcutKey,
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
import { formatUSDFromCents } from "@/lib/money";
import { requireViewerContext } from "@/lib/viewer-context";
import {
  HouseholdPlanningSection,
  type HouseholdPlanningData,
} from "./_components/household-planning-section";
import { FinanceScopeSwitcher } from "./_components/scope-switcher";
import { InsightsSection } from "./_components/insights-section";
import { CategoryTrendsCard, NextMonthCard } from "./_components/spending-trends";
import { categoryTrends } from "@/lib/finance-trends";
import { PaychecksForm, PotsCard, SalaryBudgetCard } from "./_components/salary-budget";
import { deriveSalary, type SalaryView } from "./_lib/derive-salary";
import { spendCategoryChoices } from "@/lib/finance-categories";
import { PlanningSection } from "./_components/planning-section";
import { QuickAdd } from "./_components/quick-add";
import { PaceCard, paceHeadline } from "./_components/pace-card";
import { EntryList } from "./_components/entry-list";
import { WeeklyCheckIn } from "./_components/weekly-check-in";
import {
  AccountList,
  GoalMarkerList,
  NetWorthSummary,
  ProjectionCard,
} from "./_components/net-worth";
import { FlexibleLimitForm } from "./_components/tracking-forms";
import { ShortcutPanel } from "./_components/shortcut-panel";
import { CardBills } from "./_components/card-bills";
import { ImportHistory, type ImportBatchView } from "./_components/import-history";
import { SectionCard } from "./_components/ui";
import { AccountsPanel } from "./accounts-panel";
import { GoalsPanel } from "./goals-panel";
import { LinkedConnectionsPanel } from "./linked-connections-panel";
import { UploadForm } from "./upload-form";
import { ClearButton } from "./clear-button";
import { deriveFinanceDashboard } from "./_lib/derive";
import { deriveTracking, type TrackingView } from "./_lib/derive-tracking";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "spending", label: "Spending" },
  { key: "accounts", label: "Accounts" },
  { key: "plan", label: "Plan" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function fmt(cents: number) {
  return formatUSDFromCents(cents, { maximumFractionDigits: 0 });
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; add?: string; filter?: string }>;
}) {
  const context = await requireViewerContext();
  if (!context.financeVisible) {
    redirect("/app");
  }
  const params = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === params.tab) ? (params.tab as TabKey) : "overview";
  const userId = context.financeUserId;

  const now = new Date();
  const weekKey = moneyDateWeekKey(now);
  const [
    accounts,
    goals,
    linkedConnections,
    count,
    history,
    budgets,
    bills,
    moneyDateDone,
    names,
    snapshots,
    plans,
    checks,
    importBatches,
    paychecks,
  ] = await Promise.all([
    listAccounts(userId),
    listGoals(userId),
    listLinkedConnections(userId),
    countTransactions(userId),
    listTransactions(userId, { limit: 2000 }),
    listBudgets(userId),
    listBills(userId),
    getMoneyDateDone(userId, weekKey).catch(() => null),
    context.householdId
      ? householdMemberNames(context.householdId).catch(() => ({}) as Record<string, string>)
      : Promise.resolve({} as Record<string, string>),
    listBalanceSnapshots(userId),
    listAccountPlans(userId),
    listStatementChecks(userId),
    listImportBatches(userId).catch(() => []),
    listPaychecks(userId),
  ]);

  const data = deriveFinanceDashboard({ accounts, goals, history, count });
  const categoryChoices = spendCategoryChoices(history);
  const tracking = deriveTracking({
    accounts,
    history,
    budgets,
    bills,
    goals,
    snapshots: snapshots.snapshots,
    plans: plans.plans,
    checks: checks.checks,
    names,
    viewerUserId: context.ownerUserId,
    now,
  });
  const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? n;
  const salary = deriveSalary({
    paychecks,
    history,
    bills,
    goals,
    accounts,
    hasLimits: tracking.categoryBudgets.length > 0,
    people: [
      ...(names[context.ownerUserId] ? [names[context.ownerUserId]!] : []),
      ...Object.entries(names)
        .filter(([id]) => id !== context.ownerUserId)
        .map(([, n]) => n),
    ].map(firstName),
    now,
  });
  const planning = derivePlanning({
    budgets: tracking.categoryBudgets,
    bills,
    history,
    now,
    weekKey,
    moneyDateDone,
    names,
  });
  planning.sharedWith = context.financeScope === "household" ? context.householdName : null;
  const setupReady = snapshots.ready && plans.ready && checks.ready;
  let shortcut: { endpoint: string; hasKey: boolean } | null = null;
  if (tab === "spending") {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "aucosto.com";
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    shortcut = {
      endpoint: `${proto}://${host}/api/finance/entries`,
      hasKey: await hasShortcutKey(context.ownerUserId),
    };
  }

  return (
    <div className="space-y-8 pb-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            className="text-[1.5rem] font-bold tracking-tight sm:text-[1.875rem]"
            style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
          >
            Finance
          </h1>
          <p className="mt-0.5 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
            {planning.sharedWith ? `Shared with ${planning.sharedWith}` : "Just you"}
          </p>
        </div>
        {context.householdUserId && !context.isDemoMode ? (
          <FinanceScopeSwitcher
            scope={context.financeScope}
            householdName={context.householdName ?? "Household"}
          />
        ) : null}
      </header>

      <nav
        className="sticky top-0 z-20 -mx-2 flex gap-1 overflow-x-auto px-2 py-2 sm:mx-0 sm:px-0"
        style={{
          background: "color-mix(in oklab, var(--bg-page) 92%, transparent)",
          backdropFilter: "blur(6px)",
          borderBottom: "1px solid var(--border-faint)",
        }}
        aria-label="Finance sections"
      >
        {TABS.map((t) => {
          const active = t.key === tab;
          const badge =
            t.key === "spending" && tracking.toSortCount
              ? tracking.toSortCount
              : t.key === "accounts" && tracking.statementsDue.length
                ? tracking.statementsDue.length
                : null;
          return (
            <Link
              key={t.key}
              href={t.key === "overview" ? "/app/finance" : `/app/finance?tab=${t.key}`}
              aria-current={active ? "page" : undefined}
              className="shrink-0 rounded px-3 py-1.5 text-[0.875rem] font-medium transition-colors"
              style={{
                background: active ? "var(--bg-tint-strong)" : "transparent",
                color: active ? "var(--text)" : "var(--text-muted)",
              }}
            >
              {t.label}
              {badge ? (
                <span
                  className="ml-1.5 rounded-full px-1.5 text-[0.6875rem] tabular"
                  style={{ background: "var(--accent-tint-strong)", color: "var(--text)" }}
                >
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {tab === "overview" ? (
        <OverviewTab
          tracking={tracking}
          planning={planning}
          accounts={accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind }))}
          categories={categoryChoices}
          salary={salary}
          autoFocusAdd={params.add === "1"}
        />
      ) : null}

      {tab === "spending" ? (
        <div className="space-y-12">
          <QuickAdd
            accounts={accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind }))}
            merchants={tracking.merchants}
            defaultAccountId={tracking.defaultAccountId}
            categories={categoryChoices}
          />
          <EntryList
            entries={tracking.entries}
            accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
            categories={[...categoryChoices, "Income"]}
            pots={salary.pots.map((p) => ({ id: p.id, name: p.name }))}
            initialFilter={params.filter === "to_sort" ? "to_sort" : params.filter === "pending" ? "pending" : "all"}
          />
          {count > history.length ? (
            <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
              Showing the latest {history.length} of {count} entries.
            </p>
          ) : null}
          {shortcut && !context.isDemoMode ? (
            <Collapsible title="Log from your iPhone">
              <ShortcutPanel endpoint={shortcut.endpoint} hasKey={shortcut.hasKey} />
            </Collapsible>
          ) : null}
          {history.length > 0 ? (
            <>
              <NextMonthCard forecast={salary.forecast} />
              <CategoryTrendsCard trends={categoryTrends({ history, now })} />
            </>
          ) : null}
          {count > 0 ? <InsightsSection data={data} /> : null}
        </div>
      ) : null}

      {tab === "accounts" ? (
        <div className="space-y-10">
          <NetWorthSummary points={tracking.netWorthPoints} ready={snapshots.ready} />
          <SectionCard
            title="Accounts"
            subtitle="Check card and bank statements once a month. For everything else, just update the balance."
          >
            <div className="mb-4 flex flex-wrap gap-2">
              <Link href="/app/finance/catch-up?only=invest" className="btn-ink">
                Monthly balance check-in
              </Link>
              <Link href="/app/finance/catch-up" className="btn-ghost">
                Update every balance
              </Link>
            </div>
            <AccountList accounts={tracking.accountRows} />
          </SectionCard>
          <div className="space-y-3">
            <Collapsible
              title={accounts.length ? "Add or edit accounts" : "Add your first account"}
              defaultOpen={accounts.length === 0}
            >
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
            </Collapsible>
            <Collapsible title="Import past transactions (CSV or PDF)">
              <p className="mb-3 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                For loading history you never logged. Import one account&rsquo;s file at a time and
                pick the account, so rows land in the right place. To confirm this month&rsquo;s
                entries, use &ldquo;Check a statement&rdquo; on the account instead.
              </p>
              <UploadForm accounts={accounts.map((a) => ({ id: a.id, name: a.name }))} />
            </Collapsible>
            {importBatches.length > 0 ? (
              <Collapsible title={`Past imports (${importBatches.length})`} defaultOpen>
                <ImportHistory batches={importBatches.map(importBatchView)} />
              </Collapsible>
            ) : null}
            {linkedConnections.length > 0 ? (
              <Collapsible title="Linked banks">
                <LinkedConnectionsPanel {...getTellerConnectConfig()} connections={linkedConnections} />
              </Collapsible>
            ) : null}
            {count > 0 ? (
              <Collapsible title="Danger zone">
                <ClearButton />
              </Collapsible>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "plan" ? (
        <div className="space-y-12">
          <SectionCard
            title="Paychecks"
            subtitle="Which pay you live on and which goes to saving and investing. The budget builds itself on the live-on pay."
          >
            <PaychecksForm initial={salary.paycheckRows} detected={salary.detectedCents} />
          </SectionCard>
          {salary.budget ? (
            <SalaryBudgetCard
              budget={salary.budget}
              liveName={salary.liveName}
              investName={salary.investName}
              flexibleCents={salary.flexibleCents}
              hasLimits={salary.hasLimits}
            />
          ) : null}
          <SectionCard
            title="Monthly spending money"
            subtitle="The everyday money: groceries, eating out, shopping, fun. Each week gets a fair share of what's left."
          >
            <FlexibleLimitForm
              currentCents={tracking.flexibleLimitCents}
              suggestedCents={tracking.suggestedLimitCents}
              label={tracking.flexibleLimitCents ? "Update" : "Save"}
            />
            <dl className="mt-4 grid grid-cols-2 gap-3 text-[0.8125rem] sm:grid-cols-3">
              <div>
                <dt style={{ color: "var(--text-faint)" }}>Fixed bills</dt>
                <dd className="tabular" style={{ color: "var(--text)" }}>
                  {fmt(tracking.pacing.fixedMonthlyCents)}/mo
                </dd>
              </div>
              <div>
                <dt style={{ color: "var(--text-faint)" }}>Yearly costs, set aside</dt>
                <dd className="tabular" style={{ color: "var(--text)" }}>
                  {fmt(tracking.pacing.occasionalMonthlyCents)}/mo
                </dd>
              </div>
              {tracking.suggestedLimitCents ? (
                <div>
                  <dt style={{ color: "var(--text-faint)" }}>Your recent average</dt>
                  <dd className="tabular" style={{ color: "var(--text)" }}>
                    {fmt(tracking.suggestedLimitCents)}/mo
                  </dd>
                </div>
              ) : null}
            </dl>
          </SectionCard>

          <HouseholdPlanningSection data={planning} />

          <SectionCard
            title="Where net worth is heading"
            subtitle="Today's balances carried forward with what goes in each month."
          >
            <ProjectionCard
              points={tracking.projection}
              ready={plans.ready}
              accounts={accounts
                .filter((a) => a.includeInNetWorth)
                .map((a) => ({
                  id: a.id,
                  name: a.name,
                  kind: a.kind,
                  monthlyContributionCents: tracking.planByAccount.get(a.id)?.monthlyContributionCents ?? 0,
                  annualGrowthBps: tracking.planByAccount.get(a.id)?.annualGrowthBps ?? 0,
                }))}
              extraMonthlySavingsCents={tracking.extraMonthlySavingsCents}
              goalMarkers={tracking.goalMarkers
                .filter((g) => g.at !== null)
                .map((g) => ({ name: g.name, at: g.at!, monthIndex: g.monthIndex }))}
            />
            <div className="mt-3">
              <GoalMarkerList markers={tracking.goalMarkers} />
            </div>
          </SectionCard>

          <PlanningSection data={data} showOutlook={false} />

          <Collapsible title={goals.length ? `Edit pots and goals (${goals.length})` : "Add a goal"} defaultOpen={goals.length === 0}>
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
          </Collapsible>
        </div>
      ) : null}

      {!setupReady ? (
        <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
          Net worth history, statement checks and projection settings turn on after a one-time
          database update (scripts/create-finance-tracking.sql).
        </p>
      ) : null}
    </div>
  );
}

function OverviewTab({
  tracking,
  planning,
  accounts,
  categories,
  salary,
  autoFocusAdd,
}: {
  tracking: TrackingView;
  planning: HouseholdPlanningData;
  accounts: Array<{ id: string; name: string; kind: string }>;
  categories: string[];
  salary: SalaryView;
  autoFocusAdd: boolean;
}) {
  const nw = tracking.netWorthPoints;
  const today = nw.at(-1) ?? null;
  const previous = nw.length >= 2 ? nw[nw.length - 2]! : null;
  const billsDue = planning.bills.filter((b) => b.daysUntil <= 7);
  const payFrom = accounts.find((a) => a.id === tracking.payFromAccountId) ?? null;
  const savings = tracking.savings;
  return (
    <div className="space-y-6">
      {tracking.catchUp ? (
        <Link
          href="/app/finance/catch-up"
          className="block rounded-md px-4 py-3 text-[0.875rem] transition-colors"
          style={{ background: "var(--accent-tint)", color: "var(--text)" }}
        >
          <span className="font-semibold">It&rsquo;s been a while.</span> Skip the months you missed: type in
          today&rsquo;s balances and start fresh. About 5 minutes →
        </Link>
      ) : null}
      <QuickAdd
        accounts={accounts}
        merchants={tracking.merchants}
        defaultAccountId={tracking.defaultAccountId}
        categories={categories}
        autoFocus={autoFocusAdd}
      />
      <PaceCard pacing={tracking.pacing} suggestedLimitCents={tracking.suggestedLimitCents} />
      <CardBills
        cards={tracking.cards.map((c) => ({
          id: c.id,
          name: c.name,
          statementBalanceCents: c.statementBalanceCents,
          dueDay: c.dueDate ? dayKeyOf(c.dueDate) : null,
          daysUntil: c.daysUntil,
          waitingForStatement: c.waitingForStatement,
          lastMonth:
            c.lastMonth.chargedCents || c.lastMonth.paidCents
              ? {
                  label: c.lastMonth.start.toLocaleDateString([], { month: "long" }),
                  chargedCents: c.lastMonth.chargedCents,
                  paidCents: c.lastMonth.paidCents,
                }
              : null,
        }))}
        safe={tracking.safe}
        payFrom={payFrom ? { id: payFrom.id, name: payFrom.name } : null}
      />
      {salary.budget ? (
        <SalaryBudgetCard
          budget={salary.budget}
          liveName={salary.liveName}
          investName={salary.investName}
          flexibleCents={salary.flexibleCents}
          hasLimits={salary.hasLimits}
        />
      ) : (
        <Link
          href="/app/finance?tab=plan"
          className="block rounded-md px-4 py-3 text-[0.875rem] transition-colors"
          style={{ background: "var(--bg-tint)", color: "var(--text)" }}
        >
          <span className="font-semibold">Live on one paycheck.</span> Add your paychecks and the budget builds
          itself from your spending →
        </Link>
      )}
      <PotsCard pots={salary.pots} emergencyTargetCents={salary.emergencyTargetCents} heldIn={salary.heldIn} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OverviewTile
          href="/app/finance?tab=accounts"
          label="Net worth"
          value={today ? fmt(today.totalCents) : "Add accounts"}
          hint={
            today && previous
              ? `${netChangeLabel(today.totalCents - previous.totalCents)} since ${previous.at.toLocaleDateString([], { month: "short", day: "numeric" })}`
              : "See accounts"
          }
        />
        <OverviewTile
          href="/app/finance?tab=spending&filter=to_sort"
          label="To sort"
          value={String(tracking.toSortCount)}
          hint={tracking.toSortCount ? "entries need a category" : "all sorted"}
        />
        <OverviewTile
          href="/app/finance?tab=accounts"
          label="Statements"
          value={tracking.statementsDue.length ? `${tracking.statementsDue.length} to check` : "Up to date"}
          hint={
            tracking.pendingCount
              ? `${tracking.pendingCount} logged ${tracking.pendingCount === 1 ? "entry" : "entries"} waiting`
              : "nothing waiting"
          }
        />
        <OverviewTile
          href="/app/finance/catch-up?only=invest"
          label="Saved this month"
          value={savings.rate !== null ? `${Math.round(savings.rate * 100)}%` : fmt(savings.savedCents)}
          hint={
            savings.rate !== null
              ? `${fmt(savings.savedCents)} of ${fmt(savings.incomeCents)} income`
              : "log paychecks to see a rate"
          }
        />
      </div>
      <WeeklyCheckIn
        moneyDate={planning.moneyDate}
        done={planning.moneyDateDone}
        shared={Boolean(planning.sharedWith)}
        toSortCount={tracking.toSortCount}
        pendingCount={tracking.pendingCount}
        paceLine={paceHeadline(tracking.pacing)}
        statementsDue={tracking.statementsDue}
        staleBalances={tracking.staleBalances}
        billsDue={billsDue}
        cardsDue={tracking.cards
          .filter((c) => !c.waitingForStatement && c.daysUntil !== null && c.daysUntil <= 7)
          .map((c) => ({ id: c.id, name: c.name, amountCents: c.statementBalanceCents ?? 0, daysUntil: c.daysUntil! }))}
        checkInDue={tracking.checkInDue.length > 0}
        safeShortCents={tracking.safe && tracking.safe.safeCents < 0 ? -tracking.safe.safeCents : 0}
      />
    </div>
  );
}

function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function netChangeLabel(cents: number): string {
  if (cents === 0) return "No change";
  return `${cents > 0 ? "+" : "−"}${fmt(Math.abs(cents))}`;
}

function OverviewTile({ href, label, value, hint }: { href: string; label: string; value: string; hint: string }) {
  return (
    <Link
      href={href}
      className="block rounded-md border px-4 py-3 transition-colors hover:bg-bg-hover"
      style={{ borderColor: "var(--border-soft)" }}
    >
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
        {label}
      </p>
      <p className="mt-1 text-[1.25rem] font-semibold tabular" style={{ color: "var(--text)" }}>
        {value}
      </p>
      <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
        {hint}
      </p>
    </Link>
  );
}

function importBatchView(b: Awaited<ReturnType<typeof listImportBatches>>[number]): ImportBatchView {
  const day = (d: Date, year: boolean) =>
    d.toLocaleDateString([], { month: "short", day: "numeric", year: year ? "numeric" : undefined });
  const sameYear = b.firstDate.getFullYear() === b.lastDate.getFullYear();
  return {
    from: b.from.toISOString(),
    to: b.to.toISOString(),
    importedLabel: b.from.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
    rangeLabel: `${day(b.firstDate, !sameYear)} – ${day(b.lastDate, true)}`,
    count: b.count,
    accounts: b.accounts,
    spentCents: b.spentCents,
    incomeCents: b.incomeCents,
  };
}

function Collapsible({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-md" style={{ border: "1px solid var(--border-soft)" }} open={defaultOpen}>
      <summary
        className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-[0.875rem] font-medium transition-colors hover:bg-bg-hover"
        style={{ color: "var(--text)" }}
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="transition-transform group-open:rotate-90">
          <path d="m4 3 2.5 2.5L4 8" />
        </svg>
        {title}
      </summary>
      <div className="px-3 py-3" style={{ borderTop: "1px solid var(--border-faint)" }}>
        {children}
      </div>
    </details>
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
