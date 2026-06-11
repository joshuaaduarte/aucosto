// Pure derive helpers for time-tracker insights: windowed category summaries,
// daily stacked totals, waking-hours coverage, and untracked-gap detection.
// No DB access — tested in tests/time-insights.test.ts.

import type { TimeEntry } from "@/generated/prisma/client";
import { categoryColor, categoryLabel, normalizeCategory } from "./time-categories";

export type EntryLike = Pick<TimeEntry, "startedAt" | "endedAt" | "category">;

/** Milliseconds of an entry that fall inside [from, to). Running entries count up to `now`. */
export function clippedDurationMs(
  entry: EntryLike,
  from: Date,
  to: Date,
  now: Date,
): number {
  const end = entry.endedAt ?? now;
  const start = Math.max(entry.startedAt.getTime(), from.getTime());
  const finish = Math.min(end.getTime(), to.getTime());
  return Math.max(0, finish - start);
}

export type CategoryWindowSummary = {
  category: string;
  label: string;
  color: string;
  totalMs: number;
};

export function summarizeCategoriesWindow(
  entries: EntryLike[],
  options: { from: Date; to: Date; now: Date; limit?: number },
): CategoryWindowSummary[] {
  const totals = new Map<string, { raw: string | null; totalMs: number }>();
  for (const entry of entries) {
    const ms = clippedDurationMs(entry, options.from, options.to, options.now);
    if (ms <= 0) continue;
    const key = normalizeCategory(entry.category) || "uncategorized";
    const existing = totals.get(key);
    if (existing) {
      existing.totalMs += ms;
    } else {
      totals.set(key, { raw: entry.category, totalMs: ms });
    }
  }
  return Array.from(totals.entries())
    .map(([key, value]) => ({
      category: key,
      label: key === "uncategorized" ? "Uncategorized" : categoryLabel(value.raw),
      color: key === "uncategorized" ? categoryColor(null) : categoryColor(value.raw),
      totalMs: value.totalMs,
    }))
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, options.limit ?? 12);
}

export type DayStackSegment = {
  category: string;
  color: string;
  ms: number;
};

export type DayStack = {
  dayStart: Date;
  label: string;
  isToday: boolean;
  totalMs: number;
  segments: DayStackSegment[];
};

/** Per-day stacked category totals for the `days` days ending today. */
export function buildDailyStacks(
  entries: EntryLike[],
  options: { days?: number; now: Date },
): DayStack[] {
  const days = options.days ?? 7;
  const todayStart = new Date(options.now);
  todayStart.setHours(0, 0, 0, 0);

  return Array.from({ length: days }, (_, index) => {
    const dayStart = new Date(todayStart);
    dayStart.setDate(dayStart.getDate() - (days - 1 - index));
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const totals = new Map<string, { raw: string | null; ms: number }>();
    for (const entry of entries) {
      const ms = clippedDurationMs(entry, dayStart, dayEnd, options.now);
      if (ms <= 0) continue;
      const key = normalizeCategory(entry.category) || "uncategorized";
      const existing = totals.get(key);
      if (existing) {
        existing.ms += ms;
      } else {
        totals.set(key, { raw: entry.category, ms });
      }
    }

    const segments = Array.from(totals.entries())
      .map(([key, value]) => ({
        category: key,
        color: key === "uncategorized" ? categoryColor(null) : categoryColor(value.raw),
        ms: value.ms,
      }))
      .sort((a, b) => b.ms - a.ms);

    return {
      dayStart,
      label: dayStart.toLocaleDateString([], { weekday: "narrow" }),
      isToday: index === days - 1,
      totalMs: segments.reduce((sum, segment) => sum + segment.ms, 0),
      segments,
    };
  });
}

export type TrackedCoverage = {
  trackedMs: number;
  windowMs: number;
  pct: number;
};

/**
 * Share of today's waking hours covered by tracked entries.
 * Waking window defaults to 06:00–23:00; before 06:00 the window is empty.
 */
export function trackedCoverage(
  entries: EntryLike[],
  options: { now: Date; wakeHour?: number; sleepHour?: number },
): TrackedCoverage {
  const wakeHour = options.wakeHour ?? 6;
  const sleepHour = options.sleepHour ?? 23;
  const wake = new Date(options.now);
  wake.setHours(wakeHour, 0, 0, 0);
  const sleep = new Date(options.now);
  sleep.setHours(sleepHour, 0, 0, 0);
  const windowEnd = new Date(
    Math.min(options.now.getTime(), sleep.getTime()),
  );
  const windowMs = Math.max(0, windowEnd.getTime() - wake.getTime());
  if (windowMs === 0) {
    return { trackedMs: 0, windowMs: 0, pct: 0 };
  }
  const trackedMs = entries.reduce(
    (sum, entry) => sum + clippedDurationMs(entry, wake, windowEnd, options.now),
    0,
  );
  const pct = Math.min(100, Math.round((trackedMs / windowMs) * 100));
  return { trackedMs, windowMs, pct };
}

export type LabeledEntry = Pick<TimeEntry, "startedAt" | "category" | "label">;

/**
 * Recent distinct labels used within a category, most recent first —
 * powers "what specifically?" suggestions after a one-tap category start.
 * Labels that just repeat the category name are skipped.
 */
export function recentLabelsForCategory(
  entries: LabeledEntry[],
  category: string | null | undefined,
  options: { limit?: number } = {},
): string[] {
  const key = normalizeCategory(category);
  if (!key) return [];
  const limit = options.limit ?? 4;
  const seen = new Set<string>();
  const labels: string[] = [];
  const sorted = [...entries].sort(
    (a, b) => b.startedAt.getTime() - a.startedAt.getTime(),
  );
  for (const entry of sorted) {
    if (normalizeCategory(entry.category) !== key) continue;
    const label = entry.label.trim();
    const dedupeKey = label.toLowerCase();
    if (!label || dedupeKey === key || dedupeKey === categoryLabel(category).toLowerCase()) {
      continue;
    }
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    labels.push(label);
    if (labels.length >= limit) break;
  }
  return labels;
}

export type UntrackedGap = {
  start: Date;
  end: Date;
  minutes: number;
};

/**
 * The open gap since the last completed entry, when it's big enough to be
 * worth backfilling but small enough to plausibly be one stretch of the day.
 */
export function findUntrackedGap(options: {
  lastEndedAt: Date | null;
  now: Date;
  minMinutes?: number;
  maxHours?: number;
}): UntrackedGap | null {
  if (!options.lastEndedAt) return null;
  const minMinutes = options.minMinutes ?? 10;
  const maxHours = options.maxHours ?? 12;
  const ms = options.now.getTime() - options.lastEndedAt.getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < minMinutes) return null;
  if (ms > maxHours * 60 * 60 * 1000) return null;
  return { start: options.lastEndedAt, end: options.now, minutes };
}
