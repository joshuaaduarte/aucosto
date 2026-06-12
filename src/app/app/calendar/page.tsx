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

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const userId = await resolveActiveUserId();
  const context = await requireViewerContext();
  const params = await searchParams;

  const weekStart = startOfCalendarWeek();
  const weekEnd = addDays(weekStart, 7);
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  // Timeline day navigation: ?day=YYYY-MM-DD (local), defaulting to today.
  const parsedDay = params.day ? new Date(`${params.day}T00:00:00`) : null;
  const selectedDay =
    parsedDay && !Number.isNaN(parsedDay.getTime()) ? parsedDay : now;
  const selectedDayStart = startOfDay(selectedDay);
  const selectedDayEnd = endOfDay(selectedDay);
  const isTodaySelected = selectedDayStart.getTime() === todayStart.getTime();

  const [weekItems, runningEntry, completedWeek, timelineItems, timelineEntries, accounts, suggestedTasks, suggestedHabits] = await Promise.all([
    listCalendarItems(userId, { from: weekStart, to: weekEnd }),
    getRunningEntry(userId),
    listCompletedSince(userId, startOfWeek()),
    listCalendarItems(userId, { from: selectedDayStart, to: selectedDayEnd }),
    listEntriesBetween(userId, { from: selectedDayStart, to: selectedDayEnd }),
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
    items: timelineItems,
    entries: timelineEntries,
    day: selectedDay,
    now,
  });
  const timelineNav = {
    dayLabel: isTodaySelected
      ? "Today"
      : selectedDayStart.toLocaleDateString([], {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
    prevHref: `/app/calendar?day=${formatDateValue(addDays(selectedDayStart, -1))}`,
    nextHref: `/app/calendar?day=${formatDateValue(addDays(selectedDayStart, 1))}`,
    todayHref: "/app/calendar",
    isToday: isTodaySelected,
  };

  return (
    <div className="space-y-8 pb-28 sm:space-y-10 sm:pb-8">
      <CalendarHeader
        totalTodayCount={todayItems.length}
        gapSuggestionCount={gapSuggestions.length}
        slippedCount={buckets.needsAttention.length}
        nextItem={nextItem}
      />

      <SignalsSection signals={signals} />

      <DayTimeline model={timeline} nav={timelineNav} />

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
