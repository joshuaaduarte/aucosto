import type { HabitDayPart } from "@/lib/habits";
import type { HabitSummary } from "@/lib/services/habits";

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function periodLabel(habit: HabitSummary) {
  return habit.cadence === "weekly" ? "this week" : "today";
}

export function progressValue(habit: HabitSummary) {
  return habit.cadence === "weekly" ? habit.progressThisWeek : habit.progressToday;
}

export function progressRatio(habit: HabitSummary) {
  return clampPercent((progressValue(habit) / Math.max(1, habit.targetCount)) * 100);
}

export function recentWindowSummary(habit: HabitSummary) {
  const dueDays = habit.recentDays.filter((day) => day.due);
  const hitDays = dueDays.filter((day) => day.completed);
  return {
    dueCount: dueDays.length,
    hitCount: hitDays.length,
    missCount: Math.max(0, dueDays.length - dueDays.filter((day) => day.keptAlive).length),
  };
}

export function detailTone(completed: boolean, due: boolean, keptAlive = false) {
  if (completed) {
    return {
      background: "var(--text)",
      color: "var(--bg-page)",
      borderColor: "var(--text)",
    };
  }

  if (keptAlive) {
    return {
      background: "var(--bg-tint)",
      color: "var(--text)",
      borderColor: "var(--text)",
    };
  }

  if (due) {
    return {
      background: "var(--accent-tint)",
      color: "var(--text)",
      borderColor: "var(--border-faint)",
    };
  }

  return {
    background: "var(--bg-tint)",
    color: "var(--text-faint)",
    borderColor: "var(--border-faint)",
  };
}

export function statusCopy(habit: HabitSummary, period: string) {
  if (habit.cadence === "weekly") {
    if (habit.completedThisWeek) return "Weekly anchor protected.";
    if (habit.fallbackLoggedToday) return "You kept the weekly habit alive today.";
    if (habit.recoveryLoggedToday) return "Recovery logged. Close the weekly target before Sunday.";
    return habit.rescuePrompt ?? "Close the weekly target before Sunday slips.";
  }
  if (habit.completedToday) return `Anchor protected for ${period}.`;
  if (habit.fallbackLoggedToday) return "Not fully closed, but you kept it alive.";
  if (habit.recoveryLoggedToday) return "Recovery logged. Protect the next step.";
  if (habit.needsSaveToday) return habit.rescuePrompt ?? "This one is slipping. Take the smallest good save now.";
  return "Keep the entry friction low and finish it fast.";
}

export function surfaceTone(habit: HabitSummary) {
  if (habit.needsSaveToday) {
    return {
      borderColor: "var(--accent-tint-strong)",
      background: "linear-gradient(180deg, var(--accent-tint), var(--bg-page) 28%)",
    };
  }

  if (habit.completedToday || habit.completedThisWeek) {
    return {
      borderColor: "var(--border-soft)",
      background: "linear-gradient(180deg, var(--bg-tint), var(--bg-page) 28%)",
    };
  }

  return {
    borderColor: "var(--border-faint)",
    background: "var(--bg-page)",
  };
}

export function topStatusLabel(habit: HabitSummary, period: string) {
  if (habit.cadence === "weekly" ? habit.completedThisWeek : habit.completedToday) return `complete ${period}`;
  if (habit.fallbackLoggedToday) return "saved today";
  if (habit.recoveryLoggedToday) return "recovery logged";
  if (habit.needsSaveToday) return "needs save";
  if (habit.dueToday) return "due now";
  return "in rhythm";
}

export function defaultScheduleStart(habit: HabitSummary) {
  if (habit.reminderTime) return habit.reminderTime;
  const dayPart = (habit.dayPart ?? "anytime") as HabitDayPart;
  if (dayPart === "morning") return "07:30";
  if (dayPart === "day") return "13:00";
  if (dayPart === "evening") return "19:00";
  return "09:00";
}
