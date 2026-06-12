// Section derives for the insights page: time allocation, mood/wellbeing,
// habit consistency, estimation accuracy, plan vs actual, spending.
// Pure — tested in tests/insights.test.ts.

import { clippedDurationMs } from "@/lib/time-insights";
import { categoryColor, categoryLabel, normalizeCategory } from "@/lib/time-categories";
import {
  average,
  listDayKeys,
  listWeekKeys,
  pctChange,
  rollingAverage,
  weekKeyOf,
  weekLabel,
} from "./shared";

export type InsightEntry = {
  startedAt: Date;
  endedAt: Date | null;
  category: string | null;
  label: string;
};

// ── Time allocation ────────────────────────────────────────────────

export type AllocationWeek = {
  weekKey: string;
  label: string;
  totalMs: number;
  segments: Array<{ category: string; label: string; color: string; ms: number }>;
};

export type TimeAllocation = {
  weeks: AllocationWeek[];
  totalMs: number;
  topCategory: { label: string; color: string; ms: number } | null;
  leastCategory: { label: string; color: string; ms: number } | null;
};

export function deriveTimeAllocation(
  entries: InsightEntry[],
  options: { from: Date; to: Date; now: Date },
): TimeAllocation {
  const weekKeys = listWeekKeys(options.from, options.to);
  const perWeek = new Map<string, Map<string, { raw: string | null; ms: number }>>();
  const perCategory = new Map<string, { raw: string | null; ms: number }>();

  for (const entry of entries) {
    const ms = clippedDurationMs(entry, options.from, options.to, options.now);
    if (ms <= 0) continue;
    const weekKey = weekKeyOf(entry.startedAt);
    const categoryKey = normalizeCategory(entry.category) || "uncategorized";
    const week = perWeek.get(weekKey) ?? new Map();
    const cell = week.get(categoryKey) ?? { raw: entry.category, ms: 0 };
    cell.ms += ms;
    week.set(categoryKey, cell);
    perWeek.set(weekKey, week);
    const total = perCategory.get(categoryKey) ?? { raw: entry.category, ms: 0 };
    total.ms += ms;
    perCategory.set(categoryKey, total);
  }

  const weeks: AllocationWeek[] = weekKeys.map((weekKey) => {
    const cells = perWeek.get(weekKey) ?? new Map();
    const segments = Array.from(
      cells.entries() as Iterable<[string, { raw: string | null; ms: number }]>,
    )
      .map(([key, cell]) => ({
        category: key,
        label: key === "uncategorized" ? "Uncategorized" : categoryLabel(cell.raw),
        color: key === "uncategorized" ? categoryColor(null) : categoryColor(cell.raw),
        ms: cell.ms,
      }))
      .sort((a, b) => b.ms - a.ms);
    return {
      weekKey,
      label: weekLabel(weekKey),
      totalMs: segments.reduce((sum, s) => sum + s.ms, 0),
      segments,
    };
  });

  const ranked = Array.from(perCategory.entries())
    .map(([key, cell]) => ({
      label: key === "uncategorized" ? "Uncategorized" : categoryLabel(cell.raw),
      color: key === "uncategorized" ? categoryColor(null) : categoryColor(cell.raw),
      ms: cell.ms,
    }))
    .sort((a, b) => b.ms - a.ms);

  return {
    weeks,
    totalMs: ranked.reduce((sum, c) => sum + c.ms, 0),
    topCategory: ranked[0] ?? null,
    leastCategory: ranked.length > 1 ? ranked[ranked.length - 1]! : null,
  };
}

// ── Mood & wellbeing ───────────────────────────────────────────────

export type ReflectionLite = {
  dateKey: string;
  mood: number;
  energyLevel: number;
  productivityRating: number;
  dayRating: number;
};

export type WellbeingMetricKey =
  | "mood"
  | "energyLevel"
  | "productivityRating"
  | "dayRating";

export type WellbeingTrends = {
  dayKeys: string[];
  /** Raw + 7-day rolling values per metric, aligned to dayKeys (null gaps). */
  series: Record<
    WellbeingMetricKey,
    { raw: Array<number | null>; rolling: Array<number | null> }
  >;
  sampleCount: number;
  bestWeek: { label: string; avg: number } | null;
  worstWeek: { label: string; avg: number } | null;
};

const WELLBEING_KEYS: WellbeingMetricKey[] = [
  "mood",
  "energyLevel",
  "productivityRating",
  "dayRating",
];

