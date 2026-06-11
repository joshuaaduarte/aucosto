// Server-rendered insights for the time page: today vs week per category
// (colored), a 7-day stacked trend, and waking-hours coverage. All derive
// math lives in src/lib/time-insights.ts.

import { formatHM } from "@/lib/time";
import type {
  CategoryWindowSummary,
  DayStack,
  TrackedCoverage,
} from "@/lib/time-insights";

export function InsightsSection({
  todayCategories,
  weekCategories,
  todayTotalMs,
  weekTotalMs,
  dailyStacks,
  coverage,
}: {
  todayCategories: CategoryWindowSummary[];
  weekCategories: CategoryWindowSummary[];
  todayTotalMs: number;
  weekTotalMs: number;
  dailyStacks: DayStack[];
  coverage: TrackedCoverage;
}) {
  const maxDayMs = Math.max(1, ...dailyStacks.map((day) => day.totalMs));

  return (
    <div className="space-y-8">
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
        <CategoryBreakdown
          eyebrow="Where today went"
          empty="Nothing tracked yet today."
          items={todayCategories}
          totalMs={todayTotalMs}
        />
        <CategoryBreakdown
          eyebrow="Where the week went"
          empty="No sessions filed yet this week."
          items={weekCategories}
          totalMs={weekTotalMs}
        />
      </div>

      <div>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <p
            className="text-[0.6875rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Last 7 days
          </p>
          {coverage.windowMs > 0 ? (
            <p className="text-[0.75rem]" style={{ color: "var(--text-muted)" }}>
              <span className="tabular font-semibold" style={{ color: "var(--text)" }}>
                {coverage.pct}%
              </span>{" "}
              of waking hours tracked today
            </p>
          ) : null}
        </div>
        <div className="flex h-28 items-end gap-2">
          {dailyStacks.map((day) => {
            const heightPct =
              day.totalMs > 0
                ? Math.max(4, Math.round((day.totalMs / maxDayMs) * 100))
                : 0;
            return (
              <div
                key={day.dayStart.toISOString()}
                className="flex min-w-0 flex-1 flex-col items-center gap-1.5 self-stretch"
              >
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="flex w-full flex-col-reverse overflow-hidden rounded-sm"
                    style={{
                      height: `${heightPct}%`,
                      background:
                        day.totalMs > 0 ? undefined : "var(--bg-tint)",
                      minHeight: day.totalMs > 0 ? "3px" : "2px",
                    }}
                    title={`${day.dayStart.toLocaleDateString([], {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })} · ${formatHM(day.totalMs)}`}
                  >
                    {day.segments.map((segment) => (
                      <div
                        key={segment.category}
                        style={{
                          height: `${(segment.ms / day.totalMs) * 100}%`,
                          background: segment.color,
                          opacity: 0.85,
                        }}
                      />
                    ))}
                  </div>
                </div>
                <span
                  className="text-[0.625rem] font-medium uppercase"
                  style={{
                    color: day.isToday ? "var(--text)" : "var(--text-faint)",
                  }}
                >
                  {day.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CategoryBreakdown({
  eyebrow,
  empty,
  items,
  totalMs,
}: {
  eyebrow: string;
  empty: string;
  items: CategoryWindowSummary[];
  totalMs: number;
}) {
  return (
    <div>
      <p
        className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-faint)" }}
      >
        {eyebrow}
      </p>
      {items.length === 0 ? (
        <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
          {empty}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const share =
              totalMs > 0
                ? Math.max(4, Math.round((item.totalMs / totalMs) * 100))
                : 0;
            return (
              <li key={item.category}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: item.color }}
                      aria-hidden
                    />
                    <span
                      className="truncate text-[0.875rem] font-medium"
                      style={{ color: "var(--text)" }}
                    >
                      {item.label}
                    </span>
                  </span>
                  <span
                    className="text-[0.75rem] tabular"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {formatHM(item.totalMs)}
                  </span>
                </div>
                <div
                  className="mt-1.5 h-[3px] rounded-full"
                  style={{ background: "var(--bg-tint-strong)" }}
                >
                  <div
                    className="h-[3px] rounded-full"
                    style={{ width: `${share}%`, background: item.color }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
