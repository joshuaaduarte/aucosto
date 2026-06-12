// Shared primitives for the insights system: time ranges, week bucketing,
// rolling averages. Pure — tested in tests/insights.test.ts.

export type RangeKey = "7d" | "30d" | "90d" | "1y" | "all";

export const RANGE_OPTIONS: Array<{
  key: RangeKey;
  label: string;
  days: number | null;
}> = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
  { key: "1y", label: "1 year", days: 365 },
  { key: "all", label: "All time", days: null },
];

export function isRangeKey(value: string | undefined): value is RangeKey {
  return RANGE_OPTIONS.some((option) => option.key === value);
}

/** Start of the selected range (local midnight), or null for all-time. */
export function rangeStart(range: RangeKey, now: Date): Date | null {
  const option = RANGE_OPTIONS.find((o) => o.key === range);
  if (!option || option.days === null) return null;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (option.days - 1));
  return start;
}

/** Monday-anchored start of week (local). */
export function weekStartOf(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  const day = value.getDay();
  value.setDate(value.getDate() + (day === 0 ? -6 : 1 - day));
  return value;
}

export function weekKeyOf(date: Date): string {
  return weekStartOf(date).toLocaleDateString("en-CA");
}

export function weekLabel(weekKey: string): string {
  return new Date(`${weekKey}T12:00:00`).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

/** Consecutive Monday week-keys covering [from, to]. */
export function listWeekKeys(from: Date, to: Date): string[] {
  const keys: string[] = [];
  const cursor = weekStartOf(from);
  const end = weekStartOf(to);
  while (cursor <= end) {
    keys.push(cursor.toLocaleDateString("en-CA"));
    cursor.setDate(cursor.getDate() + 7);
  }
  return keys;
}

/** Consecutive local day keys covering [from, to]. */
export function listDayKeys(from: Date, to: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    keys.push(cursor.toLocaleDateString("en-CA"));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

/**
 * Trailing rolling average over a series with gaps. Each output point is the
 * mean of the non-null values inside the trailing window (null when the
 * window holds nothing) — smooths trend through noisy/sparse dailies.
 */
export function rollingAverage(
  values: Array<number | null>,
  window: number,
): Array<number | null> {
  return values.map((_, index) => {
    const slice = values
      .slice(Math.max(0, index - window + 1), index + 1)
      .filter((value): value is number => value !== null);
    if (slice.length === 0) return null;
    return slice.reduce((sum, value) => sum + value, 0) / slice.length;
  });
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function pctChange(from: number, to: number): number | null {
  if (from === 0) return null;
  return ((to - from) / Math.abs(from)) * 100;
}
