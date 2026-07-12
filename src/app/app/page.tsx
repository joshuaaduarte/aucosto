import { auth } from "@/auth";
import { startOfMonth, startOfPreviousMonth } from "@/lib/money";
import { listUpcomingCalendarItems } from "@/lib/services/calendar";
import { listDoItems, listSuggestedDoItems } from "@/lib/services/do";
import { listAccounts, listTransactions } from "@/lib/services/finance";
import { listHabits, listSuggestedHabits } from "@/lib/services/habits";
import { listProjects } from "@/lib/services/projects";
import {
  getActiveRhythm,
  getTodayWakeStatus,
  listRecentRhythms,
} from "@/lib/services/rhythms";
import { listReflections, listRecentMoods } from "@/lib/services/reflect";
import { getWhoopMorningPrefill } from "@/lib/services/whoop";
import { getCurrentPlace } from "@/lib/services/location";
import {
  buildDayFacts,
  deriveInsightOfTheDay,
} from "@/lib/insights";
import { getRunningEntry, listCompletedSince, listEntriesBetween } from "@/lib/services/time";
import { dayKey, reflectionStreak } from "@/lib/reflect";
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
import { RhythmHubCard } from "./_components/rhythm-hub-card";
import { SleepStatusCard } from "./_components/sleep-status-card";
import { ReflectionPromptCard } from "./_components/reflection-prompt-card";
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

  // Rhythm inputs: today's morning check-in, any running sleep session, and
  // recent sessions (to find the current night's sleep). Fetched separately to
  // keep the big tuple above intact. The morning card still gates its window in
  // the BROWSER (see RhythmHubCard); the always-on sleep card derives its state
  // here from the LA-pinned server clock — single-user, owner in LA.
  const [wakeStatus, activeSleep, recentRhythms, currentPlace] = userId
    ? await Promise.all([
        getTodayWakeStatus(userId),
        getActiveRhythm(userId, "sleep"),
        listRecentRhythms(userId, { limit: 40 }),
        getCurrentPlace(userId),
      ])
    : [null, null, [], null];

  // Whoop's auto-detected wake data — fetched (external API) only while
  // today's wake is still uncaptured, i.e. exactly while the morning prompt
  // is showing. Degrades to null when not connected / not configured.
  const whoopPrefill =
    userId && wakeStatus && !wakeStatus.captured
      ? await getWhoopMorningPrefill(userId)
      : null;

  const now = new Date();
  const todayStart = startOfToday();

  // Sleep is always surfaced (like the running-timer bar) — never gated behind
  // a time-of-day window. We track the current night's "sleep cycle": the
  // boundary sits at 18:00 local (server is pinned to LA), so from 6pm on the
  // active cycle is tonight, and before 6pm it's last night. A sleep session
  // started within the cycle is the one the card reflects.
  const nowHour = now.getHours();
  const sleepCycleStart = new Date(now);
  if (nowHour < 18) {
    sleepCycleStart.setDate(sleepCycleStart.getDate() - 1);
  }
  sleepCycleStart.setHours(18, 0, 0, 0);

  const cycleSleep =
    (activeSleep && activeSleep.startedAt >= sleepCycleStart
      ? activeSleep
      : null) ??
    recentRhythms.find(
      (session) =>
        session.type === "sleep" && session.startedAt >= sleepCycleStart,
    ) ??
    null;
  const sleepCardState: "running" | "logged" | "none" = cycleSleep
    ? cycleSleep.endedAt === null
      ? "running"
      : "logged"
    : "none";
  // No session yet: before 6pm the natural prompt is "log last night"; from
  // 6pm on it's "going to bed".
  const sleepCardMode: "bedtime" | "backfill" =
    nowHour >= 18 ? "bedtime" : "backfill";
  // The sleep card is currently rendering the backfill form (no session for the
  // cycle, before the evening bedtime window). It already prompts for a wake
  // time, so the morning check-in card must not show its own "what time did you
  // wake up?" prompt at the same time (they were duplicative at dawn).
  const sleepBackfillShowing =
    sleepCardState === "none" && sleepCardMode === "backfill";
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
  // Consecutive-day reflection streak from the 60-day window already fetched
  // for insights — pure derive, no extra query.
  const reflectStreak = reflectionStreak(
    recentReflections.map((reflection) => reflection.dateKey),
    dayKey(now),
  );

  // Yesterday's reflection nags persistently until it's done — a passed day
  // left unreflected is a gap to close, and the morning (before noon) is the
  // natural time to do it, so it's loudest then.
  const yesterday = new Date(todayStart);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = dayKey(yesterday);
  const reflectedYesterday = yesterdayKey in moodsByDay;
  const yesterdayLabel = yesterday.toLocaleDateString([], { weekday: "long" });
  const beforeNoon = now.getHours() < 12;

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
        placeLine={
          currentPlace
            ? `At ${currentPlace.place} since ${currentPlace.since.toLocaleTimeString(
                "en-US",
                { hour: "numeric", minute: "2-digit", timeZone: timezone },
              )}`
            : null
        }
      />

      {/* Hero first: the one recommendation. Stat tiles support it below. */}
      <FocusModuleCard focus={focus} />

      {userId ? (
        <>
          <SleepStatusCard
            state={sleepCardState}
            mode={sleepCardMode}
            startedAtMs={cycleSleep?.startedAt.getTime() ?? null}
            endedAtMs={cycleSleep?.endedAt?.getTime() ?? null}
            sleepMinutes={cycleSleep?.durationMinutes ?? null}
            sessionId={cycleSleep?.id ?? null}
          />
          <ReflectionPromptCard
            reflectedYesterday={reflectedYesterday}
            prominent={beforeNoon}
            yesterdayKey={yesterdayKey}
            yesterdayLabel={yesterdayLabel}
          />
          <RhythmHubCard
            morning={
              // Skip the "what time did you wake up?" prompt whenever a wake
              // time is already known — from a morning check-in OR a sleep
              // session that ended today. A real check-in carries its own
              // completed state; a sleep-derived wake shows the in-progress
              // flow (habits + "Done with morning") instead of re-prompting.
              wakeStatus?.morning
                ? {
                    started: true,
                    completed: wakeStatus.morning.completed,
                    wakeTime: wakeStatus.wakeTime,
                    sleepMinutes: wakeStatus.sleepMinutes,
                    // A real check-in has an editable wakeup session.
                    wakeSessionId: wakeStatus.morning.id,
                  }
                : wakeStatus?.captured
                  ? {
                      started: true,
                      completed: false,
                      wakeTime: wakeStatus.wakeTime,
                      sleepMinutes: wakeStatus.sleepMinutes,
                      // Sleep-derived wake — no wakeup row to edit.
                      wakeSessionId: null,
                    }
                  : null
            }
            morningHabits={allHabits
              .filter((habit) => habit.dayPart === "morning")
              .map((habit) => ({
                id: habit.id,
                title: habit.title,
                completedToday: habit.completedToday,
              }))}
            sleepBackfillShowing={sleepBackfillShowing}
            whoop={whoopPrefill}
          />
        </>
      ) : null}

      <InsightOfTheDayCard insight={insightOfTheDay} />

      <DailyDigestSection digest={digest} />

      <ProjectsProgressSection projects={projects} />

      <ReflectSection
        days={reflectDays}
        moodsByDay={moodsByDay}
        reflectedToday={reflectedToday}
        isEvening={isEvening}
        streak={reflectStreak}
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
