// Cross-correlation "patterns": each finding pairs a plain-language insight
// with a small bar chart. All computed in memory from day-level facts.
// Pure — tested in tests/insights.test.ts.

import { clippedDurationMs } from "@/lib/time-insights";
import { categoryLabel, normalizeCategory } from "@/lib/time-categories";
import { average } from "./shared";
import type { InsightEntry, ReflectionLite } from "./trends";

export type PatternBar = { label: string; value: number; color?: string };

export type PatternFinding = {
  key: string;
  finding: string;
  detail: string;
  bars: PatternBar[];
  /** Unit hint for bar values (rendered next to numbers). */
  unit: string;
};

export type DayFacts = {
  dateKey: string;
  mood: number | null;
  productivity: number | null;
  dayRating: number | null;
  trackedMs: number;
  categories: string[];
  habitsDue: number | null;
  habitsHit: number | null;
  /** Start hour of each tracked entry, weighted later by duration. */
  entryHours: Array<{ hour: number; ms: number }>;
};

export function buildDayFacts(input: {
  entries: InsightEntry[];
  reflections: Array<
    ReflectionLite & {
      contextSnapshot: { habitsDue: number; habitsHit: number } | null;
    }
  >;
  from: Date;
  to: Date;
  now: Date;
}): DayFacts[] {
  const byDay = new Map<string, DayFacts>();
  const factsFor = (dateKey: string): DayFacts => {
    const existing = byDay.get(dateKey);
    if (existing) return existing;
    const facts: DayFacts = {
      dateKey,
      mood: null,
      productivity: null,
      dayRating: null,
      trackedMs: 0,
      categories: [],
      habitsDue: null,
      habitsHit: null,
      entryHours: [],
    };
    byDay.set(dateKey, facts);
    return facts;
  };

  for (const entry of input.entries) {
    const ms = clippedDurationMs(entry, input.from, input.to, input.now);
    if (ms <= 0) continue;
    const facts = factsFor(entry.startedAt.toLocaleDateString("en-CA"));
    facts.trackedMs += ms;
    const category = normalizeCategory(entry.category) || "uncategorized";
    if (!facts.categories.includes(category)) facts.categories.push(category);
    facts.entryHours.push({ hour: entry.startedAt.getHours(), ms });
  }

  for (const reflection of input.reflections) {
    const facts = factsFor(reflection.dateKey);
    facts.mood = reflection.mood;
    facts.productivity = reflection.productivityRating;
    facts.dayRating = reflection.dayRating;
    if (reflection.contextSnapshot) {
      facts.habitsDue = reflection.contextSnapshot.habitsDue;
      facts.habitsHit = reflection.contextSnapshot.habitsHit;
    }
  }

  return Array.from(byDay.values()).sort((a, b) =>
    a.dateKey.localeCompare(b.dateKey),
  );
}

const round1 = (value: number) => Math.round(value * 10) / 10;

export function habitsVsMood(days: DayFacts[]): PatternFinding | null {
  const rated = days.filter(
    (d) => d.mood !== null && d.habitsDue !== null && d.habitsDue > 0,
  );
  const full = rated.filter((d) => d.habitsHit! >= d.habitsDue!);
  const low = rated.filter((d) => d.habitsHit! / d.habitsDue! < 0.5);
  if (full.length < 3 || low.length < 3) return null;
  const fullAvg = average(full.map((d) => d.mood!))!;
  const lowAvg = average(low.map((d) => d.mood!))!;
  const delta = fullAvg - lowAvg;
  if (Math.abs(delta) < 0.3) return null;
  return {
    key: "habits-mood",
    finding:
      delta > 0
        ? "Days with all habits done feel noticeably better."
        : "Habit completion doesn't track with better moods for you.",
    detail: `Average mood is ${round1(fullAvg)} on 100%-habit days vs ${round1(lowAvg)} on days under 50% (${full.length} vs ${low.length} days).`,
    bars: [
      { label: "All habits", value: round1(fullAvg) },
      { label: "Under half", value: round1(lowAvg) },
    ],
    unit: "mood",
  };
}

const HOUR_BINS = [
  { label: "<2h", max: 2 },
  { label: "2–4h", max: 4 },
  { label: "4–6h", max: 6 },
  { label: "6h+", max: Infinity },
];

export function hoursVsProductivity(days: DayFacts[]): PatternFinding | null {
  const rated = days.filter((d) => d.productivity !== null);
  const bins = HOUR_BINS.map((bin) => ({ ...bin, values: [] as number[] }));
  for (const day of rated) {
    const hours = day.trackedMs / 3_600_000;
    const bin = bins.find((b) => hours < b.max)!;
    bin.values.push(day.productivity!);
  }
  const usable = bins.filter((bin) => bin.values.length >= 2);
  if (usable.length < 2) return null;
  const scored = usable.map((bin) => ({
    label: bin.label,
    value: round1(average(bin.values)!),
  }));
  const best = [...scored].sort((a, b) => b.value - a.value)[0]!;
  return {
    key: "hours-productivity",
    finding: `You feel most productive on ${best.label} tracked days.`,
    detail: `Average productivity rating by hours tracked per day (${rated.length} rated days).`,
    bars: scored,
    unit: "rating",
  };
}