export function deriveWellbeingTrends(
  reflections: ReflectionLite[],
  options: { from: Date; to: Date },
): WellbeingTrends {
  const dayKeys = listDayKeys(options.from, options.to);
  const byDay = new Map(reflections.map((r) => [r.dateKey, r]));

  const series = {} as WellbeingTrends["series"];
  for (const key of WELLBEING_KEYS) {
    const raw = dayKeys.map((day) => byDay.get(day)?.[key] ?? null);
    series[key] = { raw, rolling: rollingAverage(raw, 7) };
  }

  const weekRatings = new Map<string, number[]>();
  for (const reflection of reflections) {
    const weekKey = weekKeyOf(new Date(`${reflection.dateKey}T12:00:00`));
    const bucket = weekRatings.get(weekKey) ?? [];
    bucket.push(reflection.dayRating);
    weekRatings.set(weekKey, bucket);
  }
  const weeks = Array.from(weekRatings.entries())
    .filter(([, ratings]) => ratings.length >= 2)
    .map(([weekKey, ratings]) => ({
      label: weekLabel(weekKey),
      avg: average(ratings)!,
    }))
    .sort((a, b) => b.avg - a.avg);

  return {
    dayKeys,
    series,
    sampleCount: reflections.length,
    bestWeek: weeks[0] ?? null,
    worstWeek: weeks.length > 1 ? weeks[weeks.length - 1]! : null,
  };
}

// ── Habit consistency ──────────────────────────────────────────────

export type HabitLite = {
  id: string;
  title: string;
  completionRate30d: number;
  currentStreak: number;
  longestStreak: number;
};

export type HabitConsistency = {
  perHabit: HabitLite[];
  /** Week-over-week logging rate: distinct habit-days logged / (habits × 7). */
  weekly: Array<{ weekKey: string; label: string; rate: number }>;
};

export function deriveHabitConsistency(
  habits: HabitLite[],
  entries: Array<{ habitId: string; loggedAt: Date }>,
  options: { from: Date; to: Date },
): HabitConsistency {
  const weekKeys = listWeekKeys(options.from, options.to);
  const perWeekDays = new Map<string, Set<string>>();
  for (const entry of entries) {
    const weekKey = weekKeyOf(entry.loggedAt);
    const set = perWeekDays.get(weekKey) ?? new Set<string>();
    set.add(`${entry.habitId}:${entry.loggedAt.toLocaleDateString("en-CA")}`);
    perWeekDays.set(weekKey, set);
  }
  const habitCount = Math.max(1, habits.length);
  return {
    perHabit: [...habits].sort(
      (a, b) => b.completionRate30d - a.completionRate30d,
    ),
    weekly: weekKeys.map((weekKey) => ({
      weekKey,
      label: weekLabel(weekKey),
      rate: Math.min(1, (perWeekDays.get(weekKey)?.size ?? 0) / (habitCount * 7)),
    })),
  };
}

// ── Estimation accuracy ────────────────────────────────────────────

export type EstimatedTask = {
  completedAt: Date | null;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  bucket: string | null;
};

export type EstimationAccuracy = {
  /** Weekly mean |actual−estimate|/estimate as accuracy % (100 = perfect). */
  weekly: Array<{ weekKey: string; label: string; accuracy: number; count: number }>;
  sampleCount: number;
  trend: "improving" | "stable" | "getting worse" | null;
  best: { bucket: string; accuracy: number; count: number } | null;
  worst: { bucket: string; accuracy: number; count: number } | null;
};

function accuracyOf(errors: number[]): number {
  const meanError = average(errors) ?? 0;
  return Math.max(0, Math.round(100 - meanError * 100));
}

export function deriveEstimationAccuracy(
  tasks: EstimatedTask[],
  options: { from: Date; to: Date },
): EstimationAccuracy {
  const usable = tasks
    .filter(
      (task) =>
        task.completedAt &&
        task.completedAt >= options.from &&
        task.completedAt <= options.to &&
        task.estimatedMinutes &&
        task.actualMinutes,
    )
    .map((task) => ({
      completedAt: task.completedAt!,
      error:
        Math.abs(task.actualMinutes! - task.estimatedMinutes!) /
        task.estimatedMinutes!,
      bucket: task.bucket?.trim() || "no bucket",
    }))
    .sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());

  const perWeek = new Map<string, number[]>();
  for (const task of usable) {
    const weekKey = weekKeyOf(task.completedAt);
    const bucket = perWeek.get(weekKey) ?? [];
    bucket.push(task.error);
    perWeek.set(weekKey, bucket);
  }
  const weekly = listWeekKeys(options.from, options.to)
    .map((weekKey) => {
      const errors = perWeek.get(weekKey);
      return errors
        ? {
            weekKey,
            label: weekLabel(weekKey),
            accuracy: accuracyOf(errors),
            count: errors.length,
          }
        : null;
    })
    .filter((week): week is NonNullable<typeof week> => week !== null);

  let trend: EstimationAccuracy["trend"] = null;
  if (usable.length >= 6) {
    const half = Math.floor(usable.length / 2);
    const earlier = average(usable.slice(0, half).map((t) => t.error))!;
    const later = average(usable.slice(half).map((t) => t.error))!;
    trend =
      later < earlier * 0.9
        ? "improving"
        : later > earlier * 1.1
          ? "getting worse"
          : "stable";
  }

  const perBucket = new Map<string, number[]>();
  for (const task of usable) {
    const bucket = perBucket.get(task.bucket) ?? [];
    bucket.push(task.error);
    perBucket.set(task.bucket, bucket);
  }
  const buckets = Array.from(perBucket.entries())
    .filter(([, errors]) => errors.length >= 2)
    .map(([bucket, errors]) => ({
      bucket,
      accuracy: accuracyOf(errors),
      count: errors.length,
    }))
    .sort((a, b) => b.accuracy - a.accuracy);

  return {
    weekly,
    sampleCount: usable.length,
    trend,
    best: buckets[0] ?? null,
    worst: buckets.length > 1 ? buckets[buckets.length - 1]! : null,
  };
}

