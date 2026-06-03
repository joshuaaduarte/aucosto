import type { ReactNode } from "react";
import { formatHabitQuantity } from "@/lib/habits";
import { listHabits } from "@/lib/services/habits";
import { resolveActiveUserId } from "@/lib/viewer-context";
import { HabitCreateForm } from "./create-form";
import { HabitCard } from "./habit-card";

export const dynamic = "force-dynamic";

function SectionCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-md border p-5"
      style={{
        borderColor: "var(--border-soft)",
        background: "var(--bg-page)",
      }}
    >
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
        {eyebrow}
      </p>
      <h2 className="mt-1 text-[1rem] font-semibold tracking-tight" style={{ color: "var(--text)" }}>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="px-4 py-4" style={{ background: "var(--bg-page)" }}>
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
        {label}
      </p>
      <p className="mt-1 text-[1.5rem] font-semibold tracking-tight" style={{ color: "var(--text)", letterSpacing: "-0.025em" }}>
        {value}
      </p>
      <p className="mt-0.5 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
        {hint}
      </p>
    </div>
  );
}

function OverflowList({
  children,
  count,
  initialCount = 4,
}: {
  children: ReactNode[];
  count: number;
  initialCount?: number;
}) {
  const visible = children.slice(0, initialCount);
  const overflow = children.slice(initialCount);

  return (
    <div className="space-y-3">
      <ol className="space-y-3">{visible}</ol>
      {overflow.length > 0 ? (
        <details className="rounded-md border px-3 py-2.5" style={{ borderColor: "var(--border-faint)" }}>
          <summary className="cursor-pointer list-none text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
            Show {count - initialCount} more
          </summary>
          <ol className="mt-3 space-y-3">{overflow}</ol>
        </details>
      ) : null}
    </div>
  );
}

export default async function HabitsPage() {
  const userId = await resolveActiveUserId();
  const habits = await listHabits(userId, { includeArchived: true });

  const activeHabits = habits.filter((habit) => !habit.archivedAt);
  const archivedHabits = habits.filter((habit) => habit.archivedAt);
  const dueToday = activeHabits.filter((habit) => habit.dueToday && !habit.completedToday);
  const completedToday = activeHabits.filter((habit) => habit.completedToday);
  const keepWarm = activeHabits.filter((habit) => !dueToday.includes(habit) && !completedToday.includes(habit));
  const average30d = activeHabits.length
    ? Math.round(activeHabits.reduce((sum, habit) => sum + habit.completionRate30d, 0) / activeHabits.length)
    : 0;
  const bestStreak = activeHabits.reduce((best, habit) => Math.max(best, habit.currentStreak), 0);
  const minutesCommitted = activeHabits.reduce((sum, habit) => sum + (habit.defaultDurationMinutes ?? 0), 0);

  return (
    <div className="space-y-10">
      <header className="fade-in flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.75rem] font-medium uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
            Habits
          </p>
          <h1 className="mt-1 text-[1.5rem] font-bold tracking-tight sm:text-[1.875rem]" style={{ color: "var(--text)", letterSpacing: "-0.025em" }}>
            Habits
          </h1>
        </div>
        <p className="text-[0.8125rem] sm:max-w-[38rem] sm:text-right" style={{ color: "var(--text-muted)" }}>
          {activeHabits.length} active
          {dueToday.length > 0 ? ` · ${dueToday.length} still due today` : " · today is handled"}
          {bestStreak > 0 ? ` · best live streak ${bestStreak}` : ""}
        </p>
      </header>

      <section
        className="fade-in-delay-1 grid gap-px overflow-hidden rounded-md border sm:grid-cols-2 xl:grid-cols-4"
        style={{ borderColor: "var(--border-faint)", background: "var(--border-faint)" }}
      >
        <MetricCard label="Due today" value={String(dueToday.length)} hint="habits that still need a mark" />
        <MetricCard label="Completed" value={String(completedToday.length)} hint="already hit today" />
        <MetricCard label="30-day hit rate" value={`${average30d}%`} hint="average across active habits" />
        <MetricCard label="Time blocks" value={formatHabitQuantity(minutesCommitted, "minutes")} hint="default minutes tied to habits" />
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <SectionCard eyebrow="Today" title="What still matters today.">
          <ul className="space-y-2 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
            <li>
              {dueToday.length > 0
                ? `${dueToday.length} habit${dueToday.length === 1 ? "" : "s"} still need a mark today.`
                : "Everything due today is either done or intentionally off the board."}
            </li>
            <li>
              {completedToday.length > 0
                ? `${completedToday.length} habit${completedToday.length === 1 ? "" : "s"} already got done today.`
                : "No habits have been closed yet today."}
            </li>
          </ul>
        </SectionCard>

        <SectionCard eyebrow="Connections" title="How habits can feed the rest of the system.">
          <ul className="space-y-2 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
            <li>Due habits now surface inside Do List as recurring task work.</li>
            <li>Start a habit timer and you land straight in Time so the session is visible.</li>
            <li>Schedule a habit into Calendar or spin out a one-off task when it needs a deeper execution pass.</li>
          </ul>
        </SectionCard>
      </section>

      <HabitCreateForm />

      <section className="grid gap-6 lg:grid-cols-2">
        <SectionCard eyebrow="Due today" title="Keep these alive before the day slips.">
        {dueToday.length === 0 ? (
          <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
            Nothing urgent right now.
          </p>
        ) : (
          <OverflowList count={dueToday.length}>
            {dueToday.map((habit) => (
              <HabitCard key={habit.id} habit={habit} />
            ))}
          </OverflowList>
        )}
      </SectionCard>

        <SectionCard eyebrow="Keep warm" title="Not urgent, but still part of the rhythm.">
        {keepWarm.length === 0 ? (
          <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
            No extra habits sitting in the middle right now.
          </p>
        ) : (
          <OverflowList count={keepWarm.length}>
            {keepWarm.map((habit) => (
              <HabitCard key={habit.id} habit={habit} />
            ))}
          </OverflowList>
        )}
      </SectionCard>
      </section>

      <SectionCard eyebrow="Completed" title="Already landed today.">
        {completedToday.length === 0 ? (
          <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
            Nothing closed yet today.
          </p>
        ) : (
          <OverflowList count={completedToday.length}>
            {completedToday.map((habit) => (
              <HabitCard key={habit.id} habit={habit} />
            ))}
          </OverflowList>
        )}
      </SectionCard>

      {archivedHabits.length > 0 ? (
        <SectionCard eyebrow="Archived" title="Paused or retired habits.">
          <OverflowList count={archivedHabits.length}>
            {archivedHabits.map((habit) => (
              <HabitCard key={habit.id} habit={habit} />
            ))}
          </OverflowList>
        </SectionCard>
      ) : null}
    </div>
  );
}
