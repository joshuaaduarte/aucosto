import {
  getRunningEntry,
  listCompletedSince,
  listEntriesBetween,
} from "@/lib/services/time";
import { listAccounts } from "@/lib/services/finance";
import { listDoItems, listSuggestedDoItems } from "@/lib/services/do";
import { listHabits, listSuggestedHabits } from "@/lib/services/habits";
import { listCalendarItems } from "@/lib/services/calendar";
import { listRhythmSessionsBetween } from "@/lib/services/rhythms";
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
  habitGhostsForDay,
  formatDateValue,
  formatShortTime,
  formatTimeValue,
  startOfCalendarWeek,
  startOfDay,
} from "./_lib/derive";
import { buildDayTimeline, dayWindowHours } from "./_lib/timeline";
import { CalendarHeader } from "./_components/calendar-header";
import {
  CalendarTimeline,
  type CalendarColumn,
} from "./_components/day-timeline";
import { isCalendarView, type CalendarView } from "./_lib/views";
import type { TimelineBlockPayload } from "./_components/timeline-block";
import { derivePlanVsActual } from "@/lib/insights";
import { OpenTimeSection } from "./_components/open-time-section";
import { SignalsSection } from "./_components/signals-section";
import { TodayBucketSections } from "./_components/today-sections";
import { WeekOverview } from "./_components/week-overview";
import { CalendarQuickAddModal } from "./quick-add-modal";

