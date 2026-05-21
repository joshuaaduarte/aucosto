import { daysUntil, formatUSDFromCents } from "@/lib/money";
import type { CalendarItem, FinanceAccount, TimeEntry } from "@/generated/prisma/client";

export type CalendarSignal = {
  title: string;
  detail: string;
  tone: "sky" | "amber" | "emerald" | "zinc";
};

export function startOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

export function endOfDay(date: Date): Date {
  const value = startOfDay(date);
  value.setDate(value.getDate() + 1);
  return value;
}

export function startOfCalendarWeek(date: Date = new Date()): Date {
  const value = startOfDay(date);
  const day = value.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  value.setDate(value.getDate() + diff);
  return value;
}

export function addDays(date: Date, days: number): Date {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

export function buildWeekDays(anchor: Date = new Date()) {
  const start = startOfCalendarWeek(anchor);
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, index);
    return {
      key: date.toISOString(),
      date,
      label: date.toLocaleDateString([], { weekday: "short" }),
      monthDay: date.toLocaleDateString([], { month: "short", day: "numeric" }),
    };
  });
}

export function isSameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function formatCalendarTimeRange(item: Pick<CalendarItem, "startsAt" | "endsAt" | "allDay">): string {
  if (item.allDay) return "All day";
  const start = item.startsAt.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const end = item.endsAt.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${start}–${end}`;
}

export function deriveCalendarSignals(input: {
  todayItems: CalendarItem[];
  runningEntry: Pick<TimeEntry, "label" | "startedAt"> | null;
  weekTotalMs: number;
  accounts: FinanceAccount[];
}): CalendarSignal[] {
  const signals: CalendarSignal[] = [];
  const actionableCount = input.todayItems.filter((item) => item.kind !== "external").length;

  if (input.runningEntry) {
    signals.push({
      title: "Timer is already live",
      detail: `${input.runningEntry.label} is in motion. Protect the rest of that block.`,
      tone: "sky",
    });
  }

  if (actionableCount === 0) {
    signals.push({
      title: "No intentional blocks yet",
      detail: "Claim one block for the work that would make today feel real.",
      tone: "amber",
    });
  } else {
    signals.push({
      title: `${actionableCount} planned block${actionableCount === 1 ? "" : "s"} today`,
      detail: "Your calendar already has at least one intentional commitment in it.",
      tone: "emerald",
    });
  }

  const dueSoon = input.accounts
    .filter((account) => account.kind === "credit_card" && account.dueDate)
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())[0];
  if (dueSoon?.dueDate) {
    const days = daysUntil(dueSoon.dueDate);
    if (days >= 0 && days <= 7) {
      signals.push({
        title: `${dueSoon.name} due in ${days} day${days === 1 ? "" : "s"}`,
        detail: `Worth blocking 15 minutes to review ${formatUSDFromCents(Math.abs(dueSoon.statementBalanceCents ?? dueSoon.currentBalanceCents))}.`,
        tone: days <= 3 ? "amber" : "zinc",
      });
    }
  }

  if (input.weekTotalMs < 2 * 60 * 60 * 1000) {
    signals.push({
      title: "Week is still light on tracked work",
      detail: "A focused block on the calendar would make the rest of the week easier to defend.",
      tone: "zinc",
    });
  }

  return signals.slice(0, 4);
}