export function categoriesVsMood(days: DayFacts[]): PatternFinding | null {
  const rated = days.filter((d) => d.mood !== null);
  if (rated.length < 6) return null;
  const overall = average(rated.map((d) => d.mood!))!;
  const perCategory = new Map<string, number[]>();
  for (const day of rated) {
    for (const category of day.categories) {
      const bucket = perCategory.get(category) ?? [];
      bucket.push(day.mood!);
      perCategory.set(category, bucket);
    }
  }
  const deltas = Array.from(perCategory.entries())
    .filter(([, moods]) => moods.length >= 3)
    .map(([category, moods]) => ({
      category,
      label: category === "uncategorized" ? "Uncategorized" : categoryLabel(category),
      delta: average(moods)! - overall,
      count: moods.length,
    }))
    .sort((a, b) => b.delta - a.delta);
  if (deltas.length === 0) return null;
  const top = deltas[0]!;
  const bottom = deltas[deltas.length - 1]!;
  if (top.delta < 0.25 && bottom.delta > -0.25) return null;
  const lead =
    top.delta >= 0.25
      ? `${top.label} days run ${round1(top.delta)} above your average mood.`
      : `${bottom.label} days run ${round1(Math.abs(bottom.delta))} below your average mood.`;
  return {
    key: "category-mood",
    finding: lead,
    detail: `Mood delta vs your ${round1(overall)} average, for categories appearing on 3+ rated days.`,
    bars: deltas
      .slice(0, 4)
      .map((d) => ({ label: d.label, value: round1(d.delta) })),
    unit: "Δ mood",
  };
}

export function switchesVsRatings(days: DayFacts[]): PatternFinding | null {
  const rated = days.filter(
    (d) => d.productivity !== null && d.categories.length > 0,
  );
  if (rated.length < 6) return null;
  const counts = rated.map((d) => d.categories.length).sort((a, b) => a - b);
  const median = counts[Math.floor(counts.length / 2)]!;
  if (median <= 1) return null;
  const focused = rated.filter((d) => d.categories.length <= median);
  const scattered = rated.filter((d) => d.categories.length > median);
  if (focused.length < 3 || scattered.length < 3) return null;
  const focusedAvg = average(focused.map((d) => d.productivity!))!;
  const scatteredAvg = average(scattered.map((d) => d.productivity!))!;
  if (Math.abs(focusedAvg - scatteredAvg) < 0.3) return null;
  return {
    key: "switches",
    finding:
      focusedAvg > scatteredAvg
        ? `You feel more productive on days with ${median} or fewer context switches.`
        : `More varied days actually rate higher for you.`,
    detail: `Average productivity: ${round1(focusedAvg)} on ≤${median}-category days vs ${round1(scatteredAvg)} above that.`,
    bars: [
      { label: `≤${median} categories`, value: round1(focusedAvg) },
      { label: `>${median}`, value: round1(scatteredAvg) },
    ],
    unit: "rating",
  };
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function bestDayOfWeek(days: DayFacts[]): PatternFinding | null {
  const rated = days.filter((d) => d.dayRating !== null);
  const perWeekday = new Map<number, number[]>();
  for (const day of rated) {
    const weekday = new Date(`${day.dateKey}T12:00:00`).getDay();
    const bucket = perWeekday.get(weekday) ?? [];
    bucket.push(day.dayRating!);
    perWeekday.set(weekday, bucket);
  }
  const scored = Array.from(perWeekday.entries())
    .filter(([, ratings]) => ratings.length >= 2)
    .map(([weekday, ratings]) => ({
      label: WEEKDAY_LABELS[weekday]!,
      value: round1(average(ratings)!),
    }));
  if (scored.length < 3) return null;
  const best = [...scored].sort((a, b) => b.value - a.value)[0]!;
  return {
    key: "weekday",
    finding: `${best.label}s tend to be your best days.`,
    detail: `Average overall day rating by weekday (weekdays with 2+ reflections).`,
    bars: scored,
    unit: "rating",
  };
}

const DAY_PARTS = [
  { label: "Morning", from: 5, to: 12 },
  { label: "Afternoon", from: 12, to: 17 },
  { label: "Evening", from: 17, to: 22 },
  { label: "Night", from: 22, to: 29 }, // wraps past midnight (22:00–05:00)
];

export function bestTimeOfDay(days: DayFacts[]): PatternFinding | null {
  const totals = DAY_PARTS.map((part) => ({ label: part.label, ms: 0 }));
  for (const day of days) {
    for (const { hour, ms } of day.entryHours) {
      const normalized = hour < 5 ? hour + 24 : hour;
      const index = DAY_PARTS.findIndex(
        (part) => normalized >= part.from && normalized < part.to,
      );
      if (index >= 0) totals[index]!.ms += ms;
    }
  }
  const totalMs = totals.reduce((sum, t) => sum + t.ms, 0);
  if (totalMs < 4 * 3_600_000) return null;
  const best = [...totals].sort((a, b) => b.ms - a.ms)[0]!;
  return {
    key: "time-of-day",
    finding: `${best.label} is when most of your tracked work happens.`,
    detail: `Share of tracked time by time of day across the period.`,
    bars: totals.map((t) => ({
      label: t.label,
      value: Math.round((t.ms / totalMs) * 100),
    })),
    unit: "%",
  };
}

export function deriveAllPatterns(days: DayFacts[]): PatternFinding[] {
  return [
    habitsVsMood(days),
    hoursVsProductivity(days),
    categoriesVsMood(days),
    switchesVsRatings(days),
    bestDayOfWeek(days),
    bestTimeOfDay(days),
  ].filter((finding): finding is PatternFinding => finding !== null);
}
