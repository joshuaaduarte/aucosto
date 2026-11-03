// Where the money goes, month by month, and what next month will likely
// cost. Data comes from src/lib/finance-trends.ts.

import { formatUSDFromCents } from "@/lib/money";
import { categoryColor } from "@/lib/time-categories";
import { financeCategoryLook } from "@/lib/quick-capture";
import type { CategoryTrends, ForecastLine, NextMonthForecast } from "@/lib/finance-trends";
import { SectionCard } from "./ui";

function fmt(cents: number) {
  return formatUSDFromCents(cents, { maximumFractionDigits: 0 });
}

function changeLabel(change: number | null): { text: string; up: boolean } | null {
  if (change === null || !Number.isFinite(change)) return null;
  const pct = Math.round(change * 100);
  if (Math.abs(pct) < 10) return { text: "steady", up: false };
  return { text: `${pct > 0 ? "↑" : "↓"} ${Math.abs(pct)}%`, up: pct > 0 };
}

export function CategoryTrendsCard({ trends }: { trends: CategoryTrends }) {
  if (trends.rows.length === 0) return null;
  const last = trends.months.length - 1;
  return (
    <SectionCard
      title="Categories by month"
      subtitle="What each category cost, month by month. The arrow compares last month with the months before it."
    >
      <MobileTrends trends={trends} />
      <div className="-mx-2 hidden overflow-x-auto px-2 sm:block">
        <table className="w-full min-w-[32rem] text-[0.8125rem] tabular">
          <thead>
            <tr style={{ color: "var(--text-faint)" }}>
              <th className="py-1.5 pr-3 text-left font-medium">Category</th>
              {trends.months.map((m, i) => (
                <th key={m.toISOString()} className="px-2 py-1.5 text-right font-medium">
                  {i === last ? "This month" : m.toLocaleDateString([], { month: "short" })}
                </th>
              ))}
              <th className="px-2 py-1.5 text-right font-medium">Average</th>
              <th className="py-1.5 pl-2 text-right font-medium">Trend</th>
            </tr>
          </thead>
          <tbody>
            {trends.rows.map((row) => {
              const change = changeLabel(row.change);
              return (
                <tr key={row.category} className="border-t" style={{ borderColor: "var(--border-faint)" }}>
                  <td className="py-2 pr-3" style={{ color: "var(--text)" }}>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: categoryColor(row.category) }} />
                      {row.category}
                    </span>
                  </td>
                  {row.cents.map((c, i) => (
                    <td
                      key={i}
                      className="px-2 py-2 text-right"
                      style={{ color: c === 0 ? "var(--text-faint)" : i === last ? "var(--text-muted)" : "var(--text)" }}
                    >
                      {c === 0 ? "–" : fmt(c)}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right font-medium" style={{ color: "var(--text)" }}>
                    {row.averageCents ? fmt(row.averageCents) : "–"}
                  </td>
                  <td
                    className="py-2 pl-2 text-right"
                    style={{ color: change?.up ? "var(--attention)" : "var(--text-muted)" }}
                  >
                    {change?.text ?? ""}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t font-semibold" style={{ borderColor: "var(--border-soft)", color: "var(--text)" }}>
              <td className="py-2 pr-3">Total</td>
              {trends.totals.map((c, i) => (
                <td key={i} className="px-2 py-2 text-right">
                  {fmt(c)}
                </td>
              ))}
              <td />
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

/** Phones: one row per category with a tiny month-by-month bar strip. */
function MobileTrends({ trends }: { trends: CategoryTrends }) {
  const last = trends.months.length - 1;
  const max = Math.max(1, ...trends.rows.flatMap((r) => r.cents));
  return (
    <ul className="sm:hidden">
      {trends.rows.map((row) => {
        const change = changeLabel(row.change);
        const look = financeCategoryLook(row.category);
        return (
          <li key={row.category} className="flex items-center gap-3 border-t py-2.5 first:border-t-0" style={{ borderColor: "var(--border-faint)" }}>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 truncate text-[0.875rem]" style={{ color: "var(--text)" }}>
                {look.emoji ? <span aria-hidden>{look.emoji}</span> : <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: look.color }} />}
                {look.label}
              </span>
              <span className="text-[0.75rem]" style={{ color: change?.up ? "var(--attention)" : "var(--text-faint)" }}>
                {row.averageCents ? `usually ${fmt(row.averageCents)}` : "new"}
                {change ? ` · ${change.text}` : ""}
              </span>
            </span>
            <span className="flex h-7 items-end gap-[2px]" aria-hidden>
              {row.cents.map((c, i) => (
                <span
                  key={i}
                  className="w-1.5 rounded-sm"
                  style={{
                    height: `${Math.max(2, Math.round((c / max) * 28))}px`,
                    background: i === last ? look.color : "var(--bg-tint-strong)",
                  }}
                />
              ))}
            </span>
            <span className="w-16 shrink-0 text-right text-[0.875rem] font-medium tabular" style={{ color: "var(--text)" }}>
              {fmt(row.cents[last] ?? 0)}
            </span>
          </li>
        );
      })}
      <li className="flex justify-between border-t pt-2.5 text-[0.8125rem] font-semibold" style={{ borderColor: "var(--border-soft)", color: "var(--text)" }}>
        <span>This month</span>
        <span className="tabular">{fmt(trends.totals[last] ?? 0)}</span>
      </li>
    </ul>
  );
}

function Group({ title, lines, empty }: { title: string; lines: ForecastLine[]; empty: string }) {
  const total = lines.reduce((a, l) => a + l.cents, 0);
  return (
    <div>
      <div className="flex items-baseline justify-between text-[0.8125rem] font-semibold" style={{ color: "var(--text)" }}>
        <span>{title}</span>
        <span className="tabular">{fmt(total)}</span>
      </div>
      {lines.length === 0 ? (
        <p className="mt-1 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
          {empty}
        </p>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {lines.map((l) => (
            <li key={l.name} className="flex items-baseline justify-between gap-3 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
              <span className="truncate">{l.name}</span>
              <span className="tabular">{fmt(l.cents)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function NextMonthCard({ forecast }: { forecast: NextMonthForecast }) {
  const label = forecast.month.toLocaleDateString([], { month: "long" });
  return (
    <SectionCard
      title={`${label}, likely`}
      subtitle={
        forecast.basedOnMonths > 0
          ? `Your bills, the charges that repeat every month, and a typical month for everything else (average of the last ${forecast.basedOnMonths === 1 ? "month" : `${forecast.basedOnMonths} months`}).`
          : "Your bills and repeating charges. Everyday categories show up once there's a full month of history."
      }
    >
      <p className="text-[1.75rem] font-bold tabular" style={{ color: "var(--text)" }}>
        {fmt(forecast.totalCents)}
      </p>
      <div className="mt-4 grid gap-5 sm:grid-cols-3">
        <Group title="Bills" lines={forecast.bills} empty="Add rent and other bills under Plan." />
        <Group title="Subscriptions" lines={forecast.subscriptions} empty="None spotted yet." />
        <Group title="Everyday" lines={forecast.categories} empty="Needs a full month of history." />
      </div>
    </SectionCard>
  );
}
