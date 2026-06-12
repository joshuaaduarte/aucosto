import { auth } from "@/auth";
import { startOfMonth, startOfPreviousMonth } from "@/lib/money";
import { listUpcomingCalendarItems } from "@/lib/services/calendar";
import { listDoItems, listSuggestedDoItems } from "@/lib/services/do";
import { listAccounts, listTransactions } from "@/lib/services/finance";
import { listHabits, listSuggestedHabits } from "@/lib/services/habits";
import { listProjects } from "@/lib/services/projects";
import { listActiveRhythms, listRecentRhythms } from "@/lib/services/rhythms";
import { suggestedRhythmForHour, type RhythmType } from "@/lib/rhythms";
import { listReflections, listRecentMoods } from "@/lib/services/reflect";
import {
  buildDayFacts,
  deriveInsightOfTheDay,
} from "@/lib/insights";
import { getRunningEntry, listCompletedSince, listEntriesBetween } from "@/lib/services/time";
import { dayKey } from "@/lib/reflect";
import { startOfToday, startOfWeek } from "@/lib/time";
import { sumDurations } from "@/lib/time-summary";
import { getViewerContext } from "@/lib/viewer-context";
import { ConnectionsSection } from "./_components/connections-section";
import { CrossToolCallout } from "./_components/cross-tool-callout";
import { DailyDigestSection } from "./_components/daily-digest-section";
import { DecisionPromptsSection } from "./_components/decision-prompts-section";
import { FocusModuleCard } from "./_components/focus-module-card";
import {
  composeSubline,
  deriveConnections,
  deriveFocusModule,
  deriveTopActions,
  hourOfDayGreeting,
  resolveViewerTimeZone,
  sumSpend,
} from "./_components/hub-derive";
import { HubHeader } from "./_components/hub-header";
import { RhythmNudge } from "./_components/rhythm-nudge";
import { SleepBackfillCard } from "./_components/sleep-backfill-card";
import { ProjectsProgressSection } from "./_components/projects-progress-section";
import { QuickActionsSection } from "./_components/quick-actions-section";
import { InsightOfTheDayCard } from "./_components/insight-of-the-day";
import { ReflectSection } from "./_components/reflect-section";
import { WorkspaceSection } from "./_components/workspace-section";
import { deriveDailyDigest } from "./_lib/daily-digest";
import { deriveHubPrompts } from "./_lib/hub-prompts";

