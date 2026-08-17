export type RecurrenceFrequency = "daily" | "weekly" | "monthly";

export type RecurrenceRule = {
  frequency: RecurrenceFrequency;
  interval?: number;
  weekdays?: number[];
  until?: string | null;
};

export type RecurrenceOccurrence = {
  startsAt: Date;
  endsAt: Date;
  originalStart: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeRecurrenceRule(
  input: RecurrenceRule | null | undefined,
): RecurrenceRule | null {
  if (!input) return null;
  const interval = Number.isFinite(input.interval) && input.interval! > 0
    ? Math.floor(input.interval!)
    : 1;
  const weekdays = [...new Set((input.weekdays ?? []).filter((day) => day >= 0 && day <= 6))]
    .sort((a, b) => a - b);
  return {
    frequency: input.frequency,
    interval,
    weekdays: weekdays.length > 0 ? weekdays : undefined,
    until: input.until ?? null,
  };
}

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function sameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function addMonthsClamped(date: Date, months: number) {
  const value = new Date(date);
  const day = value.getDate();
  value.setDate(1);
  value.setMonth(value.getMonth() + months);
  const last = new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate();
  value.setDate(Math.min(day, last));
  return value;
}

function diffCalendarDays(a: Date, b: Date) {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY_MS);
}

function diffCalendarMonths(a: Date, b: Date) {
  return (a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth());
}

function occurrenceFromStart(start: Date, durationMs: number): RecurrenceOccurrence {
  return {
    startsAt: start,
    endsAt: new Date(start.getTime() + durationMs),
    originalStart: start,
  };
}

export function expandRecurrence(
  seriesStart: Date,
  seriesEnd: Date,
  ruleInput: RecurrenceRule,
  range: { from: Date; to: Date },
): RecurrenceOccurrence[] {
  const rule = normalizeRecurrenceRule(ruleInput);
  if (!rule) return [];

  const durationMs = seriesEnd.getTime() - seriesStart.getTime();
  if (durationMs <= 0) return [];
  const until = rule.until ? new Date(rule.until) : null;
  const hardEnd = until && !Number.isNaN(until.getTime()) && until < range.to ? until : range.to;
  if (hardEnd <= range.from) return [];

  const occurrences: RecurrenceOccurrence[] = [];
  const pushIfInRange = (start: Date) => {
    const end = new Date(start.getTime() + durationMs);
    if (start > hardEnd) return;
    if (end > range.from && start < range.to) {
      occurrences.push({ startsAt: start, endsAt: end, originalStart: new Date(start) });
    }
  };

  if (rule.frequency === "daily") {
    const firstOffset = Math.max(
      0,
      Math.floor(diffCalendarDays(range.from, seriesStart) / rule.interval!) * rule.interval!,
    );
    for (let offset = firstOffset; ; offset += rule.interval!) {
      const start = addDays(seriesStart, offset);
      if (start >= range.to || start > hardEnd) break;
      pushIfInRange(start);
    }
  } else if (rule.frequency === "weekly") {
    const weekdays = rule.weekdays?.length ? rule.weekdays : [seriesStart.getDay()];
    const cursor = startOfDay(range.from);
    cursor.setDate(cursor.getDate() - 7);
    const limit = new Date(range.to);
    limit.setDate(limit.getDate() + 7);
    for (let day = cursor; day < limit; day = addDays(day, 1)) {
      if (!weekdays.includes(day.getDay())) continue;
      const weeks = Math.floor(diffCalendarDays(day, startOfDay(seriesStart)) / 7);
      if (weeks < 0 || weeks % rule.interval! !== 0) continue;
      const start = new Date(day);
      start.setHours(
        seriesStart.getHours(),
        seriesStart.getMinutes(),
        seriesStart.getSeconds(),
        seriesStart.getMilliseconds(),
      );
      if (start < seriesStart && !sameDay(start, seriesStart)) continue;
      if (start >= range.to || start > hardEnd) continue;
      pushIfInRange(start);
    }
  } else if (rule.frequency === "monthly") {
    const firstOffset = Math.max(
      0,
      Math.floor(diffCalendarMonths(range.from, seriesStart) / rule.interval!) * rule.interval!,
    );
    for (let offset = firstOffset; ; offset += rule.interval!) {
      const start = addMonthsClamped(seriesStart, offset);
      if (start >= range.to || start > hardEnd) break;
      pushIfInRange(start);
    }
  }

  return occurrences.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export function recurrenceLabel(rule: RecurrenceRule | null | undefined) {
  const normalized = normalizeRecurrenceRule(rule);
  if (!normalized) return "Does not repeat";
  if (normalized.frequency === "daily") return "Daily";
  if (normalized.frequency === "monthly") return "Monthly";
  const weekdays = normalized.weekdays ?? [];
  if (weekdays.join(",") === "1,2,3,4,5") return "Weekdays";
  if (weekdays.length > 0) return "Custom weekly";
  return "Weekly";
}
