import {
  getRunningEntry,
  listCompletedSince,
  listEntriesBetween,
} from "@/lib/services/time";
import { listAccounts } from "@/lib/services/finance";
import { listSuggestedDoItems } from "@/lib/services/do";
import { listSuggestedHabits } from "@/lib/services/habits";
import { listCalendarItems } from "@/lib/services/calendar";
import {
  resolveActiveUserId,
  requireViewerContext,
} from "@/lib/viewer-context";
import { startOfWeek } from "@/lib/time";
import { sumDurations } from "@/lib/time-summary";
import {
  addDays,
  buildWeekDays,
  deriveCalendarSignals,
  deriveGapSuggestions,
  deriveTodayBuckets,
  endOfDay,
  formatDateValue,
  formatShortTime,
  formatTimeValue,
  startOfCalendarWeek,
  startOfDay,
} from "./_lib/derive";
import { buildDayTimeline } from "./_lib/timeline";
import { CalendarHeader } from "./_components/calendar-header";
import { DayTimeline } from "./_components/day-timeline";
import { OpenTimeSection } from "./_components/open-time-section";
import { SignalsSection } from "./_components/signals-section";
import { TodayBucketSections } from "./_components/today-sections";
import { WeekOverview } from "./_components/week-overview";
import { CalendarQuickAddModal } from "./quick-add-modal";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const userId = await resolveActiveUserId();
  const context = await requireViewerContext();

  const weekStart = startOfCalendarWeek();
  const weekEnd = addDays(weekStart, 7);
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [weekItems, runningEntry, completedWeek, todayEntries, accounts, suggestedTasks, suggestedHabits] = await Promise.all([
    listCalendarItems(userId, { from: weekStart, to: weekEnd }),
    getRunningEntry(userId),
    listCompletedSince(userId, startOfWeek()),
    listEntriesBetween(userId, { from: todayStart, to: todayEnd }),
    context.financeVisible ? listAccounts(userId) : Promise.resolve([]),
    listSuggestedDoItems(userId, { limit: 5 }),
    listSuggestedHabits(userId, { limit: 4 }),
  ]);

  const todayItems = weekItems.filter(
    (item) => item.startsAt < todayEnd && item.endsAt > todayStart,
  );
  const weekDays = buildWeekDays();
  const signals = deriveCalendarSignals({
    todayItems,
    runningEntry,
    weekTotalMs: sumDurations(completedWeek),
    accounts,
  });
  const buckets = deriveTodayBuckets(todayItems, now);
  const todayDateValue = formatDateValue(now);
  const nextItem = buckets.now[0] ?? buckets.next[0] ?? null;
  const gapSuggestions = deriveGapSuggestions({
    now,
    todayItems,
    suggestedTasks,
    limit: 3,
  });
  const timeline = buildDayTimeline({
    items: todayItems,
    entries: todayEntries,
    day: now,
    now,
  });

  return (
    <div className="space-y-8 pb-28 sm:space-y-10 sm:pb-8">
      <CalendarHeader
        totalTodayCount={todayItems.length}
        gapSuggestionCount={gapSuggestions.length}
        slippedCount={buckets.needsAttention.length}
        nextItem={nextItem}
      />

      <SignalsSection signals={signals} />

      <DayTimeline model={timeline} />

      <OpenTimeSection gapSuggestions={gapSuggestions} />

      <TodayBucketSections buckets={buckets} />

      <WeekOverview weekDays={weekDays} weekItems={weekItems} />

      <CalendarQuickAddModal
        todayDateValue={todayDateValue}
        suggestedTasks={suggestedTasks.map((task) => ({
          id: task.id,
          title: task.title,
          estimatedMinutes: task.estimatedMinutes,
        }))}
        suggestedHabits={suggestedHabits.map((habit) => ({
          id: habit.id,
          title: habit.title,
          defaultDurationMinutes: habit.defaultDurationMinutes,
        }))}
        gapSuggestions={gapSuggestions.map((suggestion) => ({
          taskId: suggestion.taskId,
          title: suggestion.title,
          estimateMinutes: suggestion.estimateMinutes,
          gapLabel: `${formatShortTime(suggestion.gapStart)}-${formatShortTime(suggestion.gapEnd)}`,
          start: formatTimeValue(suggestion.gapStart),
          end: formatTimeValue(
            suggestion.estimateMinutes
              ? new Date(
                  suggestion.gapStart.getTime() +
                    suggestion.estimateMinutes * 60000,
                )
              : suggestion.gapEnd,
          ),
        }))}
      />
    </div>
  );
}