export default async function HubPage() {
  const session = await auth();
  const context = await getViewerContext();
  const firstName = session?.user?.name?.split(" ")[0];
  const timezone = resolveViewerTimeZone(context?.timezone);

  const userId = context?.effectiveUserId;
  const financeVisible = context?.financeVisible ?? false;
  const financeHasPin = false;
  const financeLocked = false;

  const [
    runningEntry,
    weekEntries,
    accounts,
    thisMonthTx,
    lastMonthTx,
    suggestedTasks,
    suggestedHabits,
    allHabits,
    projects,
    upcomingCalendar,
    recentMoods,
    entries8w,
    recentReflections,
    allTasks,
  ] = userId
    ? await Promise.all([
        getRunningEntry(userId),
        listCompletedSince(userId, startOfWeek()),
        financeVisible && !financeLocked
          ? listAccounts(userId)
          : Promise.resolve([]),
        financeVisible && !financeLocked
          ? listTransactions(userId, { since: startOfMonth(), limit: 1000 })
          : Promise.resolve([]),
        financeVisible && !financeLocked
          ? listTransactions(userId, {
              since: startOfPreviousMonth(),
              limit: 1000,
            })
          : Promise.resolve([]),
        listSuggestedDoItems(userId, { limit: 3 }),
        listSuggestedHabits(userId, { limit: 3 }),
        listHabits(userId),
        listProjects(userId),
        listUpcomingCalendarItems(userId, { limit: 3 }),
        listRecentMoods(userId, { days: 7 }),
        listEntriesBetween(userId, {
          from: (() => {
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            start.setDate(start.getDate() - 8 * 7);
            return start;
          })(),
          to: new Date(),
        }),
        listReflections(userId, {
          sinceKey: (() => {
            const start = new Date();
            start.setDate(start.getDate() - 60);
            return start.toLocaleDateString("en-CA");
          })(),
          limit: 70,
        }),
        listDoItems(userId, { includeDone: true }),
      ])
    : [null, [], [], [], [], [], [], [], [], [], [], [], [], []];

  // Contextual rhythm nudge: which rhythm fits this hour, whether one is
  // already running, and (on a morning) whether last night's sleep went
  // unlogged. Fetched separately to keep the big tuple above intact.
  const activeRhythms = userId
    ? await listActiveRhythms(userId)
    : new Map<RhythmType, never>();
  const recentRhythms = userId
    ? await listRecentRhythms(userId, { limit: 40 })
    : [];

  const now = new Date();
  const todayStart = startOfToday();
  const localHour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone,
    }).format(now),
  );
  const suggestedRhythm = suggestedRhythmForHour(
    Number.isFinite(localHour) ? localHour % 24 : now.getHours(),
  );
  const activeRhythmType =
    activeRhythms.get(suggestedRhythm)?.type ??
    [...activeRhythms.keys()][0] ??
    null;

  // Missed-sleep detection: on a morning, look for any sleep session (active
  // or completed) started since ~6pm yesterday. None → prompt a backfill.
  const sleepWindowStart = new Date(now);
  sleepWindowStart.setDate(sleepWindowStart.getDate() - 1);
  sleepWindowStart.setHours(18, 0, 0, 0);
  const hasRecentSleep = recentRhythms.some(
    (session) =>
      session.type === "sleep" && session.startedAt >= sleepWindowStart,
  );
  const showSleepBackfill =
    Boolean(userId) && suggestedRhythm === "wakeup" && !hasRecentSleep;
  const monthStart = startOfMonth();
  const previousMonthStart = startOfPreviousMonth();
  const weekTotalMs = sumDurations(weekEntries);
  const thisMonthSpentCents = sumSpend(
    thisMonthTx.filter((t) => t.date >= monthStart),
  );
  const lastMonthSpentCents = sumSpend(
    lastMonthTx.filter(
      (t) => t.date >= previousMonthStart && t.date < monthStart,
    ),
  );

  const digest = deriveDailyDigest({
    now,
    completedTodayEntries: weekEntries.filter(
      (entry) => entry.startedAt >= todayStart,
    ),
    runningEntry: runningEntry ? { startedAt: runningEntry.startedAt } : null,
    habits: allHabits,
    finance:
      financeVisible && !financeLocked
        ? { monthTransactions: thisMonthTx.filter((t) => t.date >= monthStart) }
        : null,
  });

  const prompts = deriveHubPrompts({
    runningEntry,
    weekTotalMs,
    accounts: financeVisible && !financeLocked ? accounts : undefined,
    thisMonthSpentCents:
      financeVisible && !financeLocked ? thisMonthSpentCents : undefined,
    lastMonthSpentCents:
      financeVisible && !financeLocked ? lastMonthSpentCents : undefined,
  });

  const topActions = deriveTopActions({
    runningEntry,
    suggestedTasks,
    suggestedHabits,
    upcomingCalendar,
    financeVisible,
    accounts,
  });
  const focus = deriveFocusModule({
    runningEntry,
    suggestedTasks,
    suggestedHabits,
    projects,
    upcomingCalendar,
    topActions,
  });
  const connections = deriveConnections({
    runningEntry,
    suggestedTasks,
    suggestedHabits,
    projects,
    upcomingCalendar,
  });

  const todayLong = new Intl.DateTimeFormat([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: timezone,
  }).format(now);

  const greeting = hourOfDayGreeting(timezone);

  // Reflection strip: last 7 day keys (oldest → today), mood lookup, and
  // the evening-nudge state.
  const reflectDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(todayStart);
    day.setDate(day.getDate() - (6 - index));
    return dayKey(day);
  });
  const moodsByDay = Object.fromEntries(
    recentMoods.map((row) => [row.dateKey, row.mood]),
  );
  const reflectedToday = dayKey(now) in moodsByDay;
  const isEvening = now.getHours() >= 18;

  // Insight of the day: rotates through whichever findings have enough data.
  const sixtyDaysAgo = new Date(todayStart);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 59);
  const insightOfTheDay = deriveInsightOfTheDay({
    now,
    entries8w,
    tasks: allTasks.map((task) => ({
      completedAt: task.completedAt,
      estimatedMinutes: task.estimatedMinutes,
      actualMinutes: task.effectiveActualMinutes,
      bucket: task.bucket,
    })),
    days: buildDayFacts({
      entries: entries8w,
      reflections: recentReflections,
      from: sixtyDaysAgo,
      to: now,
      now,
    }),
  });

  const subline = composeSubline({
    runningEntry,
    weekTotalMs,
    financeVisible,
    financeLocked,
    thisMonthSpentCents,
  });

  return (
    <div className="space-y-7 sm:space-y-8">
      <HubHeader
        todayLong={todayLong}
        greeting={greeting}
        firstName={firstName}
        subline={subline}
        actions={topActions}
      />

      {/* Hero first: the one recommendation. Stat tiles support it below. */}
      <FocusModuleCard focus={focus} />

      {showSleepBackfill ? (
        <SleepBackfillCard
          fallback={
            <RhythmNudge
              suggestedType={suggestedRhythm}
              activeType={activeRhythmType}
            />
          }
        />
      ) : (
        <RhythmNudge
          suggestedType={suggestedRhythm}
          activeType={activeRhythmType}
        />
      )}

      <InsightOfTheDayCard insight={insightOfTheDay} />

      <DailyDigestSection digest={digest} />

      <ProjectsProgressSection projects={projects} />

      <ReflectSection
        days={reflectDays}
        moodsByDay={moodsByDay}
        reflectedToday={reflectedToday}
        isEvening={isEvening}
      />

      <CrossToolCallout
        runningEntry={runningEntry}
        weekTotalMs={weekTotalMs}
        financeVisible={financeVisible && !financeLocked}
        thisMonthSpentCents={thisMonthSpentCents}
      />

      <QuickActionsSection
        runningEntry={runningEntry}
        weekTotalMs={weekTotalMs}
        financeVisible={financeVisible}
        financeLocked={financeLocked}
        financeHasPin={financeHasPin}
        thisMonthSpentCents={thisMonthSpentCents}
        lastMonthSpentCents={lastMonthSpentCents}
        upcomingCalendar={upcomingCalendar}
        suggestedTasks={suggestedTasks}
        suggestedHabits={suggestedHabits}
      />

      <DecisionPromptsSection prompts={prompts} />

      <ConnectionsSection connections={connections} />

      <WorkspaceSection financeVisible={financeVisible} />
    </div>
  );
}
