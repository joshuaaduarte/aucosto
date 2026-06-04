import type { ReactNode } from "react";
import { listHabits } from "@/lib/services/habits";
import { resolveActiveUserId } from "@/lib/viewer-context";
import { HabitCreateForm } from "./create-form";
import { HabitCard } from "./habit-card";

export const dynamic = "force-dynamic";

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatArchivedSummary(count: number) {
  return count === 1 ? "1 archived habit is waiting for cleanup." : `${count} archived habits are waiting for cleanup.`;
}

function SectionCard({
  eyebrow,
  title,
  children,
  tone = "default",
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  tone?: "default" | "accent";
}) {
  return (
    <section
      className="rounded-[1rem] border p-4 sm:p-5"
      style={{
        borderColor: tone === "accent" ? "var(--accent-tint-strong)" : "var(--border-soft)",
        background: tone === "accent" ? "linear-gradient(180deg, var(--accent-tint), var(--bg-page))" : "var(--bg-page)",
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

function MetricCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "accent";
}) {
  return (
    <div
      className="rounded-[0.9rem] border px-4 py-4"
      style={{
        background: tone === "accent" ? "linear-gradient(180deg, var(--accent-tint), var(--bg-page))" : "var(--bg-page)",
        borderColor: tone === "accent" ? "var(--accent-tint-strong)" : "var(--border-faint)",
      }}
    >
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
        {label}
      </p>
      <p className="mt-1 text-[1.35rem] font-semibold tracking-tight sm:text-[1.5rem]" style={{ color: "var(--text)", letterSpacing: "-0.025em" }}>
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
        <details className="rounded-[0.9rem] border px-3 py-2.5" style={{ borderColor: "var(--border-faint)" }}>
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
  const saveTheDay = activeHabits.filter((habit) => habit.needsSaveToday);
  const dueToday = activeHabits.filter((habit) => habit.dueToday && !habit.completedToday && !habit.needsSaveToday);
  const completedToday = activeHabits.filter((habit) => habit.completedToday);
  const keptAliveToday = activeHabits.filter((habit) => habit.keptAliveToday && !habit.completedToday);
  const keepWarm = activeHabits.filter(
    (habit) =>
      !saveTheDay.includes(habit) &&
      !dueToday.includes(habit) &&
      !completedToday.includes(habit) &&
      !keptAliveToday.includes(habit),
  );
  const average30d = activeHabits.length
    ? Math.round(activeHabits.reduce((sum, habit) => sum + habit.keptAliveRate30d, 0) / activeHabits.length)
    : 0;
  const bestStreak = activeHabits.reduce((best, habit) => Math.max(best, habit.keptAliveStreak), 0);
  const weeklyTargetsOpen = activeHabits.filter((habit) => habit.cadence === "weekly" && !habit.completedThisWeek).length;
  const strongestRecoveryHabit = [...saveTheDay, ...dueToday, ...keepWarm].find(
    (habit) => Boolean(habit.fallbackTitle || habit.rescuePrompt),
  );

  return (
    <div className="space-y-8 sm:space-y-10">
      <section
        className="fade-in overflow-hidden rounded-[1.25rem] border p-4 sm:p-6"
        style={{
          borderColor: "var(--border-soft)",
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--accent-tint) 65%, var(--bg-page) 35%), var(--bg-page) 58%)",
        }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[44rem]">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>
              Habits
            </p>
            <h1 className="mt-2 text-[1.65rem] font-bold tracking-tight sm:text-[2.2rem]" style={{ color: "var(--text)", letterSpacing: "-0.035em" }}>
              Keep the day from drifting.
            </h1>
            <p className="mt-2 max-w-[38rem] text-[0.875rem] leading-relaxed sm:text-[0.9375rem]" style={{ color: "var(--text-muted)" }}>
              Start with the habits that need saving, keep the next move obvious, and turn any slip into a smaller win instead of a full miss.
            </p>
          </div>

          <div className="grid max-w-[28rem] grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[27rem]">
            <MetricCard label="Active" value={String(activeHabits.length)} hint="live habits in rotation" />
            <MetricCard
              label="Save now"
              value={String(saveTheDay.length)}
              hint="most urgent recovery moves"
              tone={saveTheDay.length > 0 ? "accent" : "default"}
            />
            <MetricCard label="Anchors hit" value={String(completedToday.length)} hint="fully closed today" />
            <MetricCard label="Saved today" value={String(keptAliveToday.length)} hint="fallback or recovery wins" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="pill">{pluralize(saveTheDay.length, "habit")} in rescue mode</span>
          <span className="pill">{pluralize(weeklyTargetsOpen, "weekly target")} still open</span>
          <span className="pill">{bestStreak > 0 ? `best kept-alive streak ${bestStreak}` : "no kept-alive streak yet"}</span>
          <span className="pill">{average30d}% average save rate</span>
        </div>
      </section>

      <section className="fade-in-delay-1 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <SectionCard eyebrow="Right now" title="What needs attention first." tone={saveTheDay.length > 0 ? "accent" : "default"}>
          <ul className="space-y-2 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
            <li>
              {saveTheDay.length > 0
                ? `${pluralize(saveTheDay.length, "habit")} need a save right now.`
                : "Nothing is currently slipping badly enough to need rescue mode."}
            </li>
            <li>
              {weeklyTargetsOpen > 0
                ? `${pluralize(weeklyTargetsOpen, "weekly target")} still need to be closed.`
                : "No weekly carryover is hanging around."}
            </li>
            <li>{bestStreak > 0 ? `Best kept-alive streak right now is ${bestStreak}.` : "No kept-alive streak has started building yet."}</li>
          </ul>
        </SectionCard>

        <SectionCard eyebrow="Quick map" title="What each action means.">
          <ul className="space-y-2 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
            <li>Use `Done` or `Log` when the full version is still realistic.</li>
            <li>Use the fallback save when the day is slipping but the habit can still be kept alive.</li>
            <li>Use `Start timer` when the habit needs protected focus and should show up in Time.</li>
            <li>Use `Schedule` or `Add task` when the habit needs more space than a quick save.</li>
          </ul>
        </SectionCard>
      </section>

      {strongestRecoveryHabit ? (
        <section className="fade-in-delay-2 rounded-[1rem] border p-4 sm:p-5" style={{ borderColor: "var(--border-soft)", background: "var(--bg-page)" }}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-[42rem]">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                Recovery cue
              </p>
              <h2 className="mt-1 text-[1rem] font-semibold tracking-tight" style={{ color: "var(--text)" }}>
                {strongestRecoveryHabit.title}
              </h2>
              <p className="mt-1 text-[0.8125rem] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {strongestRecoveryHabit.rescuePrompt ??
                  strongestRecoveryHabit.fallbackTitle ??
                  "Take the smallest version that still counts and keep momentum alive."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:min-w-[14rem]">
              <MetricCard label="Anchor" value={`${strongestRecoveryHabit.currentStreak}`} hint="full-hit streak" />
              <MetricCard label="Saved" value={`${strongestRecoveryHabit.keptAliveStreak}`} hint="kept-alive streak" />
            </div>
          </div>
        </section>
      ) : null}

      <HabitCreateForm />

      <SectionCard eyebrow="Save the day" title="At-risk habits with a smallest-good-move attached." tone={saveTheDay.length > 0 ? "accent" : "default"}>
        {saveTheDay.length === 0 ? (
          <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
            Nothing is actively slipping right now.
          </p>
        ) : (
          <OverflowList count={saveTheDay.length}>
            {saveTheDay.map((habit) => (
              <HabitCard key={habit.id} habit={habit} />
            ))}
          </OverflowList>
        )}
      </SectionCard>

      <SectionCard eyebrow="Due today" title="Still open, but not in rescue mode yet.">
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

      <SectionCard eyebrow="Still active" title="Protected, saved, or not due right now.">
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

        {keptAliveToday.length > 0 ? (
          <details className="mt-4 rounded-[0.9rem] border" style={{ borderColor: "var(--border-faint)" }}>
            <summary className="cursor-pointer list-none px-3 py-2 text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
              {keptAliveToday.length} saved today
            </summary>
            <div className="px-3 pb-3">
              <OverflowList count={keptAliveToday.length} initialCount={3}>
                {keptAliveToday.map((habit) => (
                  <HabitCard key={habit.id} habit={habit} />
                ))}
              </OverflowList>
            </div>
          </details>
        ) : null}

        {completedToday.length > 0 ? (
          <details className="mt-4 rounded-[0.9rem] border" style={{ borderColor: "var(--border-faint)" }}>
            <summary className="cursor-pointer list-none px-3 py-2 text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
              {completedToday.length} completed today
            </summary>
            <div className="px-3 pb-3">
              <OverflowList count={completedToday.length} initialCount={3}>
                {completedToday.map((habit) => (
                  <HabitCard key={habit.id} habit={habit} />
                ))}
              </OverflowList>
            </div>
          </details>
        ) : null}
      </SectionCard>

      {archivedHabits.length > 0 ? (
        <SectionCard eyebrow="Cleanup" title={formatArchivedSummary(archivedHabits.length)} tone="accent">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
              Paused habits and test clutter land in your archive. Review them here when you want to restore something or clear it out for good.
            </p>
            <a
              href="#habit-archive"
              className="inline-flex h-9 items-center justify-center rounded-full border px-3 text-[0.75rem] font-medium"
              style={{
                borderColor: "var(--accent-tint-strong)",
                background: "var(--bg-page)",
                color: "var(--accent-strong)",
              }}
            >
              Review archive
            </a>
          </div>
        </SectionCard>
      ) : null}

      {archivedHabits.length > 0 ? (
        <section id="habit-archive">
          <SectionCard eyebrow="Archived" title="Archive and cleanup.">
          <p className="mb-4 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
            Restore anything you paused by mistake. Delete permanently when you want to clear out old tests or retired habits.
          </p>
          <OverflowList count={archivedHabits.length}>
            {archivedHabits.map((habit) => (
              <HabitCard key={habit.id} habit={habit} />
            ))}
          </OverflowList>
          </SectionCard>
        </section>
      ) : null}
    </div>
  );
}
