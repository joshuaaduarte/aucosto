import Link from "next/link";
import type { CalendarItem } from "@/generated/prisma/client";
import type { DoItemSummary } from "@/lib/services/do";
import type { HabitSummary } from "@/lib/services/habits";
import type { RunningTimeEntry } from "@/lib/services/time";
import { CardMenu } from "../card-menu";
import {
  formatCents,
  formatHoursMs,
  formatMinutesLabel,
  humanizeDoStatus,
} from "./hub-format";
import { ArrowRight, CalendarIcon, ClockIcon, ListIcon, RepeatIcon, WalletIcon } from "./icons";

export function QuickActionsSection({
  runningEntry,
  weekTotalMs,
  financeVisible,
  financeLocked,
  financeHasPin,
  thisMonthSpentCents,
  lastMonthSpentCents,
  upcomingCalendar,
  suggestedTasks,
  suggestedHabits,
}: {
  runningEntry: RunningTimeEntry | null;
  weekTotalMs: number;
  financeVisible: boolean;
  financeLocked: boolean;
  financeHasPin: boolean;
  thisMonthSpentCents: number;
  lastMonthSpentCents: number;
  upcomingCalendar: CalendarItem[];
  suggestedTasks: DoItemSummary[];
  suggestedHabits: HabitSummary[];
}) {
  return (
    <section className="fade-in-delay-1">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <p
          className="text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Quick actions
        </p>
        <p
          className="text-[0.75rem]"
          style={{ color: "var(--text-faint)" }}
        >
          Keep the common moves one tap away.
        </p>
      </div>
      <div
        className="grid grid-cols-1 gap-px sm:grid-cols-2"
        style={{
          background: "var(--border-faint)",
          borderRadius: "10px",
          overflow: "hidden",
          border: "1px solid var(--border-faint)",
        }}
      >
        <QuickCard
          href="/app/time"
          icon={<ClockIcon />}
          label="Time"
          value={runningEntry ? "Running" : formatHoursMs(weekTotalMs)}
          meta={
            runningEntry
              ? runningEntry.label ?? "Untitled session"
              : weekTotalMs > 0
                ? "tracked this week"
                : "nothing running right now"
          }
          running={Boolean(runningEntry)}
          actionLabel={runningEntry ? "Review session" : "Start session"}
          actionHref="/app/time"
        />
        {financeVisible ? (
          <QuickCard
            href="/app/finance"
            icon={<WalletIcon />}
            label="Finance"
            value={financeLocked ? "Locked" : formatCents(thisMonthSpentCents)}
            meta={
              financeLocked
                ? "tap to unlock"
                : lastMonthSpentCents > 0
                  ? `vs ${formatCents(lastMonthSpentCents)} last month`
                  : "spent this month"
            }
            actionLabel="Review finance"
            actionHref="/app/finance"
            menu={
              <CardMenu
                widgetId="finance"
                hasPin={financeHasPin}
                isLocked={financeLocked}
              />
            }
          />
        ) : (
          <QuickCard
            href="/app/calendar"
            icon={<CalendarIcon />}
            label="Calendar"
            value={upcomingCalendar[0] ? "Scheduled" : "Open"}
            meta={
              upcomingCalendar[0]
                ? upcomingCalendar[0].title
                : "no block is protected yet"
            }
            actionLabel="Add block"
            actionHref="/app/calendar"
          />
        )}
        <QuickCard
          href="/app/do"
          icon={<ListIcon />}
          label="Do List"
          value={suggestedTasks[0] ? suggestedTasks[0].title : "Quiet"}
          meta={
            suggestedTasks[0]
              ? `${formatMinutesLabel(suggestedTasks[0].estimatedMinutes)} · ${humanizeDoStatus(suggestedTasks[0].status)}`
              : "capture the next task worth doing"
          }
          actionLabel="Add task"
          actionHref="/app/do"
        />
        <QuickCard
          href="/app/habits"
          icon={<RepeatIcon />}
          label="Habits"
          value={
            suggestedHabits[0]
              ? suggestedHabits[0].completedToday
                ? "Handled"
                : suggestedHabits[0].dueToday
                  ? "Due today"
                  : "Keep warm"
              : "Quiet"
          }
          meta={
            suggestedHabits[0]
              ? `${suggestedHabits[0].title} · ${suggestedHabits[0].currentStreak} streak`
              : "add a repeatable behavior"
          }
          actionLabel="Log habit"
          actionHref="/app/habits"
        />
      </div>
    </section>
  );
}

function QuickCard({
  href,
  icon,
  label,
  value,
  meta,
  running,
  actionLabel,
  actionHref,
  menu,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  meta: string;
  running?: boolean;
  actionLabel: string;
  actionHref: string;
  menu?: React.ReactNode;
}) {
  return (
    <div className="group relative" style={{ background: "var(--bg-page)" }}>
      <Link href={href} className="block px-4 py-4 transition-colors hover:bg-bg-hover">
        <div className="flex items-center gap-2">
          <span style={{ color: "var(--text-faint)" }}>{icon}</span>
          <span
            className="text-[0.75rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            {label}
          </span>
          {running && (
            <span
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.625rem] font-medium uppercase tracking-wider"
              style={{
                background: "var(--accent-tint)",
                color: "var(--accent-strong)",
              }}
            >
              <span
                className="ink-pulse inline-block h-1 w-1 rounded-full"
                style={{ background: "var(--accent)" }}
              />
              Live
            </span>
          )}
        </div>
        <p
          className="mt-2 line-clamp-2 text-[1.45rem] font-semibold tracking-tight sm:text-[1.55rem]"
          style={{
            color: "var(--text)",
            letterSpacing: "-0.03em",
            fontFeatureSettings: '"tnum" 1',
          }}
        >
          {value}
        </p>
        <p
          className="mt-1 line-clamp-2 text-[0.83rem] leading-[1.45]"
          style={{ color: "var(--text-muted)" }}
        >
          {meta}
        </p>
      </Link>
      <div className="flex items-center justify-between px-4 pb-4 pt-1">
        <Link
          href={actionHref}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.75rem] font-medium transition-colors hover:bg-bg-hover"
          style={{ color: "var(--text)" }}
        >
          {actionLabel}
          <ArrowRight />
        </Link>
        {menu}
      </div>
    </div>
  );
}
