import { formatUSDFromCents } from "@/lib/money";
import type { FinanceDashboard } from "../_lib/derive";
import { QuickStat, SectionCard, SummaryCard } from "./ui";
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
      {/* Page header */}
      <header className="fade-in flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p
            className="text-[0.75rem] font-medium uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Finance
          </p>
          <h1
            className="mt-1 text-[1.5rem] font-bold tracking-tight sm:text-[1.875rem]"
            style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
          >
            Ledger
          </h1>
        </div>
        <p
          className="text-[0.8125rem] sm:max-w-[38rem] sm:text-right"
          style={{ color: "var(--text-muted)" }}
        >
          {count > 0
            ? `${count} transaction${count === 1 ? "" : "s"} loaded · ${alerts.length} alert${alerts.length === 1 ? "" : "s"} in view`
            : "No ledger data loaded yet"}
        </p>
      </header>

      {/* Quick stats row */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-md sm:grid-cols-4"
               style={{ background: "var(--border-faint)", border: "1px solid var(--border-faint)" }}>
        <StatTile
          label="Net worth"
          value={formatUSDFromCents(snapshot.netWorthCents)}
        />
        <StatTile
          label="Cash on hand"
          value={formatUSDFromCents(snapshot.cashCents)}
        />
        <StatTile
          label="This month net"
          value={formatUSDFromCents(thisMonthSummary.netCents)}
          tone={thisMonthSummary.netCents < 0 ? "warn" : "default"}
        />
        <StatTile
          label="Projected"
          value={formatUSDFromCents(spendProjection.projectedCents)}
        />
      </section>

      {/* Contents nav */}
      <nav
        className="sticky top-0 z-20 -mx-2 flex items-center gap-3 overflow-x-auto px-2 py-2 sm:mx-0 sm:px-0"
        style={{
          background: "color-mix(in oklab, var(--bg-page) 92%, transparent)",
          backdropFilter: "blur(6px)",
        }}
        aria-label="Sections"
      >
        <span
          className="shrink-0 text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Sections
        </span>
        <ContentsLink href="#overview" label="Overview" />
        <ContentsLink href="#transactions" label="Transactions" />
        <ContentsLink href="#planning" label="Planning" />
        <ContentsLink href="#insights" label="Patterns" />
        <ContentsLink href="#manage" label="Manage" />
        {count > 0 && (
          <span className="ml-auto shrink-0">
            <ClearButton />
          </span>
        )}
      </nav>

      <section id="overview" className="space-y-8">
        <UploadForm />

        {duplicateManualAccounts.length > 0 && (
          <aside
            className="flex items-start gap-3 rounded-md px-4 py-3"
            style={{
              background: "var(--accent-tint)",
              border: "1px solid var(--accent-tint-strong)",
            }}
          >
            <span
              className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[0.6875rem] font-semibold"
              style={{
                background: "var(--accent)",
                color: "var(--text-on-accent)",
              }}
            >
              !
            </span>
            <div>
              <p
                className="text-[0.875rem] font-semibold"
                style={{ color: "var(--text)" }}
              >
                Likely duplicate accounts set aside.
              </p>
              <p
                className="mt-1 text-[0.8125rem]"
                style={{ color: "var(--text-muted)" }}
              >
                In question: {duplicateManualAccounts.map((a) => a.name).join(", ")}.
                They remain below if you want to rename, edit, or delete them.
              </p>
            </div>
          </aside>
        )}

        <div className="grid gap-10 xl:grid-cols-[1.15fr_0.85fr] xl:gap-12">
          <SectionCard
            title="Snapshot"
            subtitle="The balances that change today's decisions."
          >
            <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
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
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Watchlist"
            subtitle="Things worth checking next."
          >
            <div className="space-y-1.5">
              {alerts.length > 0 ? (
                alerts.map((alert) => (
                  <div
                    key={alert.title}
                    className="grid grid-cols-[16px_1fr] items-start gap-3 rounded-md px-2 py-2.5"
                  >
                    <span
                      aria-hidden
                      className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full"
                      style={{
                        background:
                          alert.tone === "amber"
                            ? "var(--accent)"
                            : "var(--text-muted)",
                      }}
                    />
                    <div>
                      <p
                        className="text-[0.875rem] font-medium"
                        style={{ color: "var(--text)" }}
                      >
                        {alert.title}
                      </p>
                      <p
                        className="mt-0.5 text-[0.8125rem]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {alert.body}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p
                  className="px-2 text-[0.875rem]"
                  style={{ color: "var(--text-muted)" }}
                >
                  Import more activity or add due dates and goals to surface
                  sharper nudges.
                </p>
              )}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <QuickStat
                label="Net flow"
                value={formatUSDFromCents(thisMonthSummary.netCents)}
                tone={thisMonthSummary.netCents >= 0 ? "positive" : "default"}
              />
              <QuickStat
                label="Next due"
                value={
                  nextDueAccounts[0]?.dueDate
                    ? nextDueAccounts[0].dueDate.toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })
                    : "—"
                }
              />
              <QuickStat
                label="Top pressure"
                value={
                  topGoal?.name ?? topProjectedCategory?.category ?? "—"
                }
              />
            </div>
            <p
              className="mt-3 text-[0.75rem]"
              style={{ color: "var(--text-faint)" }}
            >
              {topGoalProgress
                ? `${formatUSDFromCents(topGoalProgress.monthlyNeededCents)} per month needed`
                : topProjectedCategory
                  ? `${formatUSDFromCents(topProjectedCategory.projectedCents)} projected this month`
                  : "Add goals or more activity to refine."}
            </p>
          </SectionCard>
        </div>
      </section>
    </>
  );
}

function StatTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warn";
}) {
  return (
    <div className="px-4 py-4" style={{ background: "var(--bg-page)" }}>
      <p
        className="text-[0.6875rem] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-faint)" }}
      >
        {label}
      </p>
      <p
        className="mt-1 truncate text-[1.25rem] font-semibold tracking-tight tabular sm:text-[1.4rem]"
        style={{
          color:
            tone === "warn" ? "var(--accent-strong)" : "var(--text)",
          letterSpacing: "-0.025em",
          fontFeatureSettings: '"tnum" 1',
        }}
      >
        {value}
      </p>
    </div>
  );
}

function ContentsLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="shrink-0 rounded px-2 py-1 text-[0.8125rem] font-medium transition-colors hover:bg-bg-hover"
      style={{ color: "var(--text-muted)" }}
    >
      {label}
    </a>
  );
}
