// "Insight of the day" rotation for the hub, plus the small per-tool trend
// derives (sparklines). Pure — tested in tests/insights.test.ts.

import { clippedDurationMs } from "@/lib/time-insights";
import { average, weekStartOf } from "./shared";
import type { DayFacts } from "./patterns";
import { bestDayOfWeek } from "./patterns";
import type { EstimatedTask, InsightEntry } from "./trends";
import { deriveEstimationAccuracy } from "./trends";

// ── Sparkline derives for tool pages ───────────────────────────────

export type WeeklySparkline = {
  /** Totals for the trailing weeks, oldest first; last value = current week so far. */
  values: number[];
  currentMs: number;
  /** Current week vs the average of the prior full weeks, percent. */
  paceVsAveragePct: number | null;
};

export function weeklyTrackedSparkline(
  entries: InsightEntry[],
  options: { weeks?: number; now: Date },
): WeeklySparkline {
  const weeks = options.weeks ?? 8;
  const currentWeekStart = weekStartOf(options.now);
  const totals: number[] = [];
  for (let index = weeks - 1; index >= 0; index -= 1) {
    const from = new Date(currentWeekStart);
    from.setDate(from.getDate() - index * 7);
    const to = new Date(from);
    to.setDate(to.getDate() + 7);
    totals.push(
      entries.reduce(
        (sum, entry) => sum + clippedDurationMs(entry, from, to, options.now),
        0,
      ),
    );
  }
  const currentMs = totals[totals.length - 1] ?? 0;
  const prior = totals.slice(0, -1).filter((value) => value > 0);
  // Compare against the prior average scaled to the same point in the week,
  // so Monday mornings don't always read as "way behind".
  const weekElapsed = Math.max(
    0.05,
    (options.now.getTime() - currentWeekStart.getTime()) / (7 * 86_400_000),
  );
  const priorAvg = average(prior);
  const paceVsAveragePct =
    priorAvg && priorAvg > 0
      ? Math.round(((currentMs / weekElapsed - priorAvg) / priorAvg) * 100)
      : null;
  return { values: totals, currentMs, paceVsAveragePct };
}

export type EstimationSparkline = {
  /** actual/estimate ratio for the last N completed tasks, oldest first. */
  ratios: number[];
  latestAccuracy: number | null;
};

export function estimationSparkline(
  tasks: EstimatedTask[],
  options: { limit?: number } = {},
): EstimationSparkline {
  const usable = tasks
    .filter((t) => t.completedAt && t.estimatedMinutes && t.actualMinutes)
    .sort((a, b) => a.completedAt!.getTime() - b.completedAt!.getTime())
    .slice(-(options.limit ?? 10));
  const ratios = usable.map((t) => t.actualMinutes! / t.estimatedMinutes!);
  const errors = ratios.map((ratio) => Math.abs(1 - ratio));
  return {
    ratios,
    latestAccuracy:
      errors.length > 0
        ? Math.max(0, Math.round(100 - average(errors)! * 100))
        : null,
  };
}

// ── Insight of the day ─────────────────────────────────────────────

export type DailyInsight = {
  text: string;
  href: string;
};

export type DailyInsightInput = {
  now: Date;
  entries8w: InsightEntry[];
  tasks: EstimatedTask[];
  days: DayFacts[];
};

/**
 * Build the eligible insight candidates and rotate deterministically by
 * day-of-year so the card changes daily without storage.
 */
export function deriveInsightOfTheDay(
  input: DailyInsightInput,
): DailyInsight | null {
  const candidates: DailyInsight[] = [];

  // 1. This week's tracked pace vs the trailing average.
  const spark = weeklyTrackedSparkline(input.entries8w, {
    weeks: 5,
    now: input.now,
  });
  if (spark.paceVsAveragePct !== null && Math.abs(spark.paceVsAveragePct) >= 15) {
    candidates.push({
      text:
        spark.paceVsAveragePct > 0
          ? `You're tracking ${spark.paceVsAveragePct}% more time this week than your 4-week average.`
          : `Tracked time is running ${Math.abs(spark.paceVsAveragePct)}% below your 4-week average this week.`,
      href: "/app/insights",
    });
  }

  // 2. Estimation accuracy shift over the last 30 days.
  const monthStart = new Date(input.now);
  monthStart.setDate(monthStart.getDate() - 29);
  const accuracy = deriveEstimationAccuracy(input.tasks, {
    from: monthStart,
    to: input.now,
  });
  if (accuracy.trend === "improving") {
    candidates.push({
      text: "Your task estimates are getting noticeably more accurate.",
      href: "/app/insights",
    });
  } else if (accuracy.trend === "getting worse") {
    candidates.push({
      text: "Estimates have drifted from reality lately — worth a look.",
      href: "/app/insights",
    });
  }

  // 3. Best weekday — nudges when today is that day.
  const weekday = bestDayOfWeek(input.days);
  if (weekday) {
    const todayLabel = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
      input.now.getDay()
    ]!;
    const best = [...weekday.bars].sort((a, b) => b.value - a.value)[0]!;
    if (best.label === todayLabel) {
      candidates.push({
        text: `${best.label}s tend to be your best days — a good day to tackle something hard.`,
        href: "/app/insights",
      });
    }
  }

  // 4. Habit completion ↔ mood link.
  const habitFinding = habitMoodCandidate(input.days);
  if (habitFinding) candidates.push(habitFinding);

  if (candidates.length === 0) return null;
  const dayOfYear = Math.floor(
    (input.now.getTime() -
      new Date(input.now.getFullYear(), 0, 0).getTime()) /
      86_400_000,
  );
  return candidates[dayOfYear % candidates.length]!;
}

function habitMoodCandidate(days: DayFacts[]): DailyInsight | null {
  const rated = days.filter(
    (d) => d.mood !== null && d.habitsDue !== null && d.habitsDue > 0,
  );
  const full = rated.filter((d) => d.habitsHit! >= d.habitsDue!);
  const rest = rated.filter((d) => d.habitsHit! < d.habitsDue!);
  if (full.length < 3 || rest.length < 3) return null;
  const delta = average(full.map((d) => d.mood!))! - average(rest.map((d) => d.mood!))!;
  if (delta < 0.4) return null;
  return {
    text: "Your best days line up with finishing all your habits.",
    href: "/app/insights",
  };
}
