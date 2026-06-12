// Lightweight server-rendered chart primitives for the insights page.
// Hand-rolled SVG/CSS in the app's palette — responsive via viewBox/flex,
// no chart library needed at this scale.

import type { ReactNode } from "react";

export function SectionCard({
  eyebrow,
  title,
  aside,
  children,
}: {
  eyebrow: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-md border p-4 sm:p-5"
      style={{ borderColor: "var(--border-soft)", background: "var(--bg-page)" }}
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p
            className="text-[0.6875rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            {eyebrow}
          </p>
          <h2
            className="mt-1 text-[1rem] font-semibold tracking-tight"
            style={{ color: "var(--text)" }}
          >
            {title}
          </h2>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
      {children}
    </p>
  );
}

/** Tiny inline trend line; height ~28px, stretches to its container. */
export function Sparkline({
  values,
  color = "var(--text)",
  height = 28,
}: {
  values: number[];
  color?: string;
  height?: number;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 26 - (value / max) * 22;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox="0 0 100 28"
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Horizontal labeled bars for pattern findings / comparisons. */
export function MiniBars({
  bars,
  unit,
}: {
  bars: Array<{ label: string; value: number; color?: string }>;
  unit?: string;
}) {
  const maxAbs = Math.max(...bars.map((bar) => Math.abs(bar.value)), 0.001);
  return (
    <div className="space-y-1.5">
      {bars.map((bar) => (
        <div
          key={bar.label}
          className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-2"
        >
          <span
            className="truncate text-[0.72rem]"
            style={{ color: "var(--text-muted)" }}
          >
            {bar.label}
          </span>
          <div
            className="h-[5px] rounded-full"
            style={{ background: "var(--bg-tint-strong)" }}
          >
            <div
              className="h-[5px] rounded-full"
              style={{
                width: `${Math.max(3, Math.round((Math.abs(bar.value) / maxAbs) * 100))}%`,
                background:
                  bar.color ??
                  (bar.value < 0 ? "var(--accent)" : "var(--text)"),
              }}
            />
          </div>
          <span
            className="tabular text-[0.72rem] font-medium"
            style={{ color: "var(--text)" }}
          >
            {bar.value > 0 && unit === "Δ mood" ? "+" : ""}
            {bar.value}
            {unit === "%" ? "%" : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Vertical stacked columns (weeks × category segments). */
export function StackedColumns({
  columns,
  height = 128,
  formatTotal,
}: {
  columns: Array<{
    key: string;
    label: string;
    total: number;
    segments: Array<{ key: string; value: number; color: string }>;
  }>;
  height?: number;
  formatTotal: (total: number) => string;
}) {
  const max = Math.max(...columns.map((c) => c.total), 1);
  return (
    <div className="flex items-end gap-1.5 sm:gap-2" style={{ height }}>
      {columns.map((column) => (
        <div
          key={column.key}
          className="flex min-w-0 flex-1 flex-col items-center gap-1 self-stretch"
        >
          <div className="flex w-full flex-1 items-end">
            <div
              className="flex w-full flex-col-reverse overflow-hidden rounded-sm"
              style={{
                height: `${column.total > 0 ? Math.max(4, (column.total / max) * 100) : 0}%`,
                background: column.total > 0 ? undefined : "var(--bg-tint)",
                minHeight: column.total > 0 ? "3px" : "2px",
              }}
              title={`${column.label} · ${formatTotal(column.total)}`}
            >
              {column.segments.map((segment) => (
                <div
                  key={segment.key}
                  style={{
                    height: `${(segment.value / column.total) * 100}%`,
                    background: segment.color,
                    opacity: 0.85,
                  }}
                />
              ))}
            </div>
          </div>
          <span
            className="truncate text-[0.6rem] font-medium"
            style={{ color: "var(--text-faint)" }}
          >
            {column.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Simple vertical bars (single series, e.g. weekly %). */
export function SimpleColumns({
  columns,
  height = 96,
  color = "var(--text)",
  suffix = "",
}: {
  columns: Array<{ key: string; label: string; value: number }>;
  height?: number;
  color?: string;
  suffix?: string;
}) {
  const max = Math.max(...columns.map((c) => c.value), 1);
  return (
    <div className="flex items-end gap-1.5 sm:gap-2" style={{ height }}>
      {columns.map((column) => (
        <div
          key={column.key}
          className="flex min-w-0 flex-1 flex-col items-center gap-1 self-stretch"
          title={`${column.label} · ${column.value}${suffix}`}
        >
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-sm"
              style={{
                height: `${Math.max(4, (column.value / max) * 100)}%`,
                background: color,
                opacity: 0.85,
              }}
            />
          </div>
          <span
            className="truncate text-[0.6rem] font-medium"
            style={{ color: "var(--text-faint)" }}
          >
            {column.label}
          </span>
        </div>
      ))}
    </div>
  );
}
