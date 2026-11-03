// Net worth over time (from balance snapshots) and projected forward (from
// per-account contribution + growth settings). Server components; the
// settings forms are client components from tracking-forms.

import Link from "next/link";
import { formatUSDFromCents } from "@/lib/money";
import { formatAccountKind } from "@/lib/finance-accounts";
import { isLiabilityKind } from "@/lib/finance-statement-match";
import {
  formatNetWorthGroup,
  netWorthDrivers,
  type NetWorthPoint,
  type ProjectionPoint,
} from "@/lib/finance-networth";
import { AccountPlanForm, UpdateBalanceButton } from "./tracking-forms";

function fmt(cents: number) {
  return formatUSDFromCents(cents, { maximumFractionDigits: 0 });
}

function compact(cents: number) {
  const dollars = cents / 100;
  const abs = Math.abs(dollars);
  const sign = dollars < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${sign}$${Math.round(abs / 1000)}k`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${Math.round(abs)}`;
}

function SetupNote() {
  return (
    <p
      className="rounded-md px-3 py-2 text-[0.8125rem]"
      style={{ background: "var(--accent-tint)", color: "var(--text-muted)" }}
    >
      History and projections need a one-time database update (scripts/create-finance-tracking.sql).
      Everything else works in the meantime.
    </p>
  );
}

export function NetWorthSummary({
  points,
  ready,
}: {
  points: NetWorthPoint[];
  ready: boolean;
}) {
  const today = points.at(-1) ?? null;
  const previous = points.length >= 2 ? points[points.length - 2]! : null;
  const delta = today && previous ? today.totalCents - previous.totalCents : null;
  const drivers = today && previous ? netWorthDrivers(previous, today).slice(0, 3) : [];

  return (
    <section className="space-y-3">
      <div>
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
          Net worth
        </p>
        <p className="mt-1 text-[1.75rem] font-semibold tracking-tight tabular" style={{ color: "var(--text)", letterSpacing: "-0.025em" }}>
          {today ? fmt(today.totalCents) : "—"}
        </p>
        {delta !== null ? (
          <p className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
            <span style={{ color: delta >= 0 ? "var(--text)" : "var(--accent-strong)" }}>
              {delta === 0 ? "No change" : `${delta > 0 ? "+" : "−"}${fmt(Math.abs(delta))}`}
            </span>{" "}
            since {previous!.at.toLocaleDateString([], { month: "short", day: "numeric" })}
            {drivers.length
              ? ` · ${drivers
                  .map((d) =>
                    d.group === "debt"
                      ? `debt ${d.deltaCents > 0 ? "down" : "up"} ${fmt(Math.abs(d.deltaCents))}`
                      : `${formatNetWorthGroup(d.group).toLowerCase()} ${d.deltaCents > 0 ? "+" : "−"}${fmt(Math.abs(d.deltaCents))}`,
                  )
                  .join(", ")}`
              : ""}
          </p>
        ) : null}
      </div>
      {points.length >= 2 ? <HistoryChart points={points} /> : null}
      {!ready ? <SetupNote /> : points.length < 2 ? (
        <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
          The chart fills in as you update balances and check statements each month.
        </p>
      ) : null}
    </section>
  );
}

function HistoryChart({ points }: { points: NetWorthPoint[] }) {
  const width = 600;
  const height = 120;
  const padX = 4;
  const padTop = 12;
  const padBottom = 4;
  const values = points.map((p) => p.totalCents);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const span = max - min || 1;
  const x = (i: number) => padX + ((width - padX * 2) * i) / Math.max(1, points.length - 1);
  const y = (v: number) => padTop + (height - padTop - padBottom) * (1 - (v - min) / span);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.totalCents)}`).join(" ");

  return (
    <figure>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[120px] w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Net worth from ${fmt(values[0]!)} to ${fmt(values.at(-1)!)}`}
      >
        {min < 0 ? <line x1={padX} x2={width - padX} y1={y(0)} y2={y(0)} stroke="var(--border)" strokeWidth="1" /> : null}
        <path d={path} fill="none" stroke="var(--text)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <AxisLabels
        labels={points.map((p, i) => ({
          pct: (x(i) / width) * 100,
          text: i === points.length - 1 ? "Today" : p.at.toLocaleDateString([], { month: "short" }),
          show: i === 0 || i === points.length - 1 || points.length <= 7,
        }))}
      />
    </figure>
  );
}

