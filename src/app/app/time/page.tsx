import { Fragment, type ReactNode } from "react";
import { resolveActiveUserId } from "@/lib/viewer-context";
import {
  getRunningEntry,
  listEntriesBetween,
  listRecentEntries,
} from "@/lib/services/time";
import {
  getDoItemSummary,
  listDoItems,
  listSuggestedDoItems,
} from "@/lib/services/do";
import { listHabits } from "@/lib/services/habits";
import { listCalendarItems } from "@/lib/services/calendar";
import {
  listEntryProjectTags,
  listProjectPickerOptions,
} from "@/lib/services/projects";
import { listTimeCategories } from "@/lib/services/time-categories";
import { getTodayMorning, listSleepSessions } from "@/lib/services/rhythms";
import { formatDuration, formatHM, startOfToday, startOfWeek } from "@/lib/time";
import { formatRhythmDuration, rhythmDurationMinutes } from "@/lib/rhythms";
import {
  buildDailyStacks,
  clippedDurationMs,
  findDayGaps,
  findUntrackedGap,
  recentLabelsForCategory,
  summarizeCategoriesWindow,
  trackedCoverage,
} from "@/lib/time-insights";
import type { DayGap } from "@/lib/time-insights";
import { weeklyTrackedSparkline } from "@/lib/insights";
import { Sparkline } from "../insights/_components/charts";
import { categoryColor, normalizeCategory } from "@/lib/time-categories";
import { EntryDeleteButton, EntryNoteIndicator } from "./entry-row";
import { AddEntryButton, EntryEditButton } from "./entry-editor";
import { GapBackfillCard } from "./gap-backfill-card";
import { TagProjectButton } from "./tag-project-button";
import { GapSlotRow } from "./gap-slot";
import { InsightsSection } from "./insights-section";
import { ManageCategories } from "./manage-categories";
import { QuickStartChips } from "./quick-start-chips";
import { RunningCard } from "./running-card";
import { StartForm } from "./start-form";
import { PipLaunchButton } from "./pip-launch-button";
import { completedMsBetween, toPipHabits } from "../_components/pip-data";

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

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayKey(date: Date) {
  return startOfDay(date).toISOString();
}

/** "06:17" → "6:17 AM" (or null when unparseable). */
function formatClockString(hhmm: string | null) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (h === undefined || m === undefined || !Number.isFinite(h) || !Number.isFinite(m)) {
    return null;
  }
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return formatShortTime(d);
}

type SleepMarker = {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  durationMinutes: number | null;
  wakeTime: string | null;
};

/**
 * Read-only sleep bookend — a day-boundary callout, not a list row. The
 * wake-up card reads as a warm sunrise (amber), the bedtime card as a cool
 * night sky (indigo), so morning vs. night is obvious at a glance. No actions,
 * no hover: purely informational context between time entries.
 */
