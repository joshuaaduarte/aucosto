import type { ReactNode } from "react";
import Link from "next/link";
import { formatBudgetMinutes } from "@/lib/projects";
import type { BoardProjectDetail } from "@/lib/services/projects";

function Row({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <span className="mt-0.5 shrink-0 text-base leading-none" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
          {label}
        </p>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
}

function relativeDay(at: Date, now: Date): string {
  const startOfDay = (d: Date) => {
    const next = new Date(d);
    next.setHours(0, 0, 0, 0);
    return next;
  };
  const diff = Math.round((startOfDay(now).getTime() - startOfDay(at).getTime()) / 86_400_000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  return at.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * The core differentiator: a single panel that pulls the project's pulse from
 * every other aucosto tool — time, calendar, habits — and only shows a row when
 * that tool actually has something to say.
 */
export function HealthPanel({
  health,
  now,
}: {
  health: BoardProjectDetail["health"];
  now: Date;
}) {
  const { timeBudgetMinutes, budgetPct } = health;

  return (
    <section
      className="overflow-hidden rounded-lg border"
      style={{ borderColor: "var(--border-soft)", background: "var(--bg-page)" }}
    >
      <div className="divide-y" style={{ borderColor: "var(--border-faint)" }}>
        {/* Time logged — always present */}
        <Row icon="⏱" label="Time logged">
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
            <span>
              This week{" "}
              <span className="font-semibold tabular" style={{ color: "var(--text)" }}>
                {formatBudgetMinutes(health.weekMinutes)}
              </span>
            </span>
            <span>
              Total{" "}
              <span className="font-semibold tabular" style={{ color: "var(--text)" }}>
                {formatBudgetMinutes(health.totalMinutes)}
              </span>
            </span>
          </div>
          {timeBudgetMinutes && timeBudgetMinutes > 0 ? (
            <div className="mt-2.5 space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                <span>
                  {(health.totalMinutes / 60).toFixed(1)} / {Math.round(timeBudgetMinutes / 60)}h used
                </span>
                <span className="tabular">{budgetPct ?? 0}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--bg-tint-strong)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, Math.max(2, budgetPct ?? 0))}%`,
                    background: (budgetPct ?? 0) > 100 ? "#ef4444" : "var(--accent)",
                  }}
                />
              </div>
            </div>
          ) : null}
        </Row>

        {/* Calendar coverage — only when blocks exist */}
        {health.calendarBlocksThisWeek > 0 ? (
          <Row icon="📅" label="Calendar coverage">
            <p className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
              <span className="font-semibold" style={{ color: "var(--text)" }}>
                {health.calendarBlocksThisWeek}
              </span>{" "}
              block{health.calendarBlocksThisWeek === 1 ? "" : "s"} scheduled this week
            </p>
          </Row>
        ) : null}

        {/* Linked habit streak — only when a habit's time feeds this project */}
        {health.linkedHabit ? (
          <Row icon="🔁" label="Linked habit streak">
            <Link
              href="/app/habits"
              className="inline-flex items-center gap-2 text-[0.8125rem] hover:underline"
              style={{ color: "var(--text-muted)" }}
            >
              <span className="font-medium" style={{ color: "var(--text)" }}>
                {health.linkedHabit.title}
              </span>
              <span>·</span>
              <span style={{ color: health.linkedHabit.streak > 0 ? "var(--accent-strong)" : "var(--text-faint)" }}>
                🔥 {health.linkedHabit.streak} day{health.linkedHabit.streak === 1 ? "" : "s"}
              </span>
            </Link>
          </Row>
        ) : null}

        {/* Last deep work — only when something has been logged */}
        {health.lastDeepWork ? (
          <Row icon="🕐" label="Last deep work">
            <p className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
              <span className="font-medium" style={{ color: "var(--text)" }}>
                {relativeDay(health.lastDeepWork.at, now)}
              </span>
              {health.lastDeepWork.minutes > 0 ? `, ${formatBudgetMinutes(health.lastDeepWork.minutes)}` : ""}
              <span style={{ color: "var(--text-faint)" }}> · {health.lastDeepWork.label}</span>
            </p>
          </Row>
        ) : null}
      </div>
    </section>
  );
}
