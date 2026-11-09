// "Is Aucosto being used?" — pure derivation over the activity log.
//
// The event log records every meaningful write. This turns eight weeks of it
// into the numbers the usage page shows: which days someone logged something,
// which parts of the app carry that activity, and who made each entry — the
// viewer, their household partner, or an agent working through the assistant
// API. Agent entries are counted separately on purpose: an app an agent fills
// in every morning looks busy while nobody is opening it.
//
// Pure and tested in tests/usage.test.ts. No DB access here.

import { weekStartOf } from "./shared";

export type UsageWho = "you" | "partner" | "agent" | "auto";

export type UsageEvent = {
  userId: string;
  type: string;
  at: Date;
  meta: unknown;
};

export type UsageArea = {
  key: string;
  label: string;
  href: string;
};

/** Parts of the app, keyed by event-type prefix ("finance.entry_added" → finance). */
export const USAGE_AREAS: UsageArea[] = [
  { key: "time", label: "Time", href: "/app/time" },
  { key: "calendar", label: "Calendar", href: "/app/calendar" },
  { key: "plan", label: "Plan", href: "/app/plan" },
  { key: "do", label: "Do List", href: "/app/do" },
  { key: "habit", label: "Habits", href: "/app/habits" },
  { key: "reflect", label: "Reflect", href: "/app/reflect" },
  { key: "rhythm", label: "Check-ins", href: "/app" },
  { key: "review", label: "Weekly review", href: "/app/review" },
  { key: "project", label: "Projects", href: "/app/projects" },
  { key: "finance", label: "Money", href: "/app/finance" },
  { key: "home", label: "Home", href: "/app/home" },
  { key: "work", label: "Work", href: "/app/work" },
  { key: "rolodex", label: "Rolodex", href: "/app/rolodex" },
  { key: "insight", label: "Notes", href: "/app/time" },
];

const AREA_KEYS = new Set(USAGE_AREAS.map((area) => area.key));

/** Writes no person or agent chose to make: device and bank syncs. */
const AUTOMATIC_TYPES = new Set([
  "habit.health_synced",
  "finance.connection_synced",
  "finance.webhook_transactions_processed",
]);

/** An event this close to an audited agent action was written by that action. */
export const AGENT_AUDIT_WINDOW_MS = 15_000;

/** The roadmap's own test: used on at least 5 of 7 days, two weeks running. */
export const USAGE_GOAL_DAYS = 5;

/** A tool with no personal entry for this long is "quiet". */
export const QUIET_AFTER_DAYS = 30;

export const USAGE_WEEKS = 8;

export function usageAreaKey(type: string): string | null {
  const key = type.split(".")[0] ?? "";
  return AREA_KEYS.has(key) ? key : null;
}

function metaField(meta: unknown, field: string): unknown {
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    return (meta as Record<string, unknown>)[field];
  }
  return undefined;
}

/** True when a sorted list of times has one within `windowMs` of `time`. */
export function hasTimeNear(sortedTimes: number[], time: number, windowMs: number): boolean {
  let low = 0;
  let high = sortedTimes.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (sortedTimes[mid]! < time - windowMs) low = mid + 1;
    else high = mid;
  }
  return low < sortedTimes.length && sortedTimes[low]! <= time + windowMs;
}

export type ClassifyContext = {
  /** The person looking at the page. */
  viewerUserId: string;
  /** Sorted epoch-ms times of executed agent actions on the viewer's data. */
  agentActionTimes: number[];
};

/**
 * Who made an entry. Order matters: an agent stamp wins over everything, then
 * a household partner's stamp, then the older fallback of "an agent action
 * was audited at the same moment" for entries written before events carried
 * the stamp.
 */
export function classifyUsageEvent(event: UsageEvent, context: ClassifyContext): UsageWho {
  if (AUTOMATIC_TYPES.has(event.type)) return "auto";
  if (metaField(event.meta, "via") === "agent") return "agent";
  const actor = metaField(event.meta, "actorUserId");
  if (typeof actor === "string" && actor && actor !== context.viewerUserId) return "partner";
  if (
    event.userId === context.viewerUserId &&
    hasTimeNear(context.agentActionTimes, event.at.getTime(), AGENT_AUDIT_WINDOW_MS)
  ) {
    return "agent";
  }
  return "you";
}

export type UsageCounts = { you: number; partner: number; agent: number };

export type UsageDay = UsageCounts & {
  /** Local "YYYY-MM-DD". */
  key: string;
  date: Date;
  /** After today — drawn empty, never counted. */
  future: boolean;
};

export type UsageWeek = {
  /** Monday's "YYYY-MM-DD". */
  key: string;
  start: Date;
  days: UsageDay[];
  /** Days this week the viewer logged at least one thing. */
  activeDays: number;
};

export type UsageAreaRow = UsageArea & {
  /** One entry per week, aligned with `weeks`. */
  weeks: UsageCounts[];
  totals: UsageCounts;
  lastYouAt: Date | null;
  /** Latest entry by a person (the viewer or their partner), never an agent. */
  lastPersonAt: Date | null;
  /** No entry by a person inside the quiet window. */
  quiet: boolean;
};

export type UsageGoal = {
  target: number;
  /** Active days in the last 7 days, today included. */
  last7: number;
  /** Active days in the 7 days before that. */
  prior7: number;
  met: boolean;
};

export type UsageReport = {
  weeks: UsageWeek[];
  areas: UsageAreaRow[];
  goal: UsageGoal;
  /** Entries in the last 7 days, by who made them. */
  last7: UsageCounts;
  /** Entries in the 7 days before that. */
  prior7: UsageCounts;
  /** Automatic syncs in the last 7 days (shown as a footnote, never as use). */
  autoLast7: number;
  lastYouAt: Date | null;
  /** Days in a row, ending today or yesterday, with a personal entry. */
  streak: number;
  hasPartner: boolean;
};

