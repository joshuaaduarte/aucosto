// Pure derive helpers for the hub page. These take already-fetched service
// data and compute the actions / focus / connections the page renders. No DB
// access lives here — page.tsx fetches and passes data in.

import type { CalendarItem, FinanceAccount } from "@/generated/prisma/client";
import type { DoItemSummary } from "@/lib/services/do";
import type { HabitSummary } from "@/lib/services/habits";
import type { ProjectSummary } from "@/lib/services/projects";
import type { RunningTimeEntry } from "@/lib/services/time";
import {
  capitalize,
  formatCents,
  formatHoursMs,
  formatMinutesLabel,
  formatShortWhen,
} from "./hub-format";
import type { FocusModule, ConnectionItem, TopAction } from "./hub-types";

export function deriveTopActions(input: {
  runningEntry: RunningTimeEntry | null;
  suggestedTasks: DoItemSummary[];
  suggestedHabits: HabitSummary[];
  upcomingCalendar: CalendarItem[];
  financeVisible: boolean;
  accounts: FinanceAccount[];
}): TopAction[] {
  const actions: TopAction[] = [];

  if (input.runningEntry) {
    actions.push({
      href: "/app/time",
      label: "Resume timer",
      detail: input.runningEntry.label ?? "active session",
    });
  } else {
    actions.push({
      href: "/app/time",
      label: "Start session",
      detail: input.suggestedTasks[0]?.title ?? "open a focused block",
    });
  }

  if (input.upcomingCalendar.length === 0) {
    actions.push({
      href: "/app/calendar",
      label: "Plan today",
      detail: "no block is protected yet",
    });
  } else {
    actions.push({
      href: "/app/calendar",
      label: "Check calendar",
      detail: formatShortWhen(input.upcomingCalendar[0]!.startsAt),
    });
  }

  if (input.suggestedHabits[0] && !input.suggestedHabits[0].completedToday) {
    actions.push({
      href: "/app/habits",
      label: "Log habit",
      detail: input.suggestedHabits[0].title,
    });
  } else if (input.financeVisible && input.accounts.some((account) => Boolean(account.dueDate))) {
    actions.push({
      href: "/app/finance",
      label: "Review finance",
      detail: "due dates and pace",
    });
  } else {
    actions.push({
      href: "/app/do",
      label: "Add task",
      detail: "capture the next move",
    });
  }

  return actions.slice(0, 3);
}

export function deriveFocusModule(input: {
  runningEntry: RunningTimeEntry | null;
  suggestedTasks: DoItemSummary[];
  suggestedHabits: HabitSummary[];
  projects: ProjectSummary[];
  upcomingCalendar: CalendarItem[];
  topActions: TopAction[];
}): FocusModule {
  const atRiskProject = input.projects.find(
    (project) =>
      project.status !== "done" &&
      project.healthFlags.some((flag) => flag.tone === "warning"),
  );

  if (input.runningEntry) {
    return {
      eyebrow: "What matters now",
      title: `Stay with ${input.runningEntry.label ?? "the live session"}`,
      body:
        input.runningEntry.doItem
          ? `This timer is tied to ${input.runningEntry.doItem.title}. Finish the loop cleanly instead of letting the session blur into the rest of the day.`
          : input.runningEntry.habit
            ? `This session is supporting ${input.runningEntry.habit.title}. When you stop, make sure the habit gets the credit for it.`
            : "A session is already in motion. The best dashboard move is usually to finish or reflect on that before starting something else.",
      primary: {
        href: "/app/time",
        label: "Review session",
        detail: "stop or continue with context",
      },
      secondary: input.runningEntry.doItem
        ? {
            href: "/app/do",
            label: "Open linked task",
            detail: input.runningEntry.doItem.title,
          }
        : undefined,
    };
  }

  if (atRiskProject) {
    return {
      eyebrow: "What matters today",
      title: atRiskProject.name,
      body:
        atRiskProject.healthFlags[0]?.message ??
        "This project needs a clearer next move before it quietly drifts.",
      primary: {
        href: "/app/projects",
        label: "Open project",
        detail: `${atRiskProject.openTaskCount} open tasks`,
      },
      secondary:
        atRiskProject.upcomingBlocks.length === 0
          ? {
              href: "/app/calendar",
              label: "Protect time",
              detail: "no block is scheduled yet",
            }
          : undefined,
    };
  }

  if (input.suggestedTasks[0]) {
    const nextTask = input.suggestedTasks[0];
    return {
      eyebrow: "What matters today",
      title: nextTask.title,
      body: nextTask.projectName
        ? `${nextTask.projectName} is already asking for movement here. Turn it into time or finish it while it is still clearly next.`
        : "This is the cleanest next task in the workspace right now. If it matters, give it protected time before something noisier wins.",
      primary: {
        href: "/app/do",
        label: "Open Do List",
        detail: formatMinutesLabel(nextTask.estimatedMinutes),
      },
      secondary: {
        href: "/app/calendar",
        label: "Plan a block",
        detail: "turn intent into time",
      },
    };
  }

  if (input.suggestedHabits[0]) {
    const habit = input.suggestedHabits[0];
    return {
      eyebrow: "What matters today",
      title: habit.title,
      body: habit.completedToday
        ? `Today is already handled here. Use the streak momentum to keep the rest of the day honest.`
        : habit.dueToday
          ? `${habit.targetLabel} is still due today. Log it or give it a real block before the day closes.`
          : "No urgent tasks are ahead of this, which makes it a good low-friction behavior to keep warm.",
      primary: {
        href: "/app/habits",
        label: "Open habits",
        detail: `${habit.currentStreak} streak`,
      },
      secondary: {
        href: "/app/calendar",
        label: "Plan a block",
        detail: "make room for it",
      },
    };
  }

  if (input.upcomingCalendar[0]) {
    return {
      eyebrow: "What matters today",
      title: input.upcomingCalendar[0].title,
      body: `The next scheduled block starts ${formatShortWhen(input.upcomingCalendar[0].startsAt)}. Use the space before it to line up the task, habit, or session that belongs there.`,
      primary: {
        href: "/app/calendar",
        label: "Open calendar",
        detail: formatShortWhen(input.upcomingCalendar[0].startsAt),
      },
      secondary: input.topActions[0],
    };
  }

  return {
    eyebrow: "What matters today",
    title: "Start with one protected move",
    body: "The dashboard is quiet right now, which is useful if you turn it into intention. Protect one block, capture one task, or start one focused session before the day fills itself in.",
    primary: input.topActions[0] ?? {
      href: "/app/calendar",
      label: "Plan today",
      detail: "make the first block real",
    },
    secondary: input.topActions[1],
  };
}

