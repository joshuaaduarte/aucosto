// The headline number: how much flexible spending money is left this week,
// with this month's pace line underneath (spent so far vs where an even pace
// would be today). Server component; the "set your number" form is client.

import { formatUSDFromCents } from "@/lib/money";
import type { Pacing, PaceStatus } from "@/lib/finance-pacing";
import { FlexibleLimitForm } from "./tracking-forms";

const STATUS_COLOR: Record<PaceStatus, string> = {
  good: "var(--verdigris)",
  watch: "var(--aged-gold)",
  over: "var(--accent-strong)",
  unset: "var(--text-muted)",
};

function fmt(cents: number) {
  return formatUSDFromCents(cents, { maximumFractionDigits: 0 });
}

function dayLabel(d: Date) {
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export function paceHeadline(pacing: Pacing): string {
  if (!pacing.limitCents) return "Set your monthly spending money";
  if (pacing.week.leftCents >= 0) return `${fmt(pacing.week.leftCents)} left to spend this week`;
  return `${fmt(-pacing.week.leftCents)} over this week's amount`;
}

export function PaceCard({
  pacing,
  suggestedLimitCents,
}: {
  pacing: Pacing;
  suggestedLimitCents: number | null;
}) {
  const color = STATUS_COLOR[pacing.status];
  const { month, week } = pacing;

  if (!pacing.limitCents) {
    return (
      <section className="rounded-md border p-5" style={{ borderColor: "var(--border-soft)" }}>
        <p className="text-[1.25rem] font-semibold tracking-tight" style={{ color: "var(--text)" }}>
          How much do you want to spend each month?
        </p>
        <p className="mt-1 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
          This is the everyday money: groceries, eating out, shopping, fun. Rent and other bills are
          counted separately, so they never look like overspending.
          {suggestedLimitCents
            ? ` Over the last few months you spent about ${fmt(suggestedLimitCents)} a month on these.`
            : ""}
        </p>
        <div className="mt-4">
          <FlexibleLimitForm suggestedCents={suggestedLimitCents} />
        </div>
        {month.spentCents > 0 ? (
          <p className="mt-3 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
            So far this month: {fmt(month.spentCents)}.
          </p>
        ) : null}
      </section>
    );
  }

  const aheadText =
    month.aheadCents >= 0
      ? `${fmt(month.aheadCents)} under pace`
      : `${fmt(-month.aheadCents)} over pace`;

  return (
    <section className="rounded-md border p-5" style={{ borderColor: "var(--border-soft)" }}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-2.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: color }}
        />
        <div className="min-w-0">
          <p
            className="text-[1.5rem] font-semibold tracking-tight tabular sm:text-[1.75rem]"
            style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
          >
            {paceHeadline(pacing)}
          </p>
          <p className="mt-0.5 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
            {fmt(week.spentCents)} of {fmt(week.allowanceCents)} spent since {dayLabel(week.start)}
            {" · "}
            {week.daysLeft === 1 ? "last day" : `${week.daysLeft} days left`} this week
          </p>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[0.875rem]" style={{ color: "var(--text)" }}>
            This month: <span className="tabular font-semibold">{fmt(month.spentCents)}</span> of{" "}
            <span className="tabular">{fmt(pacing.limitCents)}</span>
          </p>
          <p className="text-[0.8125rem] font-medium" style={{ color }}>
            {aheadText}
          </p>
        </div>
        <PaceChart pacing={pacing} color={color} />
        <p className="mt-1 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
          The dashed line is an even pace through the month. Bills
          {pacing.fixedMonthlyCents ? ` (${fmt(pacing.fixedMonthlyCents)}/mo)` : ""} and yearly costs
          {pacing.occasionalMonthlyCents ? ` (${fmt(pacing.occasionalMonthlyCents)}/mo set aside)` : ""} are
          tracked separately.
        </p>
      </div>
    </section>
  );
}

function PaceChart({ pacing, color }: { pacing: Pacing; color: string }) {
  const width = 320;
  const height = 72;
  const pad = 2;
  const limit = pacing.limitCents ?? 1;
  const days = pacing.month.daysInMonth;
  const max = Math.max(limit, pacing.cumulativeByDay.at(-1) ?? 0) * 1.05;
  const x = (day: number) => pad + ((width - pad * 2) * day) / days;
  const y = (cents: number) => height - pad - ((height - pad * 2) * cents) / max;
  const spentPath = [`M ${x(0)} ${y(0)}`, ...pacing.cumulativeByDay.map((c, i) => `L ${x(i + 1)} ${y(c)}`)].join(" ");
  const last = pacing.cumulativeByDay.at(-1) ?? 0;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="mt-2 h-[72px] w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label={`Spent ${fmt(last)} by day ${pacing.month.dayOfMonth}; even pace would be ${fmt(pacing.month.expectedByTodayCents)}.`}
    >
      <line x1={x(0)} y1={y(limit)} x2={x(days)} y2={y(limit)} stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <line
        x1={x(0)}
        y1={y(0)}
        x2={x(days)}
        y2={y(limit)}
        stroke="var(--text-faint)"
        strokeWidth="1.25"
        strokeDasharray="4 4"
        vectorEffect="non-scaling-stroke"
      />
      <path d={spentPath} fill="none" stroke={color} strokeWidth="2.25" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
