// Apple Health → habits: the measures an iPhone Shortcut can send, and how
// a day's value turns into habit progress. Pure; tested in
// tests/health-habits.test.ts.

export const HEALTH_METRICS = [
  "steps",
  "exerciseMinutes",
  "workouts",
  "weighIn",
  "sleepHours",
  "mindfulMinutes",
] as const;
export type HealthMetric = (typeof HEALTH_METRICS)[number];

export const HEALTH_METRIC_LABELS: Record<HealthMetric, string> = {
  steps: "Steps",
  exerciseMinutes: "Exercise minutes",
  workouts: "Workouts",
  weighIn: "Weight logged",
  sleepHours: "Sleep (hours)",
  mindfulMinutes: "Mindful minutes",
};

export function isHealthMetric(value: unknown): value is HealthMetric {
  return typeof value === "string" && (HEALTH_METRICS as readonly string[]).includes(value);
}

/** One day of numbers from the Shortcut. Missing = not sent, not zero. */
export type HealthDay = Partial<Record<HealthMetric, number>>;

/** A check-style sleep habit counts as done from this much sleep. */
const SLEEP_CHECK_HOURS = 7;

/**
 * Habit progress for one day from a health value, or null when the day's
 * sample doesn't include that measure. Check habits get 1 once the measure
 * shows it happened; count habits get the raw number (8,275 steps against a
 * 10,000 target); minute habits get minutes.
 */
export function healthQuantity(
  metric: HealthMetric,
  day: HealthDay,
  habit: { goalUnit: string },
): number | null {
  const raw = day[metric];
  if (raw === undefined || raw === null || !Number.isFinite(raw) || raw < 0) return null;
  if (habit.goalUnit === "check") {
    if (metric === "sleepHours") return raw >= SLEEP_CHECK_HOURS ? 1 : 0;
    return raw > 0 ? 1 : 0;
  }
  if (habit.goalUnit === "minutes") {
    return Math.round(metric === "sleepHours" ? raw * 60 : raw);
  }
  return Math.round(metric === "weighIn" ? (raw > 0 ? 1 : 0) : raw);
}

/** Best-guess measure for a habit title, to pre-fill the picker. */
export function suggestHealthMetric(title: string): HealthMetric | null {
  const t = title.toLowerCase();
  if (/steps?\b/.test(t)) return "steps";
  if (/weigh/.test(t)) return "weighIn";
  if (/\b(run|workout|gym|lift|exercise|swim|bike|cycle)/.test(t)) return "workouts";
  if (/sleep/.test(t)) return "sleepHours";
  if (/meditat|mindful|breath/.test(t)) return "mindfulMinutes";
  return null;
}
