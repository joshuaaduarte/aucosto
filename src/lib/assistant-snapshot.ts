// Assistant-facing snapshot: a single read-only aggregation of "what is true
// right now" across every tool, assembled entirely from existing services.
// No DB access happens here — every field is derived from data the service
// layer already returns. This is a control panel, not a coach: no prose,
// no recommendations, just facts and binary flags.

import "server-only";

import { prisma } from "@/lib/prisma";
import { describeEventType } from "@/lib/event-types";
import { dayKey } from "@/lib/reflect";
import { startOfToday } from "@/lib/time";
import { sumDurations } from "@/lib/time-summary";
import { listCalendarItems } from "@/lib/services/calendar";
import { listDoItems } from "@/lib/services/do";
import { listRecentEvents } from "@/lib/services/events";
import { listHabits } from "@/lib/services/habits";
import { listAccounts } from "@/lib/services/finance";
import { ensureProjectBoardTables, listBoardProjects } from "@/lib/services/projects";
import {
  ensureProjectPlanningColumns,
  listProjectPlanSummaries,
} from "@/lib/services/project-planning";
import {
  ensureRolodexTables,
  getUpcomingBirthdays,
  getDueFollowUps,
  getRecentlyMentioned,
  listUnresolvedMentions,
  type BirthdaySummary,
  type FollowUpSummary,
  type RecentMentionSummary,
} from "@/lib/services/rolodex";
import { getReflection } from "@/lib/services/reflect";
import { getTodayWakeStatus } from "@/lib/services/rhythms";
import {
  getRunningEntry,
  listCompletedSince,
  listEntriesBetween,
} from "@/lib/services/time";
import {
  computeSignals,
  computeBriefing,
  resolveTimezone,
  type Signals,
  type Briefing,
} from "@/lib/assistant-signals";

export type AssistantSnapshot = {
  generatedAt: string;
  user: {
    timezone: string;
    displayName: string;
  };

  facts: {
    today: {
      date: string;
      localTime: string; // "HH:MM" 24h
      wokeUpAt: string | null; // "HH:MM" 24h

      calendar: {
        items: {
          title: string;
          startTime: string;
          endTime: string;
          durationMinutes: number;
          done: boolean;
          type: string;
        }[];
        totalScheduledMinutes: number;
        nextEvent: {
          title: string;
          startsAt: string;
          minutesUntil: number;
          durationMinutes: number;
        } | null;
      };

      time: {
        runningTimer: {
          title: string;
          category: string | null;
          startedAt: string;
          elapsedMinutes: number;
        } | null;
        entries: {
          title: string;
          category: string | null;
          durationMinutes: number;
          startedAt: string;
          endedAt: string;
        }[];
        totalTrackedMinutes: number;
      };

      tasks: {
        open: { title: string; lane: string; projectName: string | null }[];
        completedCount: number;
        openCount: number;
      };

      habits: {
        items: {
          name: string;
          done: boolean;
          streak: number;
          target: string;
          bucket: string;
          scheduledToday: boolean;
        }[];
        completedCount: number;
        totalCount: number;
      };

      projects: {
        name: string;
        momentum: "strong" | "slowing" | "stalled" | "none";
        lastWorkedDaysAgo: number | null;
        openTaskCount: number;
        nextAction: string | null;
        blockers: string[];
        missingNextAction: boolean;
      }[];

      recentEvents: { label: string; tool: string; at: string }[];
    };

    yesterday: {
      trackedMinutes: number;
      completedTasks: number;
      habitsCompleted: number;
      habitsTotal: number;
      reflection: { mood: number | null; note: string | null } | null;
    };

    week: {
      totalTrackedMinutes: number;
      avgDailyMinutes: number;
      habitConsistency: {
        name: string;
        doneCount: number;
        scheduledCount: number;
        pct: number;
      }[];
    };

    finance: {
      visible: boolean;
      summary: string | null;
    };

    rolodex: {
      upcomingBirthdays: BirthdaySummary[];
      dueFollowUps: FollowUpSummary[];
      recentlyMentioned: RecentMentionSummary[];
      unresolvedMentionCount: number;
    };
  };

  signals: Signals;
  briefing: Briefing;
};