export type AccountRow = {
  id: string;
  name: string;
  kind: string;
  balanceCents: number;
  balanceUpdatedAt: Date;
  pendingCount: number;
  lastCheckedThrough: Date | null;
  checkDue: boolean;
  /** Typed balance + entries logged since; null when nothing was logged. */
  estimateCents: number | null;
  entriesSince: number;
};

const STATEMENT_KINDS = new Set(["checking", "savings", "credit_card"]);

export function AccountList({ accounts }: { accounts: AccountRow[] }) {
  if (accounts.length === 0) {
    return (
      <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
        Add your accounts below: checking, savings, credit cards, retirement, and anything you own or owe.
      </p>
    );
  }
  return (
    <ul className="divide-y" style={{ borderColor: "var(--border-faint)" }}>
      {accounts.map((a) => {
        const owed = isLiabilityKind(a.kind);
        return (
          <li key={a.id} className="space-y-2 py-3" style={{ borderColor: "var(--border-faint)" }}>
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[0.9375rem] font-medium" style={{ color: "var(--text)" }}>
                  {a.name}
                </p>
                <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                  {formatAccountKind(a.kind)} · updated{" "}
                  {a.balanceUpdatedAt.toLocaleDateString([], { month: "short", day: "numeric" })}
                  {a.lastCheckedThrough
                    ? ` · statement checked through ${a.lastCheckedThrough.toLocaleDateString([], { month: "short", day: "numeric" })}`
                    : ""}
                </p>
                {a.pendingCount > 0 ? (
                  <p className="text-[0.75rem]" style={{ color: "var(--accent)" }}>
                    {a.pendingCount} logged {a.pendingCount === 1 ? "entry" : "entries"} not on a statement yet
                  </p>
                ) : null}
              </div>
              <p className="shrink-0 text-right tabular">
                <span className="block text-[1rem] font-semibold" style={{ color: "var(--text)" }}>
                  {fmt(a.balanceCents)}
                </span>
                {owed ? (
                  <span className="block text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                    owed
                  </span>
                ) : null}
                {a.estimateCents !== null ? (
                  <span
                    className="block text-[0.75rem]"
                    style={{ color: "var(--text-muted)" }}
                    title={`${fmt(a.balanceCents)} when you last updated it, plus ${a.entriesSince} ${a.entriesSince === 1 ? "entry" : "entries"} logged since`}
                  >
                    about {fmt(a.estimateCents)} now
                  </span>
                ) : null}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {STATEMENT_KINDS.has(a.kind) ? (
                <Link href={`/app/finance/check/${a.id}`} className={a.checkDue ? "btn-ink" : "btn-ghost"}>
                  {a.checkDue ? "Check this month's statement" : "Check a statement"}
                </Link>
              ) : null}
              <UpdateBalanceButton accountId={a.id} currentCents={a.balanceCents} owed={owed} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export type ProjectionAccount = {
  id: string;
  name: string;
  kind: string;
  monthlyContributionCents: number;
  annualGrowthBps: number;
};

export function ProjectionCard({
  points,
  ready,
  accounts,
  extraMonthlySavingsCents,
  goalMarkers,
}: {
  points: ProjectionPoint[];
  ready: boolean;
  accounts: ProjectionAccount[];
  extraMonthlySavingsCents: number;
  goalMarkers: Array<{ name: string; at: Date; monthIndex: number }>;
}) {
  const at = (m: number) => points.find((p) => p.monthIndex === m)?.totalCents ?? null;
  const milestones = [
    { label: "In 1 year", value: at(12) },
    { label: "In 5 years", value: at(60) },
    { label: "In 10 years", value: at(120) },
  ];
  return (
    <section className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {milestones.map((m) => (
          <div key={m.label}>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
              {m.label}
            </p>
            <p className="mt-1 text-[1.125rem] font-semibold tabular sm:text-[1.375rem]" style={{ color: "var(--text)" }}>
              {m.value === null ? "—" : compact(m.value)}
            </p>
          </div>
        ))}
      </div>
      {points.length > 1 ? <ProjectionChart points={points} goalMarkers={goalMarkers} /> : null}
      <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
        A simple estimate, not advice: today&rsquo;s balances, plus what you set below for each account.
        {extraMonthlySavingsCents > 0
          ? ` It also adds ${fmt(extraMonthlySavingsCents)} a month, your average savings (income minus spending) over the last three months, since no cash account has a monthly amount set.`
          : ""}
        {goalMarkers.length ? " Marks show when each goal is reached at its own monthly pace." : ""}
      </p>

      {!ready ? <SetupNote /> : null}
      {ready && accounts.length > 0 ? (
        <details className="group rounded-md" style={{ border: "1px solid var(--border-soft)" }}>
          <summary className="cursor-pointer list-none px-3 py-2.5 text-[0.875rem] font-medium" style={{ color: "var(--text)" }}>
            Adjust the assumptions ({accounts.length} account{accounts.length === 1 ? "" : "s"})
          </summary>
          <ul className="space-y-3 px-3 pb-3" style={{ borderTop: "1px solid var(--border-faint)" }}>
            {accounts.map((a) => (
              <li key={a.id} className="space-y-1 pt-3">
                <p className="text-[0.875rem]" style={{ color: "var(--text)" }}>
                  {a.name}{" "}
                  <span className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                    {formatAccountKind(a.kind)}
                  </span>
                </p>
                <AccountPlanForm
                  accountId={a.id}
                  monthlyCents={a.monthlyContributionCents}
                  rateBps={a.annualGrowthBps}
                  owed={isLiabilityKind(a.kind)}
                />
              </li>
            ))}
            <li className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
              Rates start at 0% so nothing is assumed. Many people use 5–7% a year for stock
              investments and retirement, and 0–4% for savings. For cards and loans, enter the
              interest rate and your monthly payment.
            </li>
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function ProjectionChart({
  points,
  goalMarkers,
}: {
  points: ProjectionPoint[];
  goalMarkers: Array<{ name: string; at: Date; monthIndex: number }>;
}) {
  const width = 600;
  const height = 130;
  const padX = 4;
  const padTop = 10;
  const padBottom = 4;
  const values = points.map((p) => p.totalCents);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const span = max - min || 1;
  const last = points.length - 1;
  const x = (m: number) => padX + ((width - padX * 2) * m) / Math.max(1, last);
  const y = (v: number) => padTop + (height - padTop - padBottom) * (1 - (v - min) / span);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.monthIndex)} ${y(p.totalCents)}`).join(" ");
  const ticks = [0, 12, 60, 120].filter((m) => m <= last);

  return (
    <figure>
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[130px] w-full" preserveAspectRatio="none" role="img" aria-label="Projected net worth over ten years">
      {min < 0 ? <line x1={padX} x2={width - padX} y1={y(0)} y2={y(0)} stroke="var(--border)" strokeWidth="1" /> : null}
      <path d={path} fill="none" stroke="var(--text)" strokeWidth="2" strokeDasharray="6 4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {goalMarkers
        .filter((g) => g.monthIndex > 0 && g.monthIndex <= last)
        .map((g) => {
          const value = points[g.monthIndex]?.totalCents ?? 0;
          return (
            <g key={g.name}>
              <line x1={x(g.monthIndex)} x2={x(g.monthIndex)} y1={y(value) - 8} y2={y(value) + 8} stroke="var(--accent)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
              <title>{`${g.name}: ${g.at.toLocaleDateString([], { month: "short", year: "numeric" })}`}</title>
            </g>
          );
        })}
    </svg>
      <AxisLabels
        labels={ticks.map((m) => ({ pct: (x(m) / width) * 100, text: m === 0 ? "Now" : `${m / 12} yr`, show: m !== 12 }))}
      />
    </figure>
  );
}

export function GoalMarkerList({ markers }: { markers: Array<{ name: string; at: Date | null }> }) {
  if (markers.length === 0) return null;
  return (
    <ul className="space-y-1 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
      {markers.map((m) => (
        <li key={m.name}>
          <span style={{ color: "var(--accent)" }}>|</span> {m.name}:{" "}
          {m.at ? `reached around ${m.at.toLocaleDateString([], { month: "short", year: "numeric" })}` : "set a monthly amount to see when"}
        </li>
      ))}
    </ul>
  );
}

function AxisLabels({ labels }: { labels: Array<{ pct: number; text: string; show: boolean }> }) {
  return (
    <div className="relative mt-1 h-4 text-[0.6875rem]" style={{ color: "var(--text-faint)" }} aria-hidden>
      {labels
        .filter((l) => l.show)
        .map((l) => (
          <span
            key={`${l.pct}-${l.text}`}
            className="absolute top-0 whitespace-nowrap"
            style={
              l.pct < 5
                ? { left: 0 }
                : l.pct > 95
                  ? { right: 0 }
                  : { left: `${l.pct}%`, transform: "translateX(-50%)" }
            }
          >
            {l.text}
          </span>
        ))}
    </div>
  );
}
