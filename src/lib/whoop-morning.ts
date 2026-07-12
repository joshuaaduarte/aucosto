// Pure mapping from Whoop API v2 sleep records to the morning check-in's
// prefill data. No fetch, no Date.now() — callers inject "today starts at"
// so this stays unit-testable (tests/whoop-morning.test.ts).

export type WhoopSleepRecord = {
  id?: string;
  start?: string;
  end?: string;
  nap?: boolean;
  score?: {
    stage_summary?: {
      total_in_bed_time_milli?: number;
      total_awake_time_milli?: number;
    };
  } | null;
};

export type WhoopMorningData = {
  /** When the sleep ended — Whoop's auto-detected wake moment. */
  wakeAt: Date;
  /** Minutes actually asleep (in-bed minus awake when Whoop scored it). */
  sleepMinutes: number;
};

/**
 * The morning prefill from Whoop's most recent sleep, or null when the
 * record can't seed today's check-in: naps don't count, and a sleep that
 * ended before today's day boundary belongs to yesterday's morning.
 */
export function whoopSleepToMorning(
  record: WhoopSleepRecord | null | undefined,
  todayStart: Date,
): WhoopMorningData | null {
  if (!record || record.nap === true) return null;
  if (typeof record.start !== "string" || typeof record.end !== "string") {
    return null;
  }
  const start = new Date(record.start);
  const end = new Date(record.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (end.getTime() <= start.getTime()) return null;
  if (end.getTime() < todayStart.getTime()) return null;

  const stages = record.score?.stage_summary;
  const inBed = stages?.total_in_bed_time_milli;
  const awake = stages?.total_awake_time_milli ?? 0;
  const asleepMs =
    typeof inBed === "number" && inBed > 0
      ? Math.max(0, inBed - awake)
      : end.getTime() - start.getTime();

  return {
    wakeAt: end,
    sleepMinutes: Math.round(asleepMs / 60_000),
  };
}
