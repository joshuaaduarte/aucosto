import { resolveActiveUserId } from "@/lib/viewer-context";
import {
  getRunningEntry,
  listCompletedSince,
  listRecentEntries,
} from "@/lib/services/time";
import { getDoItemSummary, listSuggestedDoItems } from "@/lib/services/do";
import { listSuggestedHabits } from "@/lib/services/habits";
import {
  formatDuration,
  formatHM,
  startOfToday,
  startOfWeek,
} from "@/lib/time";
import { summarizeCategories, sumDurations } from "@/lib/time-summary";
import { EntryDeleteButton } from "./entry-row";
import { RunningCard } from "./running-card";
import { StartForm } from "./start-form";

export const dynamic = "force-dynamic";

function formatDayLabel(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (today.getTime() - target.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return target.toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export default async function TimePage() {
  const userId = await resolveActiveUserId();

  const todayStart = startOfToday();
  const weekStart = startOfWeek();
  const running = await getRunningEntry(userId);
  const [recent, completedToday, completedWeek, suggestedTasks, suggestedHabits, runningDoSummary] = await Promise.all([
    listRecentEntries(userId, { limit: 30 }),
    listCompletedSince(userId, todayStart),
    listCompletedSince(userId, weekStart),
    listSuggestedDoItems(userId, { limit: 4 }),
    listSuggestedHabits(userId, { limit: 4 }),
    running?.doItem ? getDoItemSummary(userId, running.doItem.id) : Promise.resolve(null),
  ]);

  const todayTotalMs = sumDurations(completedToday);
  const weekTotalMs = sumDurations(completedWeek);
  const topCategories = summarizeCategories(completedWeek, { limit: 4 });
  const suggestedCategories = topCategories
    .map((item) => item.category)
    .filter(
      (category) => category && category.toLowerCase() !== "uncategorized",
    );

  const groupedEntries = recent.reduce<
    Array<{ label: string; items: typeof recent }>
  >((groups, entry) => {
    const label = formatDayLabel(entry.startedAt);
    const existing = groups.find((group) => group.label === label);
    if (existing) {
      existing.items.push(entry);
      return groups;
    }
    groups.push({ label, items: [entry] });
    return groups;
  }, []);
  const hasArchive = recent.length > 0;

  return (
    <div className="space-y-10">
      <header className="fade-in flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p
            className="text-[0.75rem] font-medium uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Time
          </p>
          <h1
            className="mt-1 text-[1.5rem] font-bold tracking-tight sm:text-[1.875rem]"
            style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
          >
            Sessions
          </h1>
        </div>
        <p
          className="text-[0.8125rem] sm:max-w-[38rem] sm:text-right"
          style={{ color: "var(--text-muted)" }}
        >
          {running
            ? `1 running now · ${formatHM(weekTotalMs)} logged this week`
            : hasArchive
              ? `${completedToday.length} closed today · ${formatHM(weekTotalMs)} this week`
              : "No session running yet"}
        </p>
      </header>

      {/* Running session or start form */}
      <section className="fade-in-delay-1">
        {running ? (
          <RunningCard
            label={running.label}
            category={running.category}
            startedAtIso={running.startedAt.toISOString()}
            doItem={
              running.doItem
                ? {
                    id: running.doItem.id,
                    title: running.doItem.title,
                    estimatedMinutes:
                      runningDoSummary?.estimatedMinutes ?? running.doItem.estimatedMinutes,
                    trackedMinutes: runningDoSummary?.trackedMinutes ?? 0,
                  }
                : null
            }
            habit={
              running.habit
                ? {
                    id: running.habit.id,
                    title: running.habit.title,
                    targetLabel:
                      running.habit.goalUnit === "minutes"
                        ? `${running.habit.targetCount}m target`
                        : running.habit.goalUnit === "count"
                          ? `${running.habit.targetCount}x target`
                          : running.habit.targetCount === 1
                            ? "Complete once"
                            : `${running.habit.targetCount} checks`
                  }
                : null
            }
          />
        ) : (
          <StartForm
            suggestedCategories={suggestedCategories}
            suggestedTasks={suggestedTasks.map((task) => ({
              id: task.id,
              title: task.title,
              estimatedMinutes: task.estimatedMinutes,
            }))}
            suggestedHabits={suggestedHabits.map((habit) => ({
              id: habit.id,
              title: habit.title,
              targetLabel: habit.targetLabel,
            }))}
          />
        )}
      </section>

      {/* Quick stats */}
      <section className="fade-in-delay-2 grid grid-cols-2 gap-px overflow-hidden rounded-md"
               style={{ background: "var(--border-faint)", border: "1px solid var(--border-faint)" }}>
        <Stat label="Today" value={formatHM(todayTotalMs)} hint={completedToday.length === 1 ? "1 session closed" : `${completedToday.length} sessions closed`} />
        <Stat label="This week" value={formatHM(weekTotalMs)} hint="since Monday" />
      </section>

      {/* Category breakdown + recent entries side-by-side */}
      <section className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12">
        {/* Category breakdown */}
        <div className="fade-in-delay-3">
          <p
            className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Where the week went
          </p>

          {topCategories.length === 0 ? (
            <p
              className="text-[0.875rem]"
              style={{ color: "var(--text-muted)" }}
            >
              No sessions filed yet this week.
            </p>
          ) : (
            <ul className="space-y-3">
              {topCategories.map((item) => {
                const share =
                  weekTotalMs > 0
                    ? Math.max(4, Math.round((item.totalMs / weekTotalMs) * 100))
                    : 0;
                return (
                  <li key={item.category}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className="truncate text-[0.875rem] font-medium"
                        style={{ color: "var(--text)" }}
                      >
                        {item.category}
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
                        style={{
                          width: `${share}%`,
                          background: "var(--text)",
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Recent entries */}
        <div className="fade-in-delay-4">
          <p
            className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Recent sessions
          </p>

          {recent.length === 0 ? (
            <p
              className="text-[0.875rem]"
              style={{ color: "var(--text-muted)" }}
            >
              The archive is empty. Open a session above.
            </p>
          ) : (
            <div className="space-y-5">
              {groupedEntries.map((group) => (
                <div key={group.label}>
                  <h3
                    className="px-1 pb-1 text-[0.6875rem] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--text-faint)" }}
                  >
                    {group.label}
                  </h3>
                  <ul>
                    {group.items.map((entry) => {
                      const duration =
                        (entry.endedAt!.getTime() -
                          entry.startedAt.getTime()) |
                        0;
                      return (
                        <li
                          key={entry.id}
                          className="group grid grid-cols-[1fr_auto_24px] items-baseline gap-3 rounded-md px-2 py-2 transition-colors hover:bg-bg-hover"
                          style={{
                            borderTop: "1px solid var(--border-faint)",
                          }}
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-baseline gap-2">
                              <p
                                className="truncate text-[0.9375rem] font-medium"
                                style={{ color: "var(--text)" }}
                              >
                                {entry.label}
                              </p>
                              {entry.category && (
                                <span
                                  className="inline-flex items-center rounded px-1.5 py-0.5 text-[0.625rem] font-medium"
                                  style={{
                                    background: "var(--bg-tint)",
                                    color: "var(--text-muted)",
                                  }}
                                >
                                  {entry.category}
                                </span>
                              )}
                            </div>
                            <p
                              className="mt-0.5 text-[0.75rem]"
                              style={{ color: "var(--text-faint)" }}
                            >
                              {entry.startedAt.toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <span
                            className="text-[0.8125rem] tabular font-medium"
                            style={{ color: "var(--text)" }}
                          >
                            {formatDuration(duration)}
                          </span>
                          <EntryDeleteButton id={entry.id} />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
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
        className="mt-1 text-[1.5rem] font-semibold tracking-tight tabular"
        style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
      >
        {value}
      </p>
      <p
        className="mt-0.5 text-[0.75rem]"
        style={{ color: "var(--text-faint)" }}
      >
        {hint}
      </p>
    </div>
  );
}
