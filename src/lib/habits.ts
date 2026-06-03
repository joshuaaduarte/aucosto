export const HABIT_CADENCES = ["daily", "weekdays", "weekly", "custom"] as const;
export const HABIT_GOAL_UNITS = ["check", "count", "minutes"] as const;
export const HABIT_WEEKDAY_OPTIONS = [
  { value: 0, short: "Sun", label: "Sunday" },
  { value: 1, short: "Mon", label: "Monday" },
  { value: 2, short: "Tue", label: "Tuesday" },
  { value: 3, short: "Wed", label: "Wednesday" },
  { value: 4, short: "Thu", label: "Thursday" },
  { value: 5, short: "Fri", label: "Friday" },
  { value: 6, short: "Sat", label: "Saturday" },
] as const;

export type HabitCadence = (typeof HABIT_CADENCES)[number];
export type HabitGoalUnit = (typeof HABIT_GOAL_UNITS)[number];

export const HABIT_CADENCE_LABELS: Record<HabitCadence, string> = {
  daily: "Daily",
  weekdays: "Weekdays",
  weekly: "Weekly",
  custom: "Custom days",
};

export const HABIT_GOAL_UNIT_LABELS: Record<HabitGoalUnit, string> = {
  check: "Check",
  count: "Count",
  minutes: "Minutes",
};

export function formatHabitQuantity(value: number, unit: HabitGoalUnit) {
  if (unit === "minutes") {
    if (value >= 60 && value % 60 === 0) return `${value / 60}h`;
    if (value >= 60) {
      const hours = Math.floor(value / 60);
      const minutes = value % 60;
      return `${hours}h ${minutes}m`;
    }
    return `${value}m`;
  }
  if (unit === "count") {
    return `${value}x`;
  }
  return value === 1 ? "Done" : `${value} checks`;
}

export function parseHabitDays(input: string | null | undefined): number[] {
  if (!input) return [];
  return input
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
    .sort((a, b) => a - b);
}

export function serializeHabitDays(days: number[]) {
  return [...new Set(days)].sort((a, b) => a - b).join(",");
}

export function describeHabitCadence(cadence: HabitCadence, daysOfWeek: string | null | undefined) {
  if (cadence === "custom") {
    const labels = parseHabitDays(daysOfWeek)
      .map((value) => HABIT_WEEKDAY_OPTIONS.find((option) => option.value === value)?.short)
      .filter(Boolean);
    return labels.length > 0 ? labels.join(" · ") : "Custom";
  }
  if (cadence === "weekdays") return "Mon-Fri";
  return HABIT_CADENCE_LABELS[cadence];
}

export function weekdayName(value: number) {
  return HABIT_WEEKDAY_OPTIONS.find((option) => option.value === value)?.label ?? String(value);
}