function SleepMarkerRow({
  variant,
  sleep,
}: {
  variant: "bed" | "wake";
  sleep: SleepMarker;
}) {
  // Per-variant palette: sunrise (wake) vs. night sky (bed).
  const theme =
    variant === "wake"
      ? {
          emoji: "🌅",
          background:
            "linear-gradient(to right, rgba(120,53,15,0.35), rgba(180,83,9,0.15))",
          border: "1px solid rgba(251,191,36,0.25)",
          primary: "#fde68a", // amber-200
          secondary: "#d97706", // amber-600
        }
      : {
          emoji: "🌙",
          background:
            "linear-gradient(to right, rgba(30,27,75,0.6), rgba(49,46,129,0.25))",
          border: "1px solid rgba(99,102,241,0.3)",
          primary: "#c7d2fe", // indigo-200
          secondary: "#818cf8", // indigo-400
        };

  const dot = (
    <span aria-hidden className="px-2" style={{ color: theme.secondary, opacity: 0.6 }}>
      ·
    </span>
  );

  let content: ReactNode;
  if (variant === "bed") {
    content = (
      <>
        <span className="font-medium" style={{ color: theme.primary }}>
          Went to sleep
        </span>
        {dot}
        <span className="text-[0.75rem]" style={{ color: theme.secondary }}>
          {formatShortTime(sleep.startedAt)}
        </span>
      </>
    );
  } else {
    const wakeLabel = sleep.endedAt
      ? formatShortTime(sleep.endedAt)
      : formatClockString(sleep.wakeTime);
    const minutes =
      sleep.durationMinutes && sleep.durationMinutes > 0
        ? sleep.durationMinutes
        : sleep.endedAt
          ? rhythmDurationMinutes(sleep.startedAt, sleep.endedAt)
          : null;
    const durLabel = minutes ? formatRhythmDuration(minutes) : null;
    content = durLabel ? (
      <>
        <span className="font-medium" style={{ color: theme.primary }}>
          Slept {durLabel}
        </span>
        {wakeLabel ? (
          <>
            {dot}
            <span className="text-[0.75rem]" style={{ color: theme.secondary }}>
              woke up {wakeLabel}
            </span>
          </>
        ) : null}
      </>
    ) : (
      <span className="font-medium" style={{ color: theme.primary }}>
        {wakeLabel ? `Woke up ${wakeLabel}` : "Woke up"}
      </span>
    );
  }

  return (
    <li className="list-none">
      <div
        className="my-2 flex items-center gap-3 rounded-xl px-4 py-3"
        style={{ background: theme.background, border: theme.border }}
      >
        <span aria-hidden className="shrink-0 text-xl leading-none">
          {theme.emoji}
        </span>
        <span className="text-[0.8125rem] leading-snug">{content}</span>
      </div>
    </li>
  );
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
  const eightWeeksAgo = new Date(todayStart);
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 8 * 7);

  const running = await getRunningEntry(userId);
  const [recent, windowEntries, todayCalendarItems, suggestedTasks, habitList, openTasks, runningDoSummary, todayMorning, allCategories] =
    await Promise.all([
      listRecentEntries(userId, { limit: 30 }),
      listEntriesBetween(userId, { from: sevenDaysAgo, to: tomorrow }),
      listCalendarItems(userId, { from: todayStart, to: tomorrow }),
      listSuggestedDoItems(userId, { limit: 4 }),
      listHabits(userId),
      listDoItems(userId, { includeDone: false }),
      running?.doItem
        ? getDoItemSummary(userId, running.doItem.id)
        : Promise.resolve(null),
      getTodayMorning(userId),
      listTimeCategories(userId, { includeHidden: true }),
    ]);
  const eightWeekEntries = await listEntriesBetween(userId, {
    from: eightWeeksAgo,
    to: tomorrow,
  });
  const weeklySpark = weeklyTrackedSparkline(eightWeekEntries, {
    weeks: 8,
    now,
  });

  // Project tags for the recent-entry chips + the "tag a project" picker. Both
  // degrade to empty if the projects board schema isn't in place yet.
  const [projectTagRows, projectOptions] = await Promise.all([
    listEntryProjectTags(userId, recent.map((entry) => entry.id)),
    listProjectPickerOptions(userId),
  ]);
  const projectTagByEntry = new Map(projectTagRows.map((tag) => [tag.entryId, tag]));

  // Sleep rhythm markers shown alongside entries. Fetch covers the same span
  // the archive does (oldest recent entry's day → tomorrow), so every day group
  // that can render gets its bedtime/wake-up bookends. Fetched up here because
  // the untracked-gap baseline below also reads it (a closed sleep session is a
  // wake-up signal — the gap must start there, not span the night).
  const sleepFrom = recent.length
    ? startOfDay(
        recent.reduce(
          (min, entry) => (entry.startedAt < min ? entry.startedAt : min),
          recent[0]!.startedAt,
        ),
      )
    : todayStart;
  const sleepSessions = await listSleepSessions(userId, {
    from: sleepFrom,
    to: tomorrow,
  });

  // Open tasks the entry editor can link entries to.
  const linkableTasks = openTasks.map((task) => ({
    id: task.id,
    title: task.title,
  }));

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

  // Visible categories (DB-managed) in the user's chosen order, plus a color
  // lookup so the entry list / recents resolve custom colors too — categoryColor
  // alone only knows presets and a stable hash for unknown strings.
  const visibleCategories = allCategories.filter((category) => !category.isHidden);
  const customColors = new Map(
    allCategories.map((category) => [normalizeCategory(category.name), category.color]),
  );
  const colorFor = (category: string | null | undefined) => {
    const norm = normalizeCategory(category);
    return (norm && customColors.get(norm)) || categoryColor(category);
  };
  const quickStartCategories = visibleCategories.map((category) => ({
    id: normalizeCategory(category.name),
    label: category.emoji ? `${category.emoji} ${category.name}` : category.name,
    color: category.color,
  }));

  // Ad-hoc categories used this week that aren't in the managed list still
  // prefill the free-form form's "Recent" row.
  const knownCategoryIds = new Set(
    allCategories.map((category) => normalizeCategory(category.name)),
  );
  const suggestedCategories = weekCategories
    .map((item) => item.category)
    .filter(
      (category) =>
        category !== "uncategorized" &&
        !knownCategoryIds.has(category) &&
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
  // "Since you woke up" baseline: anchor the untracked gap at this morning's
  // wake-up instead of the last entry's end, so the gap never spans the night.
  // Wake-up is known two ways — the morning check-in's reported time, or a
  // sleep session that's since been closed (auto-tracked wake). Take the later
  // of the two. The morning time is "HH:mm" from the browser; resolve it
  // against today in the (LA-pinned) server clock.
  const morningWakeAt = (() => {
    if (!todayMorning?.wakeTime) return null;
    const [h, m] = todayMorning.wakeTime.split(":").map(Number);
    if (h === undefined || m === undefined || !Number.isFinite(h) || !Number.isFinite(m)) return null;
    const at = new Date(now);
    at.setHours(h, m, 0, 0);
    return at.getTime() <= now.getTime() ? at : null;
  })();
  const sleepWakeAt = sleepSessions.reduce<Date | null>(
    (latest, sleep) =>
      sleep.endedAt && sleep.endedAt <= now && (!latest || sleep.endedAt > latest)
        ? sleep.endedAt
        : latest,
    null,
  );
  const wakeAnchor = [morningWakeAt, sleepWakeAt].reduce<Date | null>(
    (latest, candidate) =>
      candidate && (!latest || candidate > latest) ? candidate : latest,
    null,
  );
  const sinceWakeup =
    wakeAnchor !== null && (!lastEndedAt || lastEndedAt < wakeAnchor);
  const gap = running
    ? null
    : findUntrackedGap({
        lastEndedAt: sinceWakeup ? wakeAnchor : lastEndedAt,
        now,
        minMinutes: 10,
        maxHours: sinceWakeup ? 18 : 12,
      });

  // "What specifically?" suggestions: labels recently used in the running
  // entry's category (looks across the last 7 days and the recent archive).
  const runningRecentLabels = running
    ? recentLabelsForCategory([...windowEntries, ...recent], running.category, {
        limit: 5,
      }).filter((label) => label !== running.label)
    : [];

  // Today's habits (due today, not yet done/kept-alive) lead the surface.
  const dueHabits = habitList
    .filter(
      (habit) =>
        habit.dueToday && !habit.completedToday && !habit.keptAliveToday,
    )
    .slice(0, 6)
    .map((habit) => ({
      id: habit.id,
      title: habit.title,
      targetLabel: habit.targetLabel,
      color: colorFor(habit.bucket ?? "habit"),
    }));

  // Today's tasks: prefer the ones laned for today, fall back to suggestions.
  const todayLaneTasks = openTasks.filter(
    (task) => task.lane === "today" && task.status !== "waiting",
  );
  const taskChoices = (
    todayLaneTasks.length > 0 ? todayLaneTasks : suggestedTasks
  ).slice(0, 6);
  const quickStartTasks = taskChoices.map((task) => ({
    id: task.id,
    title: task.title,
    estimatedMinutes: task.estimatedMinutes,
    projectName: task.projectName,
    projectId: task.projectId,
  }));

  // Recent sessions: last 5 unique labels for true one-tap repeats.
  const recentSeen = new Set<string>();
  const recentChips: Array<{
    label: string;
    category: string | null;
    color: string;
  }> = [];
  for (const entry of recent) {
    const labelKey = entry.label.trim().toLowerCase();
    if (!labelKey || recentSeen.has(labelKey)) continue;
    recentSeen.add(labelKey);
    recentChips.push({
      label: entry.label,
      category: entry.category,
      color: colorFor(entry.category),
    });
    if (recentChips.length >= 5) break;
  }

  const quickStart = (
    <QuickStartChips
      categories={quickStartCategories}
      calendarItems={calendarSuggestions}
      tasks={quickStartTasks}
      habits={dueHabits}
      recents={recentChips}
      categoryManage={
        <ManageCategories
          categories={allCategories.map((category) => ({
            id: category.id,
            name: category.name,
            color: category.color,
            emoji: category.emoji,
            isHidden: category.isHidden,
          }))}
        />
      }
    />
  );

  // Build day groups merging time entries with sleep markers. A sleep session
  // contributes a bedtime marker to the day it started and a wake-up marker to
  // the day it ended (or today, if still open with a known wake time).
  const groupMap = new Map<
    string,
    {
      date: Date;
      label: string;
      wake: SleepMarker[];
      entries: typeof recent;
      bed: SleepMarker[];
    }
  >();
  const ensureGroup = (date: Date) => {
    const key = dayKey(date);
    let group = groupMap.get(key);
    if (!group) {
      const day = startOfDay(date);
      group = { date: day, label: formatDayLabel(day), wake: [], entries: [], bed: [] };
      groupMap.set(key, group);
    }
    return group;
  };
  for (const entry of recent) {
    ensureGroup(entry.startedAt).entries.push(entry);
  }
  for (const sleep of sleepSessions) {
    ensureGroup(sleep.startedAt).bed.push(sleep);
    // Only show a wake-up marker once there's a wake time to show.
    if (sleep.endedAt || sleep.wakeTime) {
      ensureGroup(sleep.endedAt ?? now).wake.push(sleep);
    }
  }
  const groupedDays = [...groupMap.values()].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );
  const hasArchive = recent.length > 0;

  // Inline gap slots: untracked stretches between (and before) a day's entries,
  // keyed by the entry each gap precedes so the list can drop a slot in right
  // below that row. Today gets a leading morning gap anchored at wake time (or
  // 6am); past days only get the between-entry gaps. The live "most recent gap"
  // card still owns the open stretch up to now, so we never reach past the last
  // entry here.
  const sixAmToday = new Date(todayStart);
  sixAmToday.setHours(6, 0, 0, 0);
  const gapsByEntryId = new Map<string, DayGap>();
  for (const group of groupedDays) {
    const isToday = group.date.getTime() === todayStart.getTime();
    const dayEnd = new Date(group.date);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const morningAnchor = isToday ? (wakeAnchor ?? sixAmToday) : null;
    for (const dayGap of findDayGaps(group.entries, {
      dayStart: group.date,
      dayEnd,
      morningAnchor,
      minMinutes: 5,
    })) {
      gapsByEntryId.set(dayGap.beforeEntryId, dayGap);
    }
  }

  // Floating Picture-in-Picture pop-out: the running entry, today's due habits,
  // and today's completed total. Reuses data already fetched above.
  const pipEntry = running
    ? {
        id: running.id,
        name: running.label,
        startedAtMs: running.startedAt.getTime(),
        habitId: running.habitId,
      }
    : null;
  const pipHabits = toPipHabits(habitList);
  const pipTotalMs = completedMsBetween(windowEntries, todayStart);

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
        <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
          <PipLaunchButton
            entry={pipEntry}
            habits={pipHabits}
            totalMsToday={pipTotalMs}
          />
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
        </div>
      </header>

      {/* Untracked gap backfill */}
      {gap ? (
        <section className="fade-in">
          <GapBackfillCard
            gapStartIso={gap.start.toISOString()}
            gapEndIso={gap.end.toISOString()}
            gapMinutes={gap.minutes}
            categories={quickStartCategories}
            sinceWakeup={sinceWakeup}
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
            notes={running.notes}
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

      {/* 8-week trend strip */}
      {weeklySpark.values.some((value) => value > 0) ? (
        <section
          className="fade-in-delay-2 flex items-center gap-4 rounded-md border px-4 py-3"
          style={{ borderColor: "var(--border-faint)", background: "var(--bg-page)" }}
        >
          <div className="min-w-0 flex-1">
            <p
              className="text-[0.6875rem] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              8-week trend
            </p>
            <Sparkline values={weeklySpark.values} color="#10b981" />
          </div>
          <p
            className="shrink-0 text-right text-[0.78rem] leading-snug"
            style={{ color: "var(--text-muted)" }}
          >
            {formatHM(weeklySpark.currentMs)} this week
            {weeklySpark.paceVsAveragePct !== null ? (
              <>
                <br />
                <span
                  className="font-semibold"
                  style={{
                    color:
                      weeklySpark.paceVsAveragePct >= 0
                        ? "#10b981"
                        : "var(--accent-strong)",
                  }}
                >
                  {weeklySpark.paceVsAveragePct >= 0 ? "+" : ""}
                  {weeklySpark.paceVsAveragePct}% pace
                </span>{" "}
                vs avg
              </>
            ) : null}
          </p>
        </section>
      ) : null}

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
          <AddEntryButton tasks={linkableTasks} />
        </div>

        {groupedDays.length === 0 ? (
          <p
            className="text-[0.875rem]"
            style={{ color: "var(--text-muted)" }}
          >
            The archive is empty. Open a session above.
          </p>
        ) : (
          <div className="space-y-5">
            {groupedDays.map((group) => (
              <div key={group.label}>
                <h3
                  className="px-1 pb-1 text-[0.6875rem] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-faint)" }}
                >
                  {group.label}
                </h3>
                <ul>
                  {/* Bedtime sits at the top: it's the latest event of this
                      day, and the list is newest-first. */}
                  {group.bed.map((sleep) => (
                    <SleepMarkerRow
                      key={`bed-${sleep.id}`}
                      variant="bed"
                      sleep={sleep}
                    />
                  ))}
                  {group.entries.map((entry) => {
                    const duration =
                      entry.endedAt!.getTime() - entry.startedAt.getTime();
                    const gap = gapsByEntryId.get(entry.id);
                    const isUncategorized =
                      !entry.category || !entry.category.trim();
                    const projectTag = projectTagByEntry.get(entry.id);
                    return (
                      <Fragment key={entry.id}>
                      <li
                        className="group grid grid-cols-[1fr_auto_auto_auto] items-baseline gap-2 rounded-md px-2 py-2 transition-colors hover:bg-bg-hover sm:gap-3"
                        style={{
                          borderTop: "1px solid var(--border-faint)",
                        }}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <p
                              className="min-w-0 truncate text-[0.9375rem] font-medium"
                              style={{ color: "var(--text)" }}
                            >
                              {entry.label}
                            </p>
                            {isUncategorized ? (
                              <span
                                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.625rem] font-medium"
                                style={{
                                  background: "var(--bg-tint)",
                                  color: "var(--text-faint)",
                                }}
                                title="No category yet — tap the pencil to set one"
                              >
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ background: categoryColor(null) }}
                                  aria-hidden
                                />
                                uncategorized
                              </span>
                            ) : (
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
                                    background: colorFor(entry.category),
                                  }}
                                  aria-hidden
                                />
                                {entry.category}
                              </span>
                            )}
                            {entry.doItem && (
                              <a
                                href="/app/do"
                                className="inline-flex max-w-[12rem] items-center gap-1 truncate rounded px-1.5 py-0.5 text-[0.625rem] font-medium"
                                style={{
                                  background: "var(--bg-tint)",
                                  color: "var(--text-muted)",
                                }}
                                title={`Linked task: ${entry.doItem.title}`}
                              >
                                ↗ {entry.doItem.title}
                              </a>
                            )}
                            {!entry.doItem && entry.habit && (
                              <a
                                href="/app/habits"
                                className="inline-flex max-w-[12rem] items-center gap-1 truncate rounded px-1.5 py-0.5 text-[0.625rem] font-medium"
                                style={{
                                  background: "var(--bg-tint)",
                                  color: "var(--text-muted)",
                                }}
                                title={`Linked habit: ${entry.habit.title}`}
                              >
                                ↗ {entry.habit.title}
                              </a>
                            )}
                            {projectTag ? (
                              <a
                                href={`/app/projects/${projectTag.projectId}`}
                                className="inline-flex max-w-[12rem] items-center gap-1 truncate rounded px-1.5 py-0.5 text-[0.625rem] font-medium"
                                style={{
                                  background: "var(--bg-tint)",
                                  color: "var(--text-muted)",
                                }}
                                title={`Project: ${projectTag.name}`}
                              >
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ background: projectTag.color }}
                                  aria-hidden
                                />
                                {projectTag.name}
                              </a>
                            ) : (
                              <TagProjectButton
                                entryId={entry.id}
                                options={projectOptions}
                              />
                            )}
                            {entry.notes ? (
                              <EntryNoteIndicator note={entry.notes} />
                            ) : null}
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
                            doItemId: entry.doItemId,
                            notes: entry.notes,
                            startedAtIso: entry.startedAt.toISOString(),
                            endedAtIso: entry.endedAt!.toISOString(),
                          }}
                          tasks={
                            entry.doItem &&
                            !linkableTasks.some((t) => t.id === entry.doItem!.id)
                              ? [
                                  { id: entry.doItem.id, title: entry.doItem.title },
                                  ...linkableTasks,
                                ]
                              : linkableTasks
                          }
                        />
                        <EntryDeleteButton id={entry.id} />
                      </li>
                      {/* Gap slot sits below the entry it precedes — the list
                          is newest-first, so "earlier in the day" is "lower". */}
                      {gap ? (
                        <GapSlotRow
                          gapStartIso={gap.start.toISOString()}
                          gapEndIso={gap.end.toISOString()}
                          gapMinutes={gap.minutes}
                          categories={quickStartCategories}
                        />
                      ) : null}
                      </Fragment>
                    );
                  })}
                  {/* Wake-up sits at the bottom: it's the earliest event of
                      this day. */}
                  {group.wake.map((sleep) => (
                    <SleepMarkerRow
                      key={`wake-${sleep.id}`}
                      variant="wake"
                      sleep={sleep}
                    />
                  ))}
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
