// Assistant-facing snapshot: a single read-only aggregation of "what is true
// right now" across every tool, assembled entirely from existing services.
// No DB access happens here — every field is derived from data the service
// layer already returns. This is a control panel, not a coach: no prose,
// no recommendations, just facts and binary flags.

import "server-only";

import { describeEventType } from "@/lib/event-types";
import { dayKey } from "@/lib/reflect";
import { startOfToday } from "@/lib/time";
import { sumDurations } from "@/lib/time-summary";
import { listCalendarItems } from "@/lib/services/calendar";
import { listDoItems } from "@/lib/services/do";
import { listRecentEvents } from "@/lib/services/events";
import { listHabits } from "@/lib/services/habits";
import { ensureProjectBoardTables, listBoardProjects } from "@/lib/services/projects";
import { getReflection } from "@/lib/services/reflect";
import { getTodayWakeStatus } from "@/lib/services/rhythms";
import {
  getRunningEntry,
  listCompletedSince,
  listEntriesBetween,
} from "@/lib/services/time";

export type AssistantSnapshot = {
  meta: {
    generatedAt: string;
    currentDate: string;
    currentTimeLocal: string;
    timezone: string;
    wakeTime: string | null;
  };

  now: {
    runningTimer: {
      title: string;
      category: string | null;
      startedAt: string;
      elapsedMinutes: number;
      linkedHabit: string | null;
      linkedTask: string | null;
    } | null;
    nextEvent: {
      title: string;
      startsAt: string;
      minutesUntil: number;
      durationMinutes: number;
      type: "block" | "habit" | "task";
    } | null;
  };

  today: {
    calendarItems: {
      title: string;
      startTime: string;
      endTime: string;
      durationMinutes: number;
      done: boolean;
      type: string;
    }[];
    totalScheduledMinutes: number;

    timeEntries: {
      title: string;
      category: string | null;
      startedAt: string;
      endedAt: string;
      durationMinutes: number;
    }[];
    totalTrackedMinutes: number;

    openTasks: {
      title: string;
      priority: string | null;
      projectName: string | null;
      overdue: boolean;
    }[];
    completedTasksCount: number;

    habits: {
      name: string;
      done: boolean;
      streak: number;
      target: string;
      bucket: string;
      scheduledToday: boolean;
    }[];
    habitsCompleted: number;
    habitsTotal: number;
  };

  active: {
    projects: {
      name: string;
      status: string;
      lastWorkedAt: string | null;
      lastWorkedDaysAgo: number | null;
      momentum: "strong" | "slowing" | "stalled" | "none";
      openTaskCount: number;
    }[];
  };

  recent: {
    yesterday: {
      trackedMinutes: number;
      completedTasks: number;
      habitsCompleted: number;
      habitsTotal: number;
      reflection: { mood: number | null; note: string | null } | null;
    };
    last7Days: {
      trackedMinutes: number;
      avgDailyMinutes: number;
      habitsConsistency: {
        name: string;
        doneCount: number;
        scheduledCount: number;
        pct: number;
      }[];
    };
    recentEvents: {
      label: string;
      tool: string;
      at: string;
    }[];
  };

  flags: {
    hasRunningTimer: boolean;
    crowdedDay: boolean;
    openDay: boolean;
    lateStart: boolean;
    driftRisk: boolean;
    momentumDay: boolean;
    unfinishedPriority: boolean;
    habitRecoveryNeeded: boolean;
    financeNeedsAttention: boolean;
  };
};

function toHHMM(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
}

function daysAgo(value: Date | null, now: Date): number | null {
  if (!value) return null;
  const startOfDay = (d: Date) => {
    const next = new Date(d);
    next.setHours(0, 0, 0, 0);
    return next;
  };
  return Math.round(
    (startOfDay(now).getTime() - startOfDay(value).getTime()) / 86_400_000,
  );
}

function calendarItemType(sourceTool: string | null): "block" | "habit" | "task" {
  if (sourceTool === "do") return "task";
  if (sourceTool === "habit") return "habit";
  return "block";
}

