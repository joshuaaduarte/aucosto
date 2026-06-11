import { resolveActiveUserId } from "@/lib/viewer-context";
import {
  getRunningEntry,
  listEntriesBetween,
  listRecentEntries,
} from "@/lib/services/time";
import { getDoItemSummary, listSuggestedDoItems } from "@/lib/services/do";
import { listSuggestedHabits } from "@/lib/services/habits";
import { listCalendarItems } from "@/lib/services/calendar";
import { formatDuration, formatHM, startOfToday, startOfWeek } from "@/lib/time";
import {
  buildDailyStacks,
  clippedDurationMs,
  findUntrackedGap,
  recentLabelsForCategory,
  summarizeCategoriesWindow,
  trackedCoverage,
} from "@/lib/time-insights";
import { PRESET_TIME_CATEGORIES, categoryColor } from "@/lib/time-categories";
import { EntryDeleteButton } from "./entry-row";
import { AddEntryButton, EntryEditButton } from "./entry-editor";
import { GapBackfillCard } from "./gap-backfill-card";
import { InsightsSection } from "./insights-section";
import { QuickStartChips } from "./quick-start-chips";
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

function formatShortTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default async function TimePage() {
  const userId = await resolveActiveUserId();

  const now = new Date();
  const todayStart = startOfToday();
  const weekStart = startOfWeek();
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const running = await getRunningEntry(userId);
  const [recent, windowEntries, todayCalendarItems, suggestedTasks, suggestedHabits, runningDoSummary] =
    await Promise.all([
      listRecentEntries(userId, { limit: 30 }),
      listEntriesBetween(userId, { from: sevenDaysAgo, to: tomorrow }),
      listCalendarItems(userId, { from: todayStart, to: tomorrow }),
      listSuggestedDoItems(userId, { limit: 4 }),
      listSuggestedHabits(userId, { limit: 4 }),
      running?.doItem
        ? getDoItemSummary(userId, running.doItem.id)
        : Promise.resolve(null),
    ]);

  // Insights windows (live: running entry counts up to render time).
  const todayCategories = summarizeCategoriesWindow(windowEntries, {
    from: todayStart,
    to: tomorrow,
    now,
    limit: 8,
  });
  const weekCategories = summarizeCategoriesWindow(windowEntries, {
    from: weekStart,
    to: tomorrow,
    now,
    limit: 8,
  });
  const todayTotalMs = todayCategories.reduce((sum, c) => sum + c.totalMs, 0);
  const weekTotalMs = weekCategories.reduce((sum, c) => sum + c.totalMs, 0);
  const dailyStacks = buildDailyStacks(windowEntries, { days: 7, now });
  const coverage = trackedCoverage(
    windowEntries.filter(
      (entry) => clippedDurationMs(entry, todayStart, tomorrow, now) > 0,
    ),
    { now },
  );
  const closedTodayCount = windowEntries.filter(
    (entry) => entry.endedAt && entry.startedAt >= todayStart,
  ).length;

  // Quick-start chips: presets ordered by how much they were used this week.
  const weekUsage = new Map(
    weekCategories.map((item) => [item.category, item.totalMs]),
  );
  const quickStartCategories = [...PRESET_TIME_CATEGORIES]
    .sort(
      (a, b) => (weekUsage.get(b.id) ?? 0) - (weekUsage.get(a.id) ?? 0),
    )
    .map(({ id, label, color }) => ({ id, label, color }));

  // Custom categories (non-preset) used this week still prefill the form.
  const presetIds = new Set(PRESET_TIME_CATEGORIES.map((preset) => preset.id));
  const suggestedCategories = weekCategories
    .map((item) => item.category)
    .filter(
      (category) =>
        category !== "uncategorized" &&
        !presetIds.has(category) &&
        !["do", "habit", "calendar"].includes(category),
    );

  // Calendar suggestions: what's happening now, then what's next.
  const calendarSuggestions = todayCalendarItems
    .filter(
      (item) =>
        item.status !== "done" &&
        item.status !== "cancelled" &&
        !item.allDay &&
        item.endsAt > now,
    )
    .slice(0, 2)
    .map((item) => ({
      id: item.id,
      title: item.title,
      timeLabel: `${formatShortTime(item.startsAt)}–${formatShortTime(item.endsAt)}`,
      live: item.startsAt <= now,
    }));

  // Untracked gap since the last completed entry (only when idle).
  const lastEndedAt = windowEntries.reduce<Date | null>(
    (latest, entry) =>
      entry.endedAt && (!latest || entry.endedAt > latest)
        ? entry.endedAt
        : latest,
    null,
  );
  const gap = running
    ? null
    : findUntrackedGap({ lastEndedAt, now, minMinutes: 10 });

  // "What specifically?" suggestions: labels recently used in the running
  // entry's category (looks across the last 7 days and the recent archive).
  const runningRecentLabels = running
    ? recentLabelsForCategory([...windowEntries, ...recent], running.category, {
        limit: 5,
      }).filter((label) => label !== running.label)
    : [];

  const quickStart = (
    <QuickStartChips
      categories={quickStartCategories}
      calendarItems={calendarSuggestions}
      tasks={suggestedTasks.map((task) => ({
        id: task.id,
        title: task.title,
        estimatedMinutes: task.estimatedMinutes,
      }))}
      habits={suggestedHabits.map((habit) => ({
        id: habit.id,
        title: habit.title,
        targetLabel: habit.targetLabel,
      }))}
    />
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
              ? `${closedTodayCount} closed today · ${formatHM(weekTotalMs)} this week`
              : "No session running yet"}
        </p>
      </header>

      {/* Untracked gap backfill */}
      {gap ? (
        <section className="fade-in">
          <GapBackfillCard
            gapStartIso={gap.start.toISOString()}
            gapMinutes={gap.minutes}
            categories={quickStartCategories}
          />
        </section>
      ) : null}

      {/* Running session or start form */}
      <section className="fade-in-delay-1">
        {running ? (
          <RunningCard
            entryId={running.id}
            label={running.label}
            category={running.category}
            startedAtIso={running.startedAt.toISOString()}
            switchPanel={quickStart}
            recentLabels={runningRecentLabels}
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
                    goalUnit: running.habit.goalUnit,
                    suggestedQuantity:
                      running.habit.goalUnit === "minutes"
                        ? running.habit.targetCount
                        : 1,
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
            quickStart={quickStart}
          />
        )}
      </section>

      {/* Quick stats */}
      <section className="fade-in-delay-2 grid grid-cols-3 gap-px overflow-hidden rounded-md"
               style={{ background: "var(--border-faint)", border: "1px solid var(--border-faint)" }}>
        <Stat label="Today" value={formatHM(todayTotalMs)} hint={closedTodayCount === 1 ? "1 session closed" : `${closedTodayCount} sessions closed`} />
        <Stat label="This week" value={formatHM(weekTotalMs)} hint="since Monday" />
        <Stat
          label="Coverage"
          value={coverage.windowMs > 0 ? `${coverage.pct}%` : "—"}
          hint="of waking hours today"
        />
      </section>

      {/* Insights */}
      <section className="fade-in-delay-3">
        <InsightsSection
          todayCategories={todayCategories}
          weekCategories={weekCategories}
          todayTotalMs={todayTotalMs}
          weekTotalMs={weekTotalMs}
          dailyStacks={dailyStacks}
          coverage={coverage}
        />
      </section>

      {/* Recent entries */}
      <section className="fade-in-delay-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p
            className="text-[0.6875rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Recent sessions
          </p>
          <AddEntryButton />
        </div>

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
                        className="group grid grid-cols-[1fr_auto_24px_24px] items-baseline gap-3 rounded-md px-2 py-2 transition-colors hover:bg-bg-hover"
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
                                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.625rem] font-medium"
                                style={{
                                  background: "var(--bg-tint)",
                                  color: "var(--text-muted)",
                                }}
                              >
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{
                                    background: categoryColor(entry.category),
                                  }}
                                  aria-hidden
                                />
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
                        <EntryEditButton
                          entry={{
                            id: entry.id,
                            label: entry.label,
                            category: entry.category,
                            startedAtIso: entry.startedAt.toISOString(),
                            endedAtIso: entry.endedAt!.toISOString(),
                          }}
                        />
                        <EntryDeleteButton id={entry.id} />
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
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
