// Weekly rhythm consistency — how reliably the day's transition flows get
// run. Pure: the insights page fetches sessions via the rhythms service and
// passes the minimal shape in here.

import {
  RHYTHM_DEFINITIONS,
  RHYTHM_ORDER,
  normalizeRhythmType,
  type RhythmType,
} from "@/lib/rhythms";
import { listWeekKeys, weekKeyOf, weekLabel } from "./shared";

export type RhythmSessionLite = {
  type: string;
  startedAt: Date;
};

export type RhythmConsistencyWeek = {
  weekKey: string;
  label: string;
  count: number;
};

export type RhythmTypeTotal = {
  type: RhythmType;
  name: string;
  icon: string;
  count: number;
};

export type RhythmConsistency = {
  weekly: RhythmConsistencyWeek[];
  perType: RhythmTypeTotal[];
  totalSessions: number;
  /** Distinct local days with at least one rhythm session. */
  activeDays: number;
  /** Days in the range, for an "X of Y days" read. */
  rangeDays: number;
  busiestType: RhythmTypeTotal | null;
};

export function deriveRhythmConsistency(
  sessions: RhythmSessionLite[],
  options: { from: Date; to: Date },
): RhythmConsistency {
  const weekKeys = listWeekKeys(options.from, options.to);
  const perWeek = new Map<string, number>(weekKeys.map((key) => [key, 0]));
  const perTypeCount = new Map<RhythmType, number>(
    RHYTHM_ORDER.map((type) => [type, 0]),
  );
  const activeDayKeys = new Set<string>();

  for (const session of sessions) {
    const type = normalizeRhythmType(session.type);
    if (!type) continue;
    const weekKey = weekKeyOf(session.startedAt);
    if (perWeek.has(weekKey)) {
      perWeek.set(weekKey, (perWeek.get(weekKey) ?? 0) + 1);
    }
    perTypeCount.set(type, (perTypeCount.get(type) ?? 0) + 1);
    activeDayKeys.add(session.startedAt.toLocaleDateString("en-CA"));
  }

  const weekly: RhythmConsistencyWeek[] = weekKeys.map((weekKey) => ({
    weekKey,
    label: weekLabel(weekKey),
    count: perWeek.get(weekKey) ?? 0,
  }));

  const perType: RhythmTypeTotal[] = RHYTHM_ORDER.map((type) => ({
    type,
    name: RHYTHM_DEFINITIONS[type].name,
    icon: RHYTHM_DEFINITIONS[type].icon,
    count: perTypeCount.get(type) ?? 0,
  }));

  const totalSessions = perType.reduce((sum, entry) => sum + entry.count, 0);
  const busiestType =
    totalSessions > 0
      ? perType.reduce((best, entry) => (entry.count > best.count ? entry : best))
      : null;

  const rangeDays =
    Math.max(
      1,
      Math.round(
        (options.to.getTime() - options.from.getTime()) / (1000 * 60 * 60 * 24),
      ) + 1,
    );

  return {
    weekly,
    perType,
    totalSessions,
    activeDays: activeDayKeys.size,
    rangeDays,
    busiestType,
  };
}