export async function buildAssistantSnapshot(
  userId: string,
): Promise<AssistantSnapshot> {
  const now = new Date();
  const todayStart = startOfToday();
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const todayKey = dayKey(now);
  const yesterdayKey = dayKey(yesterdayStart);

  await ensureProjectBoardTables();

  const [
    runningEntry,
    todayCalendarItems,
    todayCompletedEntries,
    yesterdayEntries,
    last7DaysEntries,
    allDoItems,
    allHabits,
    boardProjects,
    recentEvents,
    wakeStatus,
    yesterdayReflection,
  ] = await Promise.all([
    getRunningEntry(userId),
    listCalendarItems(userId, { from: todayStart, to: tomorrowStart }),
    listCompletedSince(userId, todayStart),
    listEntriesBetween(userId, { from: yesterdayStart, to: todayStart }),
    listEntriesBetween(userId, { from: sevenDaysAgo, to: now }),
    listDoItems(userId, { includeDone: true }),
    listHabits(userId),
    listBoardProjects(userId),
    listRecentEvents(userId, { limit: 10 }),
    getTodayWakeStatus(userId),
    getReflection(userId, yesterdayKey),
  ]);

  // ── now ──────────────────────────────────────────────────────────────
  const runningTimer = runningEntry
    ? {
        title: runningEntry.label,
        category: runningEntry.category,
        startedAt: runningEntry.startedAt.toISOString(),
        elapsedMinutes: minutesBetween(runningEntry.startedAt, now),
        linkedHabit: runningEntry.habit?.title ?? null,
        linkedTask: runningEntry.doItem?.title ?? null,
      }
    : null;

  const nextCalendarItem = todayCalendarItems
    .filter((item) => item.startsAt > now && item.status !== "done")
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0];
  const nextEvent = nextCalendarItem
    ? {
        title: nextCalendarItem.title,
        startsAt: nextCalendarItem.startsAt.toISOString(),
        minutesUntil: minutesBetween(now, nextCalendarItem.startsAt),
        durationMinutes: minutesBetween(
          nextCalendarItem.startsAt,
          nextCalendarItem.endsAt,
        ),
        type: calendarItemType(nextCalendarItem.sourceTool),
      }
    : null;

  // ── today ────────────────────────────────────────────────────────────
  const calendarItems = todayCalendarItems.map((item) => ({
    title: item.title,
    startTime: toHHMM(item.startsAt),
    endTime: toHHMM(item.endsAt),
    durationMinutes: minutesBetween(item.startsAt, item.endsAt),
    done: item.status === "done",
    type: calendarItemType(item.sourceTool),
  }));
  const totalScheduledMinutes = calendarItems.reduce(
    (sum, item) => sum + item.durationMinutes,
    0,
  );

  const timeEntries = todayCompletedEntries.map((entry) => ({
    title: entry.label,
    category: entry.category,
    startedAt: entry.startedAt.toISOString(),
    endedAt: entry.endedAt!.toISOString(),
    durationMinutes: minutesBetween(entry.startedAt, entry.endedAt!),
  }));
  const runningTodayMinutes =
    runningEntry && runningEntry.startedAt >= todayStart
      ? minutesBetween(runningEntry.startedAt, now)
      : 0;
  const totalTrackedMinutes =
    Math.round(sumDurations(todayCompletedEntries) / 60000) +
    runningTodayMinutes;

  const openDoItems = allDoItems.filter((item) => item.status !== "done");
  const openTasks = openDoItems.map((item) => ({
    title: item.title,
    priority: item.lane,
    projectName: item.projectName,
    // DoItem has no dueDate field in the schema — there is no real concept
    // of "overdue" to compute here.
    overdue: false,
  }));
  const completedTasksCount = allDoItems.filter(
    (item) => item.completedAt && dayKey(item.completedAt) === todayKey,
  ).length;

  const habitsToday = allHabits.map((habit) => ({
    name: habit.title,
    done: habit.completedToday,
    streak: habit.currentStreak,
    target: habit.targetLabel,
    bucket: habit.bucket ?? "general",
    scheduledToday: habit.dueToday,
  }));
  const dueTodayHabits = allHabits.filter((habit) => habit.dueToday);
  const habitsCompleted = dueTodayHabits.filter(
    (habit) => habit.completedToday,
  ).length;
  const habitsTotal = dueTodayHabits.length;

  // ── active projects ─────────────────────────────────────────────────
  const projects = boardProjects
    .filter((project) => project.status !== "done")
    .map((project) => ({
      name: project.name,
      status: project.status,
      lastWorkedAt: project.lastWorkedAt?.toISOString() ?? null,
      lastWorkedDaysAgo: daysAgo(project.lastWorkedAt, now),
      momentum: (project.momentum
        ? project.momentum.level === "alive"
          ? "strong"
          : project.momentum.level
        : "none") as "strong" | "slowing" | "stalled" | "none",
      openTaskCount: project.openTaskCount,
    }));

  // ── recent ───────────────────────────────────────────────────────────
  const yesterdayTrackedMinutes = Math.round(
    sumDurations(yesterdayEntries) / 60000,
  );
  const yesterdayCompletedTasks = allDoItems.filter(
    (item) => item.completedAt && dayKey(item.completedAt) === yesterdayKey,
  ).length;
  const yesterdayHabitDays = allHabits.map((habit) =>
    habit.recentDays.find((day) => day.dateKey === yesterdayKey),
  );
  const yesterdayHabitsTotal = yesterdayHabitDays.filter(
    (day) => day?.due,
  ).length;
  const yesterdayHabitsCompleted = yesterdayHabitDays.filter(
    (day) => day?.due && day.completed,
  ).length;
  const yesterdayReflectionSummary = yesterdayReflection
    ? {
        mood: yesterdayReflection.mood,
        note: yesterdayReflection.wentWell ?? yesterdayReflection.freeNotes,
      }
    : null;

  const last7TrackedMinutes =
    Math.round(sumDurations(last7DaysEntries) / 60000) + runningTodayMinutes;
  const avgDailyMinutes = Math.round(last7TrackedMinutes / 7);
  const habitsConsistency = allHabits.map((habit) => {
    const last7 = habit.recentDays.slice(-7);
    const scheduledCount = last7.filter((day) => day.due).length;
    const doneCount = last7.filter((day) => day.due && day.completed).length;
    return {
      name: habit.title,
      doneCount,
      scheduledCount,
      pct:
        scheduledCount > 0 ? Math.round((doneCount / scheduledCount) * 100) : 0,
    };
  });

  const recentEventRows = recentEvents.map((event) => ({
    label: describeEventType(event.type),
    tool: event.tool,
    at: event.at.toISOString(),
  }));

  // ── flags ────────────────────────────────────────────────────────────
  const hasRunningTimer = runningEntry !== null;
  const crowdedDay = calendarItems.length >= 5;
  const openDay = calendarItems.length <= 1;

  const todayEntryStarts = [
    ...todayCompletedEntries.map((entry) => entry.startedAt),
    ...(runningEntry && runningEntry.startedAt >= todayStart
      ? [runningEntry.startedAt]
      : []),
  ];
  const earliestStart =
    todayEntryStarts.length > 0
      ? todayEntryStarts.reduce((a, b) => (a < b ? a : b))
      : null;
  const tenAm = 10 * 60;
  const lateStart = earliestStart
    ? minutesSinceMidnight(earliestStart) > tenAm
    : minutesSinceMidnight(now) > tenAm;

  const todayEntryEnds = todayCompletedEntries
    .map((entry) => entry.endedAt)
    .filter((value): value is Date => value !== null);
  const lastEntryEndedAt =
    todayEntryEnds.length > 0
      ? todayEntryEnds.reduce((a, b) => (a > b ? a : b))
      : todayStart;
  const nowMinutes = minutesSinceMidnight(now);
  const inWorkWindow = nowMinutes >= 9 * 60 && nowMinutes <= 18 * 60;
  const driftRisk =
    inWorkWindow &&
    !hasRunningTimer &&
    minutesBetween(lastEntryEndedAt, now) > 90;

  const momentumDay = totalTrackedMinutes > 240;

  // DoItem has no priority/dueDate fields — "today" lane is the closest
  // existing signal for "needs attention now".
  const unfinishedPriority = openTasks.some((task) => task.priority === "today");

  const habitRecoveryNeeded = allHabits.some((habit) => {
    const lastThree = habit.recentDays.slice(-4, -1);
    const missed = lastThree.filter((day) => day.due && !day.keptAlive).length;
    return missed >= 2;
  });

  return {
    meta: {
      generatedAt: now.toISOString(),
      currentDate: todayKey,
      currentTimeLocal: toHHMM(now),
      timezone: process.env.TZ ?? "America/Los_Angeles",
      wakeTime: wakeStatus.wakeTime,
    },
    now: {
      runningTimer,
      nextEvent,
    },
    today: {
      calendarItems,
      totalScheduledMinutes,
      timeEntries,
      totalTrackedMinutes,
      openTasks,
      completedTasksCount,
      habits: habitsToday,
      habitsCompleted,
      habitsTotal,
    },
    active: {
      projects,
    },
    recent: {
      yesterday: {
        trackedMinutes: yesterdayTrackedMinutes,
        completedTasks: yesterdayCompletedTasks,
        habitsCompleted: yesterdayHabitsCompleted,
        habitsTotal: yesterdayHabitsTotal,
        reflection: yesterdayReflectionSummary,
      },
      last7Days: {
        trackedMinutes: last7TrackedMinutes,
        avgDailyMinutes,
        habitsConsistency,
      },
      recentEvents: recentEventRows,
    },
    flags: {
      hasRunningTimer,
      crowdedDay,
      openDay,
      lateStart,
      driftRisk,
      momentumDay,
      unfinishedPriority,
      habitRecoveryNeeded,
      financeNeedsAttention: false,
    },
  };
}