export const dynamic = "force-dynamic";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; view?: string }>;
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
  const isTodaySelected = selectedDayStart.getTime() === todayStart.getTime();

  // View span: ?view=1d|2d|3d|5d|w. 1/2/3-day and week views run forward N days
  // from the anchor; 5d is special — it pins to Mon–Fri of the *selected day's*
  // calendar week rather than "5 days from today".
  const hasExplicitView = isCalendarView(params.view);
  const view: CalendarView = hasExplicitView
    ? (params.view as CalendarView)
    : "1d";
  const VIEW_DAYS: Record<CalendarView, number> = {
    "1d": 1,
    "2d": 2,
    "3d": 3,
    "5d": 5,
    w: 7,
  };
  const isWorkWeek = view === "5d";
  // 5d (Mon–Fri) and the full week (Mon–Sun) both pin to the selected day's
  // calendar week so the "ideal week" template always reads Monday-first;
  // 1/2/3-day views run forward from the anchor.
  const isWeekAligned = view === "5d" || view === "w";
  const viewDays = VIEW_DAYS[view];
  const columnStart = isWeekAligned
    ? startOfCalendarWeek(selectedDay)
    : selectedDayStart;
  const columnDays = Array.from({ length: viewDays }, (_, index) =>
    startOfDay(addDays(columnStart, index)),
  );

  // Widen the timeline data fetch to cover both the desktop columns (which for
  // 5d can start before the selected day) and the mobile pager's prev/current/
  // next window — padded one day each side so a committed swipe lands instantly
  // with no fetch gap.
  const firstNeeded =
    columnStart < selectedDayStart ? columnStart : selectedDayStart;
  const lastColumnDay = addDays(columnStart, viewDays - 1);
  const mobileLastDay = addDays(selectedDayStart, 1);
  const lastNeeded = lastColumnDay > mobileLastDay ? lastColumnDay : mobileLastDay;
  const panelRangeStart = startOfDay(addDays(firstNeeded, -1));
  const panelRangeEnd = endOfDay(lastNeeded);

  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const [weekItems, runningEntry, completedWeek, timelineItems, timelineEntries, timelineRhythms, trailingItems, trailingEntries, accounts, suggestedTasks, suggestedHabits, openTasks, allHabits] = await Promise.all([
    listCalendarItems(userId, { from: weekStart, to: weekEnd }),
    getRunningEntry(userId),
    listCompletedSince(userId, startOfWeek()),
    listCalendarItems(userId, { from: panelRangeStart, to: panelRangeEnd }),
    listEntriesBetween(userId, { from: panelRangeStart, to: panelRangeEnd }),
    listRhythmSessionsBetween(userId, { from: panelRangeStart, to: panelRangeEnd }),
    listCalendarItems(userId, { from: sevenDaysAgo, to: todayEnd }),
    listEntriesBetween(userId, { from: sevenDaysAgo, to: todayEnd }),
    context.financeVisible ? listAccounts(userId) : Promise.resolve([]),
    listSuggestedDoItems(userId, { limit: 5 }),
    listSuggestedHabits(userId, { limit: 4 }),
    listDoItems(userId, { includeDone: false }),
    listHabits(userId),
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
  const rhythmInputs = timelineRhythms.map((session) => ({
    id: session.id,
    type: session.type,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
  }));

  // Shared y-axis across columns: union each day's auto-expanded hour window so
  // every column lines up on the same axis.
  let unionStartHour = 24;
  let unionEndHour = 0;
  for (const day of columnDays) {
    const { startHour, endHour } = dayWindowHours({
      items: timelineItems,
      entries: timelineEntries,
      rhythms: rhythmInputs,
      day,
      now,
    });
    unionStartHour = Math.min(unionStartHour, startHour);
    unionEndHour = Math.max(unionEndHour, endHour);
  }
  const sharedBounds = { startHour: unionStartHour, endHour: unionEndHour };

  const columns: CalendarColumn[] = columnDays.map((day) => ({
    dayIso: formatDateValue(day),
    weekday: day.toLocaleDateString([], { weekday: "short" }),
    dayNum: day.getDate(),
    isToday: day.getTime() === todayStart.getTime(),
    isWeekend: day.getDay() === 0 || day.getDay() === 6,
    model: buildDayTimeline({
      items: timelineItems,
      entries: timelineEntries,
      rhythms: rhythmInputs,
      habits: habitGhostsForDay(allHabits, day),
      day,
      now,
      bounds: sharedBounds,
    }),
  }));

  // Mobile single-day pager: [prev, current, next] day panels, all sharing one
  // y-axis (union of their windows) so they line up against the fixed hour
  // axis. Pre-rendering the neighbours makes a swipe instant — the panel is
  // already on screen; only the post-settle re-hydration touches the server.
  const mobilePanelDays = [
    startOfDay(addDays(selectedDayStart, -1)),
    selectedDayStart,
    startOfDay(addDays(selectedDayStart, 1)),
  ];
  let mobileStartHour = 24;
  let mobileEndHour = 0;
  for (const day of mobilePanelDays) {
    const { startHour, endHour } = dayWindowHours({
      items: timelineItems,
      entries: timelineEntries,
      rhythms: rhythmInputs,
      day,
      now,
    });
    mobileStartHour = Math.min(mobileStartHour, startHour);
    mobileEndHour = Math.max(mobileEndHour, endHour);
  }
  const mobileBounds = { startHour: mobileStartHour, endHour: mobileEndHour };
  const mobilePanels: CalendarColumn[] = mobilePanelDays.map((day) => ({
    dayIso: formatDateValue(day),
    weekday: day.toLocaleDateString([], { weekday: "short" }),
    dayNum: day.getDate(),
    isToday: day.getTime() === todayStart.getTime(),
    isWeekend: day.getDay() === 0 || day.getDay() === 6,
    model: buildDayTimeline({
      items: timelineItems,
      entries: timelineEntries,
      rhythms: rhythmInputs,
      habits: habitGhostsForDay(allHabits, day),
      day,
      now,
      bounds: mobileBounds,
    }),
  }));

  // Tap payloads for timeline blocks: tracked entries open the entry edit
  // modal, the running entry hops to /app/time, planned blocks open a
  // compact block editor.
  const timelinePayloads: Record<string, TimelineBlockPayload> = {};
  for (const entry of timelineEntries) {
    timelinePayloads[entry.id] = entry.endedAt
      ? {
          type: "entry",
          entry: {
            id: entry.id,
            label: entry.label,
            category: entry.category,
            doItemId: entry.doItemId,
            notes: entry.notes,
            startedAtIso: entry.startedAt.toISOString(),
            endedAtIso: entry.endedAt.toISOString(),
          },
        }
      : { type: "running" };
  }
  for (const item of timelineItems) {
    timelinePayloads[item.id] = {
      type: "item",
      item: {
        id: item.id,
        title: item.title,
        dateValue: formatDateValue(item.startsAt),
        startValue: formatTimeValue(item.startsAt),
        endValue: formatTimeValue(item.endsAt),
        status: item.status,
      },
    };
  }
  const linkableTasks = openTasks.map((task) => ({
    id: task.id,
    title: task.title,
  }));

  // Last-7-days plan-vs-actual strip under the timeline.
  const planVsActual7d = derivePlanVsActual(trailingItems, trailingEntries, {
    from: sevenDaysAgo,
    to: todayEnd,
    now,
  });

  const firstColumn = columnStart;
  const lastColumn = lastColumnDay;
  const rangeLabel =
    viewDays === 1
      ? isTodaySelected
        ? "Today"
        : firstColumn.toLocaleDateString([], {
            weekday: "short",
            month: "short",
            day: "numeric",
          })
      : `${firstColumn.toLocaleDateString([], { month: "short", day: "numeric" })} – ${lastColumn.toLocaleDateString([], { month: "short", day: "numeric" })}`;

  // 5d steps a whole week at a time (Mon→Mon); every other view steps by its
  // own span. The step anchors off columnStart so 5d lands on Mondays.
  const navStep = isWorkWeek ? 7 : viewDays;
  const timelineNav = {
    prevHref: `/app/calendar?view=${view}&day=${formatDateValue(addDays(columnStart, -navStep))}`,
    nextHref: `/app/calendar?view=${view}&day=${formatDateValue(addDays(columnStart, navStep))}`,
    todayHref: `/app/calendar?view=${view}`,
    rangeLabel,
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

      <CalendarTimeline
        view={view}
        hasExplicitView={hasExplicitView}
        anchorDay={formatDateValue(selectedDayStart)}
        today={todayDateValue}
        columns={columns}
        mobilePanels={mobilePanels}
        payloads={timelinePayloads}
        tasks={linkableTasks}
        nav={timelineNav}
      />

      {planVsActual7d.overallPct !== null ? (
        <section
          className="flex items-center gap-3 rounded-md border px-4 py-2.5"
          style={{
            borderColor: "var(--border-faint)",
            background: "var(--bg-page)",
          }}
        >
          <p
            className="shrink-0 text-[0.6875rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Plan → tracked · 7d
          </p>
          <div
            className="h-[5px] min-w-0 flex-1 rounded-full"
            style={{ background: "var(--bg-tint-strong)" }}
          >
            <div
              className="h-[5px] rounded-full"
              style={{
                width: `${Math.min(100, planVsActual7d.overallPct)}%`,
                background: "#f43f5e",
              }}
            />
          </div>
          <p
            className="tabular shrink-0 text-[0.78rem] font-semibold"
            style={{ color: "var(--text)" }}
          >
            {planVsActual7d.overallPct}%
          </p>
        </section>
      ) : null}

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