export function deriveConnections(input: {
  runningEntry: RunningTimeEntry | null;
  suggestedTasks: DoItemSummary[];
  suggestedHabits: HabitSummary[];
  projects: ProjectSummary[];
  upcomingCalendar: CalendarItem[];
}): ConnectionItem[] {
  const items: ConnectionItem[] = [];

  if (input.runningEntry?.doItem) {
    items.push({
      tone: "sky",
      title: "Timer is attached to a Do item",
      body: `${input.runningEntry.doItem.title} is already in execution. Keep the task and session in sync so the work lands cleanly.`,
      href: "/app/do",
      ctaLabel: "Open linked task",
    });
  }

  const dueHabit = input.suggestedHabits.find(
    (habit) => habit.dueToday && !habit.completedToday,
  );
  if (dueHabit) {
    items.push({
      tone: "amber",
      title: "A due habit still has no closure",
      body: `${dueHabit.title} is due today with a ${dueHabit.currentStreak}-day streak behind it. Log it or give it protected time.`,
      href: "/app/habits",
      ctaLabel: "Handle habit",
    });
  }

  const blockedProject = input.projects.find(
    (project) =>
      project.status !== "done" &&
      project.scheduledThisWeekMinutes === 0 &&
      project.openTaskCount > 0,
  );
  if (blockedProject) {
    items.push({
      tone: "amber",
      title: "A live project has no time protected",
      body: `${blockedProject.name} still has ${blockedProject.openTaskCount} open tasks, but nothing is on the calendar for it this week.`,
      href: "/app/projects",
      ctaLabel: "Open project",
    });
  }

  if (!input.runningEntry && input.upcomingCalendar.length === 0 && input.suggestedTasks[0]) {
    items.push({
      tone: "zinc",
      title: "The next task has no calendar home yet",
      body: `${input.suggestedTasks[0].title} looks like the next move, but no upcoming block is protecting it.`,
      href: "/app/calendar",
      ctaLabel: "Protect time",
    });
  }

  return items.slice(0, 4);
}

export function hourOfDayGreeting(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone,
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "12");
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

export function resolveViewerTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone || timeZone === "UTC") {
    return "America/Los_Angeles";
  }
  return timeZone;
}

export function composeSubline({
  runningEntry,
  weekTotalMs,
  financeVisible,
  financeLocked,
  thisMonthSpentCents,
}: {
  runningEntry: unknown;
  weekTotalMs: number;
  financeVisible: boolean;
  financeLocked: boolean;
  thisMonthSpentCents: number;
}): string {
  const bits: string[] = [];
  if (runningEntry) bits.push("a session is running");
  if (weekTotalMs > 0) bits.push(`${formatHoursMs(weekTotalMs)} logged this week`);
  if (financeVisible && !financeLocked && thisMonthSpentCents > 0)
    bits.push(`${formatCents(thisMonthSpentCents)} spent this month`);

  if (bits.length === 0) return "Quiet so far. Use the first move below to give the day a shape.";
  if (bits.length === 1) return capitalize(bits[0]!) + ".";
  return capitalize(bits.slice(0, -1).join(", ")) + ", and " + bits.at(-1) + ".";
}

export function sumSpend(transactions: { amount: number }[]): number {
  return transactions.reduce(
    (acc, t) => (t.amount < 0 ? acc + Math.abs(t.amount) : acc),
    0,
  );
}