// ── Plan vs actual ─────────────────────────────────────────────────

export type PlanVsActual = {
  /** Days that had planned blocks: how much of the planned time was tracked. */
  days: Array<{ dateKey: string; plannedMs: number; trackedMs: number; pct: number }>;
  weekly: Array<{ weekKey: string; label: string; pct: number }>;
  overallPct: number | null;
  trend: "improving" | "stable" | "getting worse" | null;
};

export function derivePlanVsActual(
  items: Array<{ startsAt: Date; endsAt: Date; allDay: boolean; status: string }>,
  entries: InsightEntry[],
  options: { from: Date; to: Date; now: Date },
): PlanVsActual {
  const planned = new Map<string, number>();
  for (const item of items) {
    if (item.allDay || item.status === "cancelled") continue;
    const dateKey = item.startsAt.toLocaleDateString("en-CA");
    planned.set(
      dateKey,
      (planned.get(dateKey) ?? 0) + (item.endsAt.getTime() - item.startsAt.getTime()),
    );
  }
  const tracked = new Map<string, number>();
  for (const entry of entries) {
    const ms = clippedDurationMs(entry, options.from, options.to, options.now);
    if (ms <= 0) continue;
    const dateKey = entry.startedAt.toLocaleDateString("en-CA");
    tracked.set(dateKey, (tracked.get(dateKey) ?? 0) + ms);
  }

  const days = Array.from(planned.entries())
    .map(([dateKey, plannedMs]) => {
      const trackedMs = tracked.get(dateKey) ?? 0;
      return {
        dateKey,
        plannedMs,
        trackedMs,
        pct: Math.min(150, Math.round((trackedMs / plannedMs) * 100)),
      };
    })
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  const perWeek = new Map<string, number[]>();
  for (const day of days) {
    const weekKey = weekKeyOf(new Date(`${day.dateKey}T12:00:00`));
    const bucket = perWeek.get(weekKey) ?? [];
    bucket.push(day.pct);
    perWeek.set(weekKey, bucket);
  }
  const weekly = Array.from(perWeek.entries())
    .map(([weekKey, pcts]) => ({
      weekKey,
      label: weekLabel(weekKey),
      pct: Math.round(average(pcts)!),
    }))
    .sort((a, b) => a.weekKey.localeCompare(b.weekKey));

  let trend: PlanVsActual["trend"] = null;
  if (days.length >= 6) {
    const half = Math.floor(days.length / 2);
    const earlier = average(days.slice(0, half).map((d) => Math.min(d.pct, 100)))!;
    const later = average(days.slice(half).map((d) => Math.min(d.pct, 100)))!;
    trend =
      later > earlier + 8
        ? "improving"
        : later < earlier - 8
          ? "getting worse"
          : "stable";
  }

  return {
    days,
    weekly,
    overallPct:
      days.length > 0
        ? Math.round(average(days.map((d) => Math.min(d.pct, 100)))!)
        : null,
    trend,
  };
}

// ── Spending ───────────────────────────────────────────────────────

export type SpendTrends = {
  months: Array<{
    monthKey: string;
    label: string;
    totalCents: number;
    segments: Array<{ category: string; cents: number }>;
  }>;
  momChangePct: number | null;
};

export function deriveSpendTrends(
  transactions: Array<{ date: Date; amount: number; category: string | null }>,
): SpendTrends {
  const perMonth = new Map<string, Map<string, number>>();
  for (const tx of transactions) {
    if (tx.amount >= 0) continue; // spending only
    const monthKey = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, "0")}`;
    const month = perMonth.get(monthKey) ?? new Map<string, number>();
    const category = tx.category?.trim() || "uncategorized";
    month.set(category, (month.get(category) ?? 0) + Math.abs(tx.amount));
    perMonth.set(monthKey, month);
  }
  const months = Array.from(perMonth.entries())
    .map(([monthKey, byCategory]) => {
      const segments = Array.from(byCategory.entries())
        .map(([category, cents]) => ({ category, cents }))
        .sort((a, b) => b.cents - a.cents);
      return {
        monthKey,
        label: new Date(`${monthKey}-15T12:00:00`).toLocaleDateString([], {
          month: "short",
          year: "2-digit",
        }),
        totalCents: segments.reduce((sum, s) => sum + s.cents, 0),
        segments,
      };
    })
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  const momChangePct =
    months.length >= 2
      ? pctChange(
          months[months.length - 2]!.totalCents,
          months[months.length - 1]!.totalCents,
        )
      : null;

  return { months, momChangePct };
}