function dayKeyOf(date: Date): string {
  return date.toLocaleDateString("en-CA");
}

function startOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function addDays(date: Date, days: number): Date {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

/** First instant the report covers: the Monday `USAGE_WEEKS` weeks back. */
export function usageWindowStart(now: Date): Date {
  return addDays(weekStartOf(now), -7 * (USAGE_WEEKS - 1));
}

const emptyCounts = (): UsageCounts => ({ you: 0, partner: 0, agent: 0 });

export function buildUsageReport(
  events: UsageEvent[],
  options: ClassifyContext & { now: Date; hasPartner?: boolean },
): UsageReport {
  const { now } = options;
  const today = startOfDay(now);
  const todayKey = dayKeyOf(today);
  const windowStart = usageWindowStart(now);

  const weeks: UsageWeek[] = [];
  const dayByKey = new Map<string, UsageDay>();
  const weekIndexByDay = new Map<string, number>();
  for (let w = 0; w < USAGE_WEEKS; w += 1) {
    const start = addDays(windowStart, w * 7);
    const days: UsageDay[] = [];
    for (let d = 0; d < 7; d += 1) {
      const date = addDays(start, d);
      const key = dayKeyOf(date);
      const day: UsageDay = { key, date, future: key > todayKey, ...emptyCounts() };
      days.push(day);
      dayByKey.set(key, day);
      weekIndexByDay.set(key, w);
    }
    weeks.push({ key: dayKeyOf(start), start, days, activeDays: 0 });
  }

  const areaRows = new Map<string, UsageAreaRow>(
    USAGE_AREAS.map((area) => [
      area.key,
      {
        ...area,
        weeks: weeks.map(() => emptyCounts()),
        totals: emptyCounts(),
        lastYouAt: null,
        lastPersonAt: null,
        quiet: true,
      },
    ]),
  );

  const last7Start = addDays(today, -6);
  const prior7Start = addDays(today, -13);
  const last7 = emptyCounts();
  const prior7 = emptyCounts();
  let autoLast7 = 0;
  let lastYouAt: Date | null = null;

  for (const event of events) {
    const areaKey = usageAreaKey(event.type);
    if (!areaKey) continue;
    const key = dayKeyOf(event.at);
    const day = dayByKey.get(key);
    if (!day || day.future) continue;

    const who = classifyUsageEvent(event, options);
    if (who === "auto") {
      if (event.at >= last7Start) autoLast7 += 1;
      continue;
    }

    day[who] += 1;
    const row = areaRows.get(areaKey)!;
    row.weeks[weekIndexByDay.get(key)!]![who] += 1;
    row.totals[who] += 1;
    if (who !== "agent") {
      if (!row.lastPersonAt || event.at > row.lastPersonAt) row.lastPersonAt = event.at;
    }
    if (who === "you") {
      if (!row.lastYouAt || event.at > row.lastYouAt) row.lastYouAt = event.at;
      if (!lastYouAt || event.at > lastYouAt) lastYouAt = event.at;
    }
    if (event.at >= last7Start) last7[who] += 1;
    else if (event.at >= prior7Start) prior7[who] += 1;
  }

  for (const week of weeks) {
    week.activeDays = week.days.filter((day) => day.you > 0).length;
  }

  const quietCutoff = addDays(today, -(QUIET_AFTER_DAYS - 1));
  for (const row of areaRows.values()) {
    row.quiet = !row.lastPersonAt || row.lastPersonAt < quietCutoff;
  }

  const activeBetween = (from: Date, days: number) => {
    let count = 0;
    for (let i = 0; i < days; i += 1) {
      if ((dayByKey.get(dayKeyOf(addDays(from, i)))?.you ?? 0) > 0) count += 1;
    }
    return count;
  };
  const goalLast7 = activeBetween(last7Start, 7);
  const goalPrior7 = activeBetween(prior7Start, 7);

  // A streak survives until the end of today: if nothing is logged yet today,
  // count back from yesterday.
  let streak = 0;
  let cursor = (dayByKey.get(todayKey)?.you ?? 0) > 0 ? today : addDays(today, -1);
  while ((dayByKey.get(dayKeyOf(cursor))?.you ?? 0) > 0) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return {
    weeks,
    areas: [...areaRows.values()],
    goal: {
      target: USAGE_GOAL_DAYS,
      last7: goalLast7,
      prior7: goalPrior7,
      met: goalLast7 >= USAGE_GOAL_DAYS && goalPrior7 >= USAGE_GOAL_DAYS,
    },
    last7,
    prior7,
    autoLast7,
    lastYouAt,
    streak,
    hasPartner: options.hasPartner ?? false,
  };
}

/** One honest sentence for the top of the page. */
export function usageHeadline(report: UsageReport): string {
  const { goal, last7 } = report;
  if (goal.last7 === 0) {
    return last7.agent > 0
      ? "You logged nothing yourself in the last 7 days. Everything recent came from an agent."
      : "Nothing was logged in the last 7 days.";
  }
  if (goal.met) {
    return `You used Aucosto on ${goal.last7} of the last 7 days, and ${goal.prior7} of the 7 before. That is the habit.`;
  }
  if (goal.last7 >= goal.target) {
    return `You used Aucosto on ${goal.last7} of the last 7 days. One more week like this makes it a habit.`;
  }
  const missing = goal.target - goal.last7;
  return `You used Aucosto on ${goal.last7} of the last 7 days. ${missing} more ${missing === 1 ? "day" : "days"} reaches the goal of ${goal.target}.`;
}