function toHHMM(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

function calendarItemType(sourceTool: string | null): string {
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

  await Promise.all([
    ensureProjectBoardTables(),
    ensureProjectPlanningColumns().catch(() => {}),
    ensureRolodexTables().catch(() => {}),
  ]);

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
    userRecord,
    financeAccounts,
    projectPlanSummaries,
    upcomingBirthdays,
    dueFollowUps,
    recentlyMentioned,
    unresolvedMentions,
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
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, financeVisible: true },
    }),
    listAccounts(userId),
    listProjectPlanSummaries(userId).catch(() => []),
    getUpcomingBirthdays(userId).catch(() => []),
    getDueFollowUps(userId).catch(() => []),
    getRecentlyMentioned(userId).catch(() => []),
    listUnresolvedMentions(userId).catch(() => []),
  ]);

  const financeVisible = userRecord?.financeVisible ?? false;
  // User.timezone is null (unused per CLAUDE.md). Read from env — instrumentation.ts
  // sets process.env.TZ unconditionally from APP_TIMEZONE or "America/Los_Angeles"
  // before any request is handled. getHours()/getMinutes() below are correct because
  // of this pin.
  const userTimezone = resolveTimezone();
  const displayName = userRecord?.name ?? "Joshua";

  // ── today.calendar ──────────────────────────────────────────────────────
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
      }
    : null;

  // ── today.time ──────────────────────────────────────────────────────────
  const runningTimer = runningEntry
    ? {
        title: runningEntry.label,
        category: runningEntry.category,
        startedAt: runningEntry.startedAt.toISOString(),
        elapsedMinutes: minutesBetween(runningEntry.startedAt, now),
      }
    : null;

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
    Math.round(sumDurations(todayCompletedEntries) / 60000) + runningTodayMinutes;

  // ── today.tasks ─────────────────────────────────────────────────────────
  const openDoItems = allDoItems.filter((item) => item.status !== "done");
  const openTasks = openDoItems.map((item) => ({
    title: item.title,
    lane: item.lane,
    projectName: item.projectName,
  }));
  const completedTasksCount = allDoItems.filter(
    (item) => item.completedAt && dayKey(item.completedAt) === todayKey,
  ).length;

  // ── today.habits ─────────────────────────────────────────────────────────
  const habitsToday = allHabits.map((habit) => ({
    name: habit.title,
    done: habit.completedToday,
    streak: habit.currentStreak,
    target: habit.targetLabel,
    bucket: habit.bucket ?? "general",
    scheduledToday: habit.dueToday,
  }));
  const dueTodayHabits = allHabits.filter((habit) => habit.dueToday);
  const habitsCompleted = dueTodayHabits.filter((h) => h.completedToday).length;
  const habitsTotal = dueTodayHabits.length;

  // ── today.projects ───────────────────────────────────────────────────────
  const planByProjectId = new Map(
    projectPlanSummaries.map((p) => [p.projectId, p]),
  );
  const projects = boardProjects
    .filter((project) => project.status !== "done")
    .map((project) => {
      const plan = planByProjectId.get(project.id);
      return {
        name: project.name,
        momentum: (project.momentum
          ? project.momentum.level === "alive"
            ? "strong"
            : project.momentum.level
          : "none") as "strong" | "slowing" | "stalled" | "none",
        lastWorkedDaysAgo: daysAgo(project.lastWorkedAt, now),
        openTaskCount: project.openTaskCount,
        nextAction: plan?.nextAction ?? project.nextAction,
        blockers: plan?.blockers ?? [],
        missingNextAction: plan?.missingNextAction ?? false,
      };
    });

  // ── today.recentEvents ───────────────────────────────────────────────────
  const recentEventRows = recentEvents.map((event) => ({
    label: describeEventType(event.type),
    tool: event.tool,
    at: event.at.toISOString(),
  }));

  // ── yesterday ────────────────────────────────────────────────────────────
  const yesterdayTrackedMinutes = Math.round(sumDurations(yesterdayEntries) / 60000);
  const yesterdayCompletedTasks = allDoItems.filter(
    (item) => item.completedAt && dayKey(item.completedAt) === yesterdayKey,
  ).length;
  const yesterdayHabitDays = allHabits.map((habit) =>
    habit.recentDays.find((day) => day.dateKey === yesterdayKey),
  );
  const yesterdayHabitsTotal = yesterdayHabitDays.filter((day) => day?.due).length;
  const yesterdayHabitsCompleted = yesterdayHabitDays.filter(
    (day) => day?.due && day.completed,
  ).length;
  const yesterdayReflectionSummary = yesterdayReflection
    ? {
        mood: yesterdayReflection.mood,
        note: yesterdayReflection.wentWell ?? yesterdayReflection.freeNotes,
      }
    : null;

  // ── week ─────────────────────────────────────────────────────────────────
  const last7TrackedMinutes =
    Math.round(sumDurations(last7DaysEntries) / 60000) + runningTodayMinutes;
  const avgDailyMinutes = Math.round(last7TrackedMinutes / 7);
  const habitConsistency = allHabits.map((habit) => {
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

  // ── finance ──────────────────────────────────────────────────────────────
  let financeSummary: string | null = null;
  if (financeVisible) {
    const accountCount = financeAccounts.length;
    if (accountCount > 0) {
      const lastSync = financeAccounts.reduce(
        (latest, acc) =>
          acc.balanceUpdatedAt > latest ? acc.balanceUpdatedAt : latest,
        financeAccounts[0]!.balanceUpdatedAt,
      );
      const syncDaysAgo = daysAgo(lastSync, now) ?? 0;
      const syncLabel =
        syncDaysAgo === 0
          ? "synced today"
          : syncDaysAgo === 1
            ? "last sync 1 day ago"
            : `last sync ${syncDaysAgo} days ago`;
      financeSummary = `${accountCount} account${accountCount !== 1 ? "s" : ""} · ${syncLabel}`;
    }
  }

  // ── assemble facts ────────────────────────────────────────────────────────
  const facts = {
    today: {
      date: todayKey,
      localTime: toHHMM(now),
      wokeUpAt: wakeStatus.wakeTime,
      calendar: {
        items: calendarItems,
        totalScheduledMinutes,
        nextEvent,
      },
      time: {
        runningTimer,
        entries: timeEntries,
        totalTrackedMinutes,
      },
      tasks: {
        open: openTasks,
        completedCount: completedTasksCount,
        openCount: openTasks.length,
      },
      habits: {
        items: habitsToday,
        completedCount: habitsCompleted,
        totalCount: habitsTotal,
      },
      projects,
      recentEvents: recentEventRows,
    },
    yesterday: {
      trackedMinutes: yesterdayTrackedMinutes,
      completedTasks: yesterdayCompletedTasks,
      habitsCompleted: yesterdayHabitsCompleted,
      habitsTotal: yesterdayHabitsTotal,
      reflection: yesterdayReflectionSummary,
    },
    week: {
      totalTrackedMinutes: last7TrackedMinutes,
      avgDailyMinutes,
      habitConsistency,
    },
    finance: {
      visible: financeVisible,
      summary: financeSummary,
    },

    rolodex: {
      upcomingBirthdays,
      dueFollowUps,
      recentlyMentioned,
      unresolvedMentionCount: unresolvedMentions.length,
    },
  } satisfies AssistantSnapshot["facts"];

  // ── signals + briefing ────────────────────────────────────────────────────
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const localHour = now.getHours();
  const dayOfWeek = now.getDay(); // 0 = Sunday

  const signals = computeSignals(facts, nowMinutes);
  const briefing = computeBriefing(facts, signals, localHour, dayOfWeek);

  return {
    generatedAt: now.toISOString(),
    user: {
      timezone: userTimezone,
      displayName,
    },
    facts,
    signals,
    briefing,
  };
}
